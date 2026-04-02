import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase, Recipe, RecipeFamily } from '../../lib/supabase';
import FamilyBadge from '../../components/FamilyBadge';

const FAMILIES: ('All' | RecipeFamily)[] = ["All", "McMichael's", "Knepp's", "Elmore's"];

const CATEGORIES = [
  'All', "Zach's Favorites", 'All things Sourdough', 'Pizza',
  'Desserts', 'Quick & Easy', 'The Wok',
];

const CUISINES = [
  'All', 'American', 'Italian', 'Mexican', 'Japanese', 'Chinese',
  'Indian', 'Comfort Food', 'Other',
];

const COOK_TIMES = [
  { label: 'All', value: 'All' },
  { label: '< 15 min', value: 'quick' },
  { label: '15-45 min', value: 'medium' },
  { label: '45+ min', value: 'long' },
];

const SORT_OPTIONS = [
  { label: 'A-Z', value: 'az' },
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
];

const DIETARY_TAGS = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'low-carb',
];

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; query?: string; family?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [selectedCategory, setSelectedCategory] = useState(params.category ?? 'All');
  const [selectedFamily, setSelectedFamily] = useState(params.family ?? 'All');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [selectedCookTime, setSelectedCookTime] = useState('All');
  const [selectedSort, setSelectedSort] = useState('az');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.category) setSelectedCategory(params.category);
    if (params.query) setQuery(params.query);
    if (params.family) setSelectedFamily(params.family);
  }, [params.category, params.query, params.family]);

  useEffect(() => {
    fetchRecipes();
  }, [query, selectedCategory, selectedFamily, selectedCuisine, selectedCookTime, selectedSort, selectedDietary]);

  function toggleDietary(tag: string) {
    setSelectedDietary((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const activeFilterCount = [
    selectedFamily !== 'All',
    selectedCategory !== 'All',
    selectedCuisine !== 'All',
    selectedCookTime !== 'All',
    selectedDietary.length > 0,
  ].filter(Boolean).length;

  async function fetchRecipes() {
    setLoading(true);
    let req = supabase.from('recipes').select('*');

    if (selectedCategory !== 'All') {
      req = req.eq('category', selectedCategory);
    }
    if (selectedFamily !== 'All') {
      req = req.eq('family', selectedFamily);
    }
    if (selectedCuisine !== 'All') {
      req = req.eq('cuisine', selectedCuisine);
    }

    const { data } = await req.order('title');
    let results = data ?? [];

    // Text search
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter((r) => {
        if (r.title?.toLowerCase().includes(q)) return true;
        if (r.description?.toLowerCase().includes(q)) return true;
        if (r.tags?.some((t: string) => t.toLowerCase().includes(q))) return true;
        if (r.ingredients?.some((ing: any) => ing.item?.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    // Cook time filter
    if (selectedCookTime !== 'All') {
      results = results.filter((r) => {
        const total = (r.prep_time ?? 0) + (r.cook_time ?? 0);
        if (!total) return false;
        if (selectedCookTime === 'quick') return total < 15;
        if (selectedCookTime === 'medium') return total >= 15 && total <= 45;
        if (selectedCookTime === 'long') return total > 45;
        return true;
      });
    }

    // Dietary filter
    if (selectedDietary.length > 0) {
      results = results.filter((r) =>
        selectedDietary.every((diet) =>
          r.tags?.some((t: string) => t.toLowerCase() === diet)
        )
      );
    }

    // Sort
    results.sort((a, b) => {
      switch (selectedSort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'cooktime':
          return ((a.prep_time ?? 0) + (a.cook_time ?? 0)) - ((b.prep_time ?? 0) + (b.cook_time ?? 0));
        case 'calories':
          return (a.estimated_calories ?? 9999) - (b.estimated_calories ?? 9999);
        default:
          return a.title.localeCompare(b.title);
      }
    });

    setRecipes(results);
    setLoading(false);
  }

  function renderChipRow<T extends string>(
    label: string,
    items: (T | { label: string; value: T })[],
    selected: T,
    onSelect: (val: T) => void,
  ) {
    return (
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {items.map((item) => {
            const value = typeof item === 'string' ? item : item.value;
            const label = typeof item === 'string' ? item : item.label;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.chip, selected === value && styles.chipActive]}
                onPress={() => onSelect(value)}
              >
                <Text style={[styles.chipText, selected === value && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Browse Recipes</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes, ingredients, tags..."
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter toggle button */}
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterToggleRow}>
          <Ionicons name="options-outline" size={20} color={showFilters ? Colors.primary : Colors.text} />
          <Text style={[styles.filterToggleText, showFilters && { color: Colors.primary }]}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
          <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Sort row — always visible */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, selectedSort === opt.value && styles.chipActive]}
              onPress={() => setSelectedSort(opt.value)}
            >
              <Text style={[styles.chipText, selectedSort === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Expandable filters */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            {renderChipRow('Family', FAMILIES, selectedFamily as any, setSelectedFamily as any)}
            {renderChipRow('Category', CATEGORIES, selectedCategory, setSelectedCategory)}
            {renderChipRow('Cuisine', CUISINES, selectedCuisine, setSelectedCuisine)}
            {renderChipRow('Cook Time', COOK_TIMES, selectedCookTime, setSelectedCookTime)}

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Dietary</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {DIETARY_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.chip, selectedDietary.includes(tag) && styles.chipActive]}
                    onPress={() => toggleDietary(tag)}
                  >
                    <Text style={[styles.chipText, selectedDietary.includes(tag) && styles.chipTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {activeFilterCount > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setSelectedFamily('All');
                  setSelectedCategory('All');
                  setSelectedCuisine('All');
                  setSelectedCookTime('All');
                  setSelectedDietary([]);
                }}
              >
                <Text style={styles.clearButtonText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      ) : recipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No recipes found.</Text>
          <TouchableOpacity onPress={() => router.push('/add-recipe')}>
            <Text style={styles.emptyLink}>Add the first one →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.resultCount}>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/recipe/${item.id}`)}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, styles.imagePlaceholder]} />
              )}
              <View style={styles.cardInfo}>
                <View style={styles.cardTitleRow}>
                  <FamilyBadge family={item.family} size={20} />
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <Text style={styles.cardMeta}>{[item.category, item.cuisine].filter(Boolean).join(' · ')}</Text>
                {(item.prep_time || item.cook_time) && (
                  <Text style={styles.cardTime}>
                    {((item.prep_time ?? 0) + (item.cook_time ?? 0))} min
                    {item.estimated_calories ? ` · ${item.estimated_calories} cal` : ''}
                  </Text>
                )}
                {item.tags?.length > 0 && (
                  <Text style={styles.cardTags}>{item.tags.slice(0, 3).join(' · ')}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 60,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, height: 40, fontSize: 15, color: Colors.text },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterToggleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  filtersPanel: {
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  filterSection: { marginTop: 8 },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  chipTextActive: { color: '#FFF' },
  clearButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearButtonText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  loader: { flex: 1, marginTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
  emptyLink: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  resultCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardImage: { width: 90, height: 90 },
  imagePlaceholder: { backgroundColor: Colors.border },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'center', gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textSecondary },
  cardTime: { fontSize: 11, color: Colors.textSecondary },
  cardTags: { fontSize: 11, color: Colors.primary, marginTop: 2 },
});
