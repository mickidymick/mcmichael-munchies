import { Ingredient } from './supabase';

const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? '';
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// Approximate gram conversions for common cooking units
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

function parseAmount(amount: string): number {
  const trimmed = amount.trim();
  // Handle fractions like "1/2", "3/4"
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
    }
    // Handle mixed like "1 1/2"
    const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) {
      return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
    }
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? 1 : num;
}

function estimateGrams(amount: string, unit: string): number {
  const qty = parseAmount(amount);
  const unitLower = unit.trim().toLowerCase();
  const gramsPerUnit = GRAMS_PER_UNIT[unitLower];
  if (gramsPerUnit) return qty * gramsPerUnit;
  // If no unit or unknown unit, assume it's a "whole" item (~100g)
  return qty * 100;
}

async function lookupCaloriesPer100g(ingredientName: string): Promise<number | null> {
  if (!API_KEY || !ingredientName.trim()) return null;

  try {
    const url = `${BASE_URL}?query=${encodeURIComponent(ingredientName.trim())}&pageSize=1&api_key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const food = data.foods?.[0];
    if (!food) return null;

    // Look for Energy in kcal
    const energyNutrient = food.foodNutrients?.find(
      (n: any) => n.nutrientName === 'Energy' && n.unitName === 'KCAL'
    );

    return energyNutrient?.value ?? null;
  } catch {
    return null;
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

  const lookups = validIngs.map((ing) => () => lookupCaloriesPer100g(ing.item));
  const results = await parallelLimit(lookups, 3);

  let totalCalories = 0;
  let matchedAny = false;

  for (let i = 0; i < validIngs.length; i++) {
    const calPer100g = results[i];
    if (calPer100g == null) continue;
    matchedAny = true;
    const grams = estimateGrams(validIngs[i].amount, validIngs[i].unit);
    totalCalories += (calPer100g / 100) * grams;
  }

  if (!matchedAny) return null;
  return Math.round(totalCalories);
}
