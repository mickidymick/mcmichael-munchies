import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase, Ingredient } from '../lib/supabase';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  navigateOnSelect?: boolean;
  onSubmit?: () => void;
};

type Suggestion = {
  type: 'recipe' | 'ingredient' | 'tag';
  label: string;
  id?: string;
};

let cachedSuggestions: Suggestion[] | null = null;

async function loadSuggestions(): Promise<Suggestion[]> {
  if (cachedSuggestions) return cachedSuggestions;

  const { data } = await supabase
    .from('recipes')
    .select('id, title, tags, ingredients');

  if (!data) return [];

  const suggestions: Suggestion[] = [];
  const ingredientSet = new Set<string>();
  const tagSet = new Set<string>();

  for (const recipe of data) {
    suggestions.push({ type: 'recipe', label: recipe.title, id: recipe.id });

    ((recipe.ingredients as Ingredient[]) ?? []).forEach((ing) => {
      const item = ing.item?.trim().toLowerCase();
      if (item && !ingredientSet.has(item)) {
        ingredientSet.add(item);
        suggestions.push({ type: 'ingredient', label: item });
      }
    });

    ((recipe.tags as string[]) ?? []).forEach((tag) => {
      const t = tag.trim().toLowerCase();
      if (t && !tagSet.has(t)) {
        tagSet.add(t);
        suggestions.push({ type: 'tag', label: t });
      }
    });
  }

  cachedSuggestions = suggestions;
  return suggestions;
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  recipe: 'restaurant-outline',
  ingredient: 'nutrition-outline',
  tag: 'pricetag-outline',
};

export default function SearchBar({ value, onChangeText, placeholder, navigateOnSelect, onSubmit }: Props) {
  const router = useRouter();
  const [allSuggestions, setAllSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSuggestions().then(setAllSuggestions);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = query.length >= 2
    ? allSuggestions.filter((s) => s.label.toLowerCase().includes(query)).slice(0, 8)
    : [];

  function handleSelect(item: Suggestion) {
    if (item.type === 'recipe' && item.id && navigateOnSelect) {
      router.push(`/recipe/${item.id}`);
    } else {
      onChangeText(item.label);
    }
    setFocused(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder ?? 'Search recipes...'}
          placeholderTextColor={Colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => { blurTimeout.current = setTimeout(() => setFocused(false), 200); }}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {focused && filtered.length > 0 && (
        <View style={styles.dropdown}>
          {filtered.map((item, i) => (
            <TouchableOpacity
              key={`${item.type}-${item.label}-${i}`}
              style={styles.suggestion}
              onPress={() => {
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                handleSelect(item);
              }}
            >
              <Ionicons name={ICONS[item.type]} size={14} color={Colors.textSecondary} />
              <Text style={styles.suggestionText} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.suggestionType}>{item.type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 50 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 40,
  },
  icon: { marginRight: 6 },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionText: { flex: 1, fontSize: 14, color: Colors.text },
  suggestionType: { fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize' },
});
