import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecipeFamily = "McMichael's" | "Knepp's" | "Elmore's" | "Ross's";

export type RecipeType = 'family_recipe' | 'personal_favorite';

export type Recipe = {
  id: string;
  title: string;
  description: string;
  notes: string | null;
  image_url: string | null;
  blurhash: string | null;
  is_stock_image?: boolean;
  is_ai_generated?: boolean;
  categories: string[];
  cuisine: string;
  family: RecipeFamily | null;
  recipe_type: RecipeType;
  prep_time: number | null;
  cook_time: number | null;
  servings: string | null;
  estimated_calories: number | null;
  tags: string[];
  ingredients: Ingredient[];
  steps: Step[];
  created_by: string | null;
  created_at: string;
};

export type Ingredient = {
  amount: string;
  unit: string;
  item: string;
};

export type Step = {
  order: number;
  instruction: string;
  image_url?: string;
};

export type UserRole = 'viewer' | 'member' | 'admin';

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  recipe_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { full_name: string; avatar_url?: string | null };
};

export type ShoppingItem = {
  id: string;
  user_id: string;
  item: string;
  checked: boolean;
  recipe_id: string | null;
  created_at: string;
};

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
};
