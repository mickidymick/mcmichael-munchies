import { Ingredient } from './supabase';

const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? '';
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const DETAIL_URL = 'https://api.nal.usda.gov/fdc/v1/food';

// Approximate gram conversions for common cooking units (used as fallback)
const GRAMS_PER_UNIT: Record<string, number> = {
  'g': 1,
  'kg': 1000,
  'oz': 28.35,
  'lb': 453.6,
  'cup': 240,
  'tbsp': 15,
  'tsp': 5,
  'ml': 1,
  'l': 1000,
  'fl oz': 30,
  'pt': 473,
  'qt': 946,
  'gal': 3785,
  'pinch': 0.5,
  'dash': 0.6,
  'clove': 3,
  'slice': 30,
  'piece': 100,
  'can': 400,
  'bag': 500,
  'bunch': 150,
  'sprig': 2,
  'whole': 100,
};

// Common cooking modifiers to strip for better USDA search matches
const MODIFIERS_TO_STRIP = [
  'boneless', 'skinless', 'bone-in', 'skin-on',
  'diced', 'chopped', 'minced', 'sliced', 'cubed', 'crushed', 'grated',
  'shredded', 'julienned', 'halved', 'quartered', 'torn',
  'fresh', 'frozen', 'cooked', 'raw', 'uncooked',
  'large', 'medium', 'small', 'extra-large', 'jumbo',
  'organic', 'all-purpose', 'all purpose',
  'finely', 'roughly', 'thinly', 'thickly',
  'peeled', 'deveined', 'trimmed', 'rinsed',
  'softened', 'melted', 'room temperature', 'cold', 'warm', 'hot',
  'packed', 'loosely packed', 'firmly packed',
  'to taste', 'optional', 'divided', 'plus more',
  'low-sodium', 'reduced-fat', 'fat-free', 'low-fat', 'whole',
  'unsalted', 'salted',
  'long', 'short', 'thick', 'thin',
];

function cleanIngredientName(name: string): string {
  let cleaned = name.toLowerCase().trim();
  // Normalize accented characters (e.g., jalapeño → jalapeno)
  cleaned = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Remove parenthetical notes like "(about 2 lbs)" or "(optional)"
  cleaned = cleaned.replace(/\(.*?\)/g, '');
  // Strip modifiers
  for (const mod of MODIFIERS_TO_STRIP) {
    cleaned = cleaned.replace(new RegExp(`\\b${mod}\\b`, 'gi'), '');
  }
  // Remove extra commas and whitespace
  cleaned = cleaned.replace(/,\s*,/g, ',').replace(/,\s*$/, '').replace(/^\s*,/, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function parseAmount(amount: string): number {
  const trimmed = amount.trim();
  // Handle ranges like "1-2", "12-15", "20-25" — use midpoint
  const range = trimmed.match(/^([\d./]+)\s*-\s*([\d./]+)$/);
  if (range) {
    const low = parseAmount(range[1]);
    const high = parseAmount(range[2]);
    return (low + high) / 2;
  }
  // Handle mixed like "1 1/2"
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  }
  // Handle fractions like "1/2", "3/4"
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
    }
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? 1 : num;
}

// Try to find a matching portion from USDA detail data
function findPortionWeight(unit: string, item: string, portions: Portion[]): number | null {
  if (portions.length === 0) return null;

  const unitLower = unit.trim().toLowerCase().replace(/s$/, '');
  const itemLower = item.trim().toLowerCase();

  // Unit aliases for matching portions
  const unitAliases: Record<string, string[]> = {
    'tbsp': ['tbsp', 'tablespoon'],
    'tsp': ['tsp', 'teaspoon'],
    'cup': ['cup'],
    'oz': ['oz'],
    'lb': ['lb', 'pound'],
    'fl oz': ['fl oz', 'fluid ounce'],
  };

  // Direct unit match in portion modifiers (e.g., unit "cup" matches "cup, chopped")
  if (unitLower) {
    const aliases = unitAliases[unitLower] ?? [unitLower];
    // Find all matching portions, prefer the shortest modifier (most basic measurement)
    let bestMatch: Portion | null = null;
    for (const p of portions) {
      for (const alias of aliases) {
        if (p.modifier === alias || p.modifier.startsWith(alias + ' ') || p.modifier.startsWith(alias + ',')) {
          if (!bestMatch || p.modifier.length < bestMatch.modifier.length) {
            bestMatch = p;
          }
        }
      }
    }
    if (bestMatch) return bestMatch.gramWeight;
  }

  // If unit is empty or a generic count word, look for a per-item portion
  const countUnits = ['', 'whole', 'piece', 'each', 'item'];
  if (countUnits.includes(unitLower)) {
    // Filter out volume/weight and slice-based portions — we want whole-item portions
    const skipWords = ['cup', 'tbsp', 'tablespoon', 'tsp', 'teaspoon', 'oz', 'nlea', 'fl', 'slice', 'serving'];
    const perItemPortions = portions.filter(
      (p) => !skipWords.some((v) => p.modifier.includes(v))
    );

    // Try to match item name in portion modifier (e.g., item "ladyfinger" matches "ladyfinger")
    const itemWords = itemLower.split(/\s+/).filter((w) => w.length > 2);
    for (const p of perItemPortions) {
      for (const word of itemWords) {
        if (p.modifier.includes(word)) return p.gramWeight;
      }
    }
    // Look for size-based modifiers that indicate a whole item
    const sizeOrder = ['medium', 'large', 'whole', 'small', ''];
    for (const size of sizeOrder) {
      const match = perItemPortions.find((p) =>
        size === '' ? p.modifier === '' : p.modifier.startsWith(size)
      );
      if (match) return match.gramWeight;
    }
    // Use the first per-item portion if available
    if (perItemPortions.length > 0) return perItemPortions[0].gramWeight;
  }

  return null;
}

function estimateGrams(amount: string, unit: string, item: string, portions: Portion[]): number {
  const qty = parseAmount(amount);
  const unitLower = unit.trim().toLowerCase().replace(/s$/, ''); // normalize plural

  // Try food-specific portion data from USDA first
  const portionWeight = findPortionWeight(unit, item, portions);
  if (portionWeight != null) return qty * portionWeight;

  // Fall back to generic conversion table
  const gramsPerUnit = GRAMS_PER_UNIT[unitLower] ?? GRAMS_PER_UNIT[unit.trim().toLowerCase()];
  if (gramsPerUnit) return qty * gramsPerUnit;

  // If no unit or unknown unit, assume it's a "whole" item (~100g)
  return qty * 100;
}

// Score how well a USDA result matches our search query
function scoreMatch(description: string, query: string): number {
  const desc = description.toLowerCase();
  const q = query.toLowerCase();
  const queryWords = q.split(/\s+/).filter((w) => w.length > 1);
  const descWords = desc.replace(/,/g, ' ').split(/\s+/);

  let score = 0;
  // Exact match is best
  if (desc === q) return 1000;

  // All query words present — heavily weighted
  const matchedWords = queryWords.filter((w) => desc.includes(w));
  score += (matchedWords.length / queryWords.length) * 100;

  // Bonus: description starts with or closely matches the query
  if (desc.startsWith(q)) score += 50;
  if (desc.includes(q)) score += 30;

  // Penalize extra words in the description that aren't in the query
  // (e.g., "egg white" has "white" not in query "egg" — penalize)
  const extraWords = descWords.filter(
    (w) => w.length > 2 && !queryWords.some((qw) => w.includes(qw) || qw.includes(w))
  );
  score -= extraWords.length * 8;

  // Penalize results that are clearly processed/prepared/wrong category
  const penalties = ['breaded', 'fried', 'battered', 'stuffed', 'flavored', 'seasoned', 'coated',
    'mix', 'dried', 'canned', 'frozen', 'concentrate', 'imitation', 'spices', 'cayenne'];
  for (const p of penalties) {
    if (desc.includes(p) && !q.includes(p)) score -= 20;
  }

  // Ignore short filler words ("or", "a", "of") in match counting
  const fillerWords = ['or', 'of', 'a', 'an', 'the', 'and', 'in', 'to', 'for', 'with'];
  const meaningfulQueryWords = queryWords.filter((w) => !fillerWords.includes(w));
  if (meaningfulQueryWords.length > 0) {
    const meaningfulMatched = meaningfulQueryWords.filter((w) => desc.includes(w));
    // Overwrite the earlier score component with one that ignores fillers
    score = (meaningfulMatched.length / meaningfulQueryWords.length) * 100;
    if (desc.startsWith(q)) score += 50;
    if (desc.includes(q)) score += 30;
    score -= extraWords.length * 8;
    for (const p of penalties) {
      if (desc.includes(p) && !q.includes(p)) score -= 20;
    }
  }

  // Prefer "raw" or "fresh" versions for basic ingredients
  if (desc.includes('raw') || desc.includes('fresh')) score += 10;

  return score;
}

// A portion from the USDA detail endpoint (e.g., "1 large = 50g", "1 cup = 240g")
type Portion = { modifier: string; gramWeight: number };

type FoodResult = {
  calPer100g: number | null;
  portions: Portion[];
};

const EMPTY_RESULT: FoodResult = { calPer100g: null, portions: [] };

async function fetchPortions(fdcId: number): Promise<Portion[]> {
  try {
    const url = `${DETAIL_URL}/${fdcId}?api_key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.foodPortions ?? [])
      .filter((p: any) => p.gramWeight > 0)
      .map((p: any) => ({
        modifier: (p.modifier ?? '').toLowerCase().trim(),
        gramWeight: p.gramWeight,
      }));
  } catch {
    return [];
  }
}

// Common single-word ingredients that need extra context for USDA search
const SEARCH_HINTS: Record<string, string> = {
  'egg': 'egg whole raw fresh',
  'eggs': 'egg whole raw fresh',
  'butter': 'butter salted',
  'milk': 'milk whole',
  'cream': 'cream heavy',
  'flour': 'wheat flour white all-purpose',
  'rice': 'rice white raw',
  'sugar': 'sugars granulated',
  'honey': 'honey',
  'salt': 'salt table',
  'kosher salt': 'salt table',
  'sea salt': 'salt table',
  'oil': 'vegetable oil',
  'water': 'water tap',
  'coffee': 'coffee brewed',
  'chocolate': 'chocolate dark',
  'cheese': 'cheese cheddar',
  'yogurt': 'yogurt plain whole milk',
  'jalapeno': 'peppers jalapeno raw',
};

async function searchUSDA(query: string, dataType: string): Promise<any[]> {
  const url = `${BASE_URL}?query=${encodeURIComponent(query)}&pageSize=5&dataType=${encodeURIComponent(dataType)}&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.foods ?? [];
}

async function lookupFood(ingredientName: string): Promise<FoodResult> {
  const cleaned = cleanIngredientName(ingredientName);
  if (!API_KEY || !cleaned) return EMPTY_RESULT;

  try {
    // Use search hints for common ingredients that don't search well
    // Check exact match first, then check if cleaned name contains a hint key
    let searchTerm = SEARCH_HINTS[cleaned];
    if (!searchTerm) {
      for (const [key, hint] of Object.entries(SEARCH_HINTS)) {
        if (cleaned === key || cleaned.split(/\s+/).includes(key)) {
          searchTerm = hint;
          break;
        }
      }
    }
    if (!searchTerm) searchTerm = cleaned;

    // Search SR Legacy first (generic whole foods with working detail/portion endpoints)
    let foods = await searchUSDA(searchTerm, 'SR Legacy');

    // If no SR Legacy results, fall back to Branded
    if (foods.length === 0) {
      foods = await searchUSDA(searchTerm, 'Branded');
    }

    if (foods.length === 0) return EMPTY_RESULT;

    // Pick the best matching result
    let bestFood = foods[0];
    let bestScore = -Infinity;
    for (const food of foods) {
      const s = scoreMatch(food.description ?? '', searchTerm);
      if (s > bestScore) {
        bestScore = s;
        bestFood = food;
      }
    }

    // Get calories per 100g
    const energyNutrient = bestFood.foodNutrients?.find(
      (n: any) => n.nutrientName === 'Energy' && n.unitName === 'KCAL'
    );
    const calPer100g = energyNutrient?.value ?? null;

    // Fetch detailed portion data (e.g., "1 large = 50g", "1 cup, chopped = 130g")
    const portions = await fetchPortions(bestFood.fdcId);

    return { calPer100g, portions };
  } catch {
    return EMPTY_RESULT;
  }
}

// Run up to N promises concurrently
async function parallelLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function next(): Promise<void> {
    const idx = i++;
    if (idx >= tasks.length) return;
    results[idx] = await tasks[idx]();
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => next()));
  return results;
}

export async function estimateCalories(ingredients: Ingredient[]): Promise<number | null> {
  if (!API_KEY || ingredients.length === 0) return null;

  const validIngs = ingredients.filter((ing) => ing.item.trim());
  if (validIngs.length === 0) return null;

  const lookups = validIngs.map((ing) => () => lookupFood(ing.item));
  const results = await parallelLimit(lookups, 3);

  let totalCalories = 0;
  let matchedAny = false;

  for (let i = 0; i < validIngs.length; i++) {
    const { calPer100g, portions } = results[i];
    if (calPer100g == null) continue;
    matchedAny = true;
    const grams = estimateGrams(validIngs[i].amount, validIngs[i].unit, validIngs[i].item, portions);
    totalCalories += (calPer100g / 100) * grams;
  }

  if (!matchedAny) return null;
  return Math.round(totalCalories);
}
