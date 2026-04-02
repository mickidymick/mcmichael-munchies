import { supabase, Ingredient } from './supabase';

// Cache so we only fetch once per session
let cachedTags: string[] | null = null;
let cachedIngredients: string[] | null = null;

export async function getUniqueTags(): Promise<string[]> {
  if (cachedTags) return cachedTags;

  const { data } = await supabase.from('recipes').select('tags');
  if (!data) return [];

  const tagSet = new Set<string>();
  data.forEach((r: { tags: string[] | null }) =>
    (r.tags ?? []).forEach((t) => tagSet.add(t))
  );
  cachedTags = Array.from(tagSet).sort();
  return cachedTags;
}

export async function getUniqueIngredients(): Promise<string[]> {
  if (cachedIngredients) return cachedIngredients;

  const { data } = await supabase.from('recipes').select('ingredients');
  if (!data) return [];

  const nameSet = new Set<string>();
  data.forEach((r: { ingredients: Ingredient[] | null }) =>
    (r.ingredients ?? []).forEach((ing) => {
      if (ing.item?.trim()) nameSet.add(ing.item.trim().toLowerCase());
    })
  );
  cachedIngredients = Array.from(nameSet).sort();
  return cachedIngredients;
}

export function invalidateAutocompleteCache() {
  cachedTags = null;
  cachedIngredients = null;
}
