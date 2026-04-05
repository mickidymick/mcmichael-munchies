import { supabase, Ingredient } from './supabase';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedTags: { data: string[]; time: number } | null = null;
let cachedIngredients: { data: string[]; time: number } | null = null;

function isValid(cache: { time: number } | null): boolean {
  return cache !== null && Date.now() - cache.time < CACHE_TTL;
}

export async function getUniqueTags(): Promise<string[]> {
  if (isValid(cachedTags)) return cachedTags!.data;

  const { data } = await supabase.from('recipes').select('tags');
  if (!data) return [];

  const tagSet = new Set<string>();
  data.forEach((r: { tags: string[] | null }) =>
    (r.tags ?? []).forEach((t) => tagSet.add(t))
  );
  cachedTags = { data: Array.from(tagSet).sort(), time: Date.now() };
  return cachedTags.data;
}

export async function getUniqueIngredients(): Promise<string[]> {
  if (isValid(cachedIngredients)) return cachedIngredients!.data;

  const { data } = await supabase.from('recipes').select('ingredients');
  if (!data) return [];

  const nameSet = new Set<string>();
  data.forEach((r: { ingredients: Ingredient[] | null }) =>
    (r.ingredients ?? []).forEach((ing) => {
      if (ing.item?.trim()) nameSet.add(ing.item.trim().toLowerCase());
    })
  );
  cachedIngredients = { data: Array.from(nameSet).sort(), time: Date.now() };
  return cachedIngredients.data;
}

export function invalidateAutocompleteCache() {
  cachedTags = null;
  cachedIngredients = null;
}
