import { Ionicons } from '@expo/vector-icons';
import { RecipeFamily } from '../lib/supabase';

export const CATEGORIES = [
  "Zach's Favorites", 'Breakfast', 'All things Sourdough', 'Pizza',
  'Beef', 'Chicken', 'Pork', 'Seafood',
  'Soups, Stews & Chili', 'Vegetables', 'Salads', 'Pasta & Rice',
  'Sauces, Dips & Dressings', 'Appetizers & Snacks', 'Breads & Baking',
  'Casseroles', 'Desserts', 'Drinks & Cocktails', 'Quick & Easy', 'The Wok', 'Other',
];

export const CATEGORY_ICONS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Zach's Favorites", icon: 'heart-outline' },
  { label: 'Breakfast', icon: 'sunny-outline' },
  { label: 'All things Sourdough', icon: 'leaf-outline' },
  { label: 'Pizza', icon: 'pizza-outline' },
  { label: 'Beef', icon: 'flame-outline' },
  { label: 'Chicken', icon: 'egg-outline' },
  { label: 'Pork', icon: 'bonfire-outline' },
  { label: 'Seafood', icon: 'fish-outline' },
  { label: 'Soups, Stews & Chili', icon: 'water-outline' },
  { label: 'Vegetables', icon: 'nutrition-outline' },
  { label: 'Salads', icon: 'leaf-outline' },
  { label: 'Pasta & Rice', icon: 'grid-outline' },
  { label: 'Sauces, Dips & Dressings', icon: 'color-filter-outline' },
  { label: 'Appetizers & Snacks', icon: 'fast-food-outline' },
  { label: 'Breads & Baking', icon: 'cafe-outline' },
  { label: 'Casseroles', icon: 'layers-outline' },
  { label: 'Desserts', icon: 'ice-cream-outline' },
  { label: 'Drinks & Cocktails', icon: 'beer-outline' },
  { label: 'Quick & Easy', icon: 'timer-outline' },
  { label: 'The Wok', icon: 'flame-outline' },
];

export const FAMILIES: RecipeFamily[] = ["McMichael's", "Knepp's", "Elmore's", "Ross's"];

export const CUISINES = [
  'American', 'Southern', 'Italian', 'Mexican', 'Greek', 'Mediterranean',
  'French', 'Japanese', 'Chinese', 'Thai', 'Korean', 'Indian', 'Other',
];

export const UNITS = [
  '', 'tsp', 'tbsp', 'cup', 'oz', 'fl oz', 'pt', 'qt', 'gal',
  'ml', 'l', 'lb', 'g', 'kg', 'pinch', 'dash', 'piece', 'slice',
  'clove', 'can', 'bag', 'bunch', 'sprig', 'whole',
];

export const SORT_OPTIONS = [
  { label: 'A-Z', value: 'az' },
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
];

export const COOK_TIMES = [
  { label: '< 15 min', value: 'quick' },
  { label: '15-45 min', value: 'medium' },
  { label: '45+ min', value: 'long' },
];

export const DIETARY_TAGS = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'low-carb',
];
