import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecipeFamily = "McMichael's" | "Knepp's" | "Elmore's";

export type Recipe = {
  id: string;
  title: string;
  description: string;
  notes: string | null;
  image_url: string | null;
  categories: string[];
  cuisine: string;
  family: RecipeFamily | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
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
  created_at: string;
};
