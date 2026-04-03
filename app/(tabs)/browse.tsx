import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout } from '../../constants/colors';

const HEADER_TOP = Platform.OS === 'web' ? 16 : 60;
import { supabase, Recipe } from '../../lib/supabase';
import RecipeCard from '../../components/RecipeCard';
import SearchBar from '../../components/SearchBar';
import ChipRow from '../../components/ChipRow';
import { FAMILIES, CATEGORIES, CUISINES, COOK_TIMES, SORT_OPTIONS, DIETARY_TAGS } from '../../constants/recipes';
import { toggleMulti } from '../../lib/utils';

const PAGE_SIZE = 20;
// Fetch extra to account for client-side filters removing results
const FETCH_SIZE = 40;

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; query?: string; family?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(params.category ? [params.category] : []);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>(params.family ? [params.family] : []);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedCookTimes, setSelectedCookTimes] = useState<string[]>([]);
  const [selectedSort, setSelectedSort] = useState('az');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalInDb, setTotalInDb] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    if (params.category && !selectedCategories.includes(params.category)) {
      setSelectedCategories([params.category]);
    }
    if (params.query) setQuery(params.query);
    if (params.family && !selectedFamilies.includes(params.family)) {
      setSelectedFamilies([params.family]);
    }
  }, [params.category, params.query, params.family]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset and fetch when filters change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchRecipes(0, true);
  }, [debouncedQuery, selectedCategories, selectedFamilies, selectedCuisines, selectedCookTimes, selectedSort, selectedDietary]);


  const activeFilterCount = [
    selectedFamilies.length > 0,
    selectedCategories.length > 0,
    selectedCuisines.length > 0,
    selectedCookTimes.length > 0,
    selectedDietary.length > 0,
  ].filter(Boolean).length;

  async function fetchRecipes(pageNum: number, reset: boolean) {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const hasClientFilters = selectedCategories.length > 1 || debouncedQuery.trim() || selectedCookTimes.length > 0 || selectedDietary.length > 0;
    const fetchSize = hasClientFilters ? FETCH_SIZE : PAGE_SIZE;
    const from = pageNum * fetchSize;
    const to = from + fetchSize - 1;

    let req = supabase.from('recipes').select('*', { count: 'exact' });

    // Server-side filters where possible
    if (selectedFamilies.length === 1) {
      req = req.eq('family', selectedFamilies[0]);
    } else if (selectedFamilies.length > 1) {
      req = req.in('family', selectedFamilies);
    }
    if (selectedCuisines.length === 1) {
      req = req.eq('cuisine', selectedCuisines[0]);
    } else if (selectedCuisines.length > 1) {
      req = req.in('cuisine', selectedCuisines);
    }
    // Categories is a JSONB array - filter with contains for single, client-side for multi
    if (selectedCategories.length === 1) {
      req = req.contains('categories', [selectedCategories[0]]);
    }

    req = req.order('title').range(from, to);

    const { data, count } = await req;
    let results = data ?? [];

    // Client-side filtering for things Supabase can't do efficiently
    if (selectedCategories.length > 1) {
      results = results.filter((r) =>
        selectedCategories.some((cat) => (r.categories ?? []).includes(cat))
      );
    }

    // Text search
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      results = results.filter((r) => {
        if (r.title?.toLowerCase().includes(q)) return true;
        if (r.description?.toLowerCase().includes(q)) return true;
        if (r.tags?.some((t: string) => t.toLowerCase().includes(q))) return true;
        if (r.ingredients?.some((ing: any) => ing.item?.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    // Cook time filter
    if (selectedCookTimes.length > 0) {
      results = results.filter((r) => {
        const total = (r.prep_time ?? 0) + (r.cook_time ?? 0);
        if (!total) return false;
        return selectedCookTimes.some((ct) => {
          if (ct === 'quick') return total < 15;
          if (ct === 'medium') return total >= 15 && total <= 45;
          if (ct === 'long') return total > 45;
          return false;
        });
      });
    }

    // Dietary filter
    if (selectedDietary.length > 0) {
      results = results.filter((r) =>
        selectedDietary.some((diet) =>
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
        default:
          return a.title.localeCompare(b.title);
      }
    });

    if (reset) {
      setRecipes(results);
    } else {
      setRecipes((prev) => [...prev, ...results]);
    }

    const totalFromDb = count ?? 0;
    if (reset) setTotalInDb(totalFromDb);
    setHasMore(from + fetchSize < totalFromDb);
    setLoading(false);
    setLoadingMore(false);
  }

  function loadMore() {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRecipes(nextPage, false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Browse Recipes</Text>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search recipes, ingredients, tags..."
          navigateOnSelect
        />

        <View style={styles.headerControls}>
          {/* Filter toggle */}
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterToggle}>
            <Ionicons name="options-outline" size={18} color={showFilters ? Colors.primary : Colors.text} />
            <Text style={[styles.filterToggleText, showFilters && { color: Colors.primary }]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>

          {/* Sort chips inline */}
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sortChip, selectedSort === opt.value && styles.sortChipActive]}
                // @ts-ignore
                dataSet={{ hover: 'chip' }}
                onPress={() => setSelectedSort(opt.value)}
              >
                <Text style={[styles.sortChipText, selectedSort === opt.value && styles.sortChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Expandable filters */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            <ChipRow label="Family" items={FAMILIES} selected={selectedFamilies} onToggle={(v) => setSelectedFamilies(toggleMulti(selectedFamilies, v))} />
            <ChipRow label="Category" items={CATEGORIES} selected={selectedCategories} onToggle={(v) => setSelectedCategories(toggleMulti(selectedCategories, v))} />
            <ChipRow label="Cuisine" items={CUISINES} selected={selectedCuisines} onToggle={(v) => setSelectedCuisines(toggleMulti(selectedCuisines, v))} />
            <ChipRow label="Cook Time" items={COOK_TIMES} selected={selectedCookTimes} onToggle={(v) => setSelectedCookTimes(toggleMulti(selectedCookTimes, v))} />
            <ChipRow label="Dietary" items={DIETARY_TAGS} selected={selectedDietary} onToggle={(v) => setSelectedDietary(toggleMulti(selectedDietary, v))} />

            {activeFilterCount > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setSelectedFamilies([]);
                  setSelectedCategories([]);
                  setSelectedCuisines([]);
                  setSelectedCookTimes([]);
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
          <Ionicons name="search-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>
            {totalInDb === 0 ? 'No recipes yet.' : 'No recipes match your filters.'}
          </Text>
          {totalInDb === 0 ? (
            <TouchableOpacity onPress={() => router.push('/add-recipe')}>
              <Text style={styles.emptyLink}>Add the first one</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => {
              setSelectedFamilies([]);
              setSelectedCategories([]);
              setSelectedCuisines([]);
              setSelectedCookTimes([]);
              setSelectedDietary([]);
              setQuery('');
            }}>
              <Text style={styles.emptyLink}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.resultCount}>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}{hasMore ? '+' : ''}</Text>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ paddingVertical: 16 }} color={Colors.primary} /> : null
          }
          renderItem={({ item }) => <RecipeCard recipe={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: HEADER_TOP,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingBottom: 4,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  sortRow: { flexDirection: 'row', gap: 6 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortChipText: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  sortChipTextActive: { color: '#FFF' },
  filtersPanel: {
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
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
});
