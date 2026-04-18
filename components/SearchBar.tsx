import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback, createElement } from 'react';
import { createPortal } from 'react-dom';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
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

export function invalidateSearchCache() {
  cachedSuggestions = null;
}

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
  const colors = useThemeColors();
  const router = useRouter();
  const [allSuggestions, setAllSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<View>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const suggestionsLoaded = useRef(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  function ensureSuggestions() {
    if (suggestionsLoaded.current) return;
    suggestionsLoaded.current = true;
    setSuggestionsLoading(true);
    loadSuggestions().then(setAllSuggestions).finally(() => setSuggestionsLoading(false));
  }

  const query = value.trim().toLowerCase();
  const filtered = query.length >= 2
    ? allSuggestions.filter((s) => s.label.toLowerCase().includes(query)).slice(0, 8)
    : [];

  const [highlightIndex, setHighlightIndex] = useState(-1);
  const showLoading = focused && suggestionsLoading && query.length >= 2;
  const showDropdown = focused && filtered.length > 0 && !suggestionsLoading;

  // Reset highlight when filtered results change
  useEffect(() => { setHighlightIndex(-1); }, [filtered.length]);

  // Measure input position for portal dropdown
  const measureInput = useCallback(() => {
    if (Platform.OS !== 'web' || !inputRef.current) return;
    const el = inputRef.current as unknown as HTMLElement;
    if (!el?.getBoundingClientRect) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (showDropdown) measureInput();
  }, [showDropdown, measureInput]);

  function handleSelect(item: Suggestion) {
    if (item.type === 'recipe' && item.id && navigateOnSelect) {
      router.push(`/recipe/${item.id}`);
    } else {
      onChangeText(item.label);
    }
    setFocused(false);
  }

  const dropdownContent = showDropdown && dropdownPos ? (
    createElement('div', {
      style: {
        position: 'fixed' as const,
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 99999,
        backgroundColor: '#fff',
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        overflow: 'hidden',
      },
    },
    filtered.map((item, i) =>
      createElement('div', {
        key: `${item.type}-${item.label}-${i}`,
        style: {
          display: 'flex',
          flexDirection: 'row' as const,
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderBottom: i < filtered.length - 1 ? `1px solid ${colors.border}` : 'none',
          cursor: 'pointer',
          backgroundColor: i === highlightIndex ? colors.secondary : 'transparent',
        },
        onMouseDown: (e: any) => {
          e.preventDefault();
          handleSelect(item);
        },
      },
        createElement(Ionicons, { name: ICONS[item.type], size: 14, color: colors.textSecondary }),
        createElement('span', { style: { flex: 1, fontSize: 14, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.label),
        createElement('span', { style: { fontSize: 11, color: colors.textSecondary, textTransform: 'capitalize' } }, item.type),
      )
    ))
  ) : null;

  return (
    <View style={styles.container}>
      <View ref={inputRef} style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder ?? 'Search recipes...'}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => { setFocused(true); ensureSuggestions(); measureInput(); }}
          onBlur={() => { blurTimeout.current = setTimeout(() => setFocused(false), 200); }}
          onKeyPress={(e: any) => {
            if (!showDropdown) return;
            const key = e.nativeEvent?.key ?? e.key;
            if (key === 'ArrowDown') {
              e.preventDefault?.();
              setHighlightIndex((prev) => (prev + 1) % filtered.length);
            } else if (key === 'ArrowUp') {
              e.preventDefault?.();
              setHighlightIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
            } else if (key === 'Enter' && highlightIndex >= 0) {
              e.preventDefault?.();
              handleSelect(filtered[highlightIndex]);
            } else if (key === 'Escape') {
              setFocused(false);
            }
          }}
          onSubmitEditing={() => {
            if (showDropdown && highlightIndex >= 0) {
              handleSelect(filtered[highlightIndex]);
            } else {
              onSubmit?.();
            }
          }}
          returnKeyType="search"
          accessibilityLabel="Search recipes"
          accessibilityRole="search"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')} accessibilityLabel="Clear search" accessibilityRole="button">
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {Platform.OS === 'web' && showLoading && dropdownPos
        ? createPortal(
            createElement('div', {
              style: {
                position: 'fixed' as const,
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 99999,
                backgroundColor: '#fff',
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '12px',
                textAlign: 'center',
                fontSize: 13,
                color: colors.textSecondary,
              },
            }, 'Loading suggestions...'),
            document.body
          )
        : null}
      {Platform.OS === 'web' && dropdownContent
        ? createPortal(dropdownContent, document.body)
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
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
});
