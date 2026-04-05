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
  'fresh', 'frozen', 'dried', 'canned', 'cooked', 'raw', 'uncooked',
  'large', 'medium', 'small', 'extra-large', 'jumbo',
  'organic', 'all-purpose', 'all purpose',
  'finely', 'roughly', 'thinly', 'thickly',
  'peeled', 'deveined', 'trimmed', 'rinsed', 'drained',
  'softened', 'melted', 'room temperature', 'cold', 'warm', 'hot',
  'packed', 'loosely packed', 'firmly packed',
  'to taste', 'optional', 'divided', 'plus more',
  'low-sodium', 'reduced-fat', 'fat-free', 'low-fat', 'whole',
  'unsalted', 'salted',
];

function cleanIngredientName(name: string): string {
  let cleaned = name.toLowerCase().trim();
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

  // Direct unit match in portion modifiers (e.g., unit "cup" matches "cup, chopped")
  for (const p of portions) {
    if (p.modifier.startsWith(unitLower) || p.modifier === unitLower) {
      return p.gramWeight;
    }
  }

  // If unit is empty or a generic count word, look for a per-item portion
  const countUnits = ['', 'whole', 'piece', 'each', 'item'];
  if (countUnits.includes(unitLower)) {
    // Try to match item name in portion modifier (e.g., item "egg" matches "large" or "egg")
    const itemWords = itemLower.split(/\s+/);
    for (const p of portions) {
      for (const word of itemWords) {
        if (p.modifier.includes(word)) return p.gramWeight;
      }
    }
    // Look for common single-item modifiers
    const singleItem = portions.find(
      (p) => p.modifier.includes('medium') || p.modifier.includes('large') ||
             p.modifier === '' || p.modifier.includes('whole')
    );
    if (singleItem) return singleItem.gramWeight;
    // If there's a portion that isn't a cup/tbsp/oz, it's likely a per-item weight
    const perItem = portions.find(
      (p) => !p.modifier.includes('cup') && !p.modifier.includes('tbsp') &&
             !p.modifier.includes('tablespoon') && !p.modifier.includes('oz') &&
             !p.modifier.includes('nlea')
    );
    if (perItem) return perItem.gramWeight;
  }

  // Match "tbsp" to "tablespoon", "tsp" to "teaspoon"
  const unitAliases: Record<string, string[]> = {
    'tbsp': ['tablespoon'],
    'tsp': ['teaspoon'],
    'cup': ['cup'],
    'oz': ['oz'],
  };
  const aliases = unitAliases[unitLower];
  if (aliases) {
    for (const p of portions) {
      for (const alias of aliases) {
        if (p.modifier.includes(alias)) return p.gramWeight;
      }
    }
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
  const queryWords = q.split(/\s+/);

  let score = 0;
  // Exact match is best
  if (desc === q) return 1000;
  // All query words present
  const matchedWords = queryWords.filter((w) => desc.includes(w));
  score += (matchedWords.length / queryWords.length) * 100;
  // Shorter descriptions are usually more generic/accurate
  score -= desc.length * 0.1;
  // Penalize results that are clearly processed/prepared foods
  const penalties = ['breaded', 'fried', 'battered', 'stuffed', 'flavored', 'seasoned', 'coated'];
  for (const p of penalties) {
    if (desc.includes(p) && !q.includes(p)) score -= 20;
  }

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

async function lookupFood(ingredientName: string): Promise<FoodResult> {
  const cleaned = cleanIngredientName(ingredientName);
  if (!API_KEY || !cleaned) return EMPTY_RESULT;

  try {
    // Search SR Legacy and Foundation first (generic whole foods, not branded)
    const url = `${BASE_URL}?query=${encodeURIComponent(cleaned)}&pageSize=5&dataType=SR%20Legacy,Foundation&api_key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return EMPTY_RESULT;

    let data = await res.json();
    let foods = data.foods ?? [];

    // If no SR Legacy/Foundation results, fall back to Branded
    if (foods.length === 0) {
      const brandedUrl = `${BASE_URL}?query=${encodeURIComponent(cleaned)}&pageSize=5&api_key=${API_KEY}`;
      const brandedRes = await fetch(brandedUrl);
      if (!brandedRes.ok) return EMPTY_RESULT;
      data = await brandedRes.json();
      foods = data.foods ?? [];
    }

    if (foods.length === 0) return EMPTY_RESULT;

    // Pick the best matching result
    let bestFood = foods[0];
    let bestScore = -Infinity;
    for (const food of foods) {
      const s = scoreMatch(food.description ?? '', cleaned);
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
