import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Layout } from '../../constants/colors';
const HEADER_TOP = Layout.headerTop;

import { supabase, Recipe } from '../../lib/supabase';
import { escapePostgrestString } from '../../lib/utils';

const BROWSE_CACHE_KEY = 'browse_cache_v1';
import RecipeCard from '../../components/RecipeCard';
import { RecipeCardSkeleton } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { useUserRole } from '../../lib/useUserRole';
import { useFavorites } from '../../lib/useFavorites';
import SearchBar from '../../components/SearchBar';
import ChipRow from '../../components/ChipRow';
import { FAMILIES, CATEGORIES, CUISINES, COOK_TIMES, SORT_OPTIONS, DIETARY_TAGS } from '../../constants/recipes';
import { toggleMulti } from '../../lib/utils';

const PAGE_SIZE = 20;
// Fetch extra to account for client-side filters removing results
const FETCH_SIZE = 40;

export default function BrowseScreen() {
  const router = useRouter();
  const { isMemberOrAdmin } = useUserRole();
  const { isFavorite } = useFavorites();
  const params = useLocalSearchParams<{ category?: string; query?: string; family?: string; recipe_type?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(params.category ? [params.category] : []);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>(params.family ? [params.family] : []);
  const [selectedRecipeTypes, setSelectedRecipeTypes] = useState<string[]>(params.recipe_type ? [params.recipe_type] : []);
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
  const fetchId = useRef(0);
  const hasCachedData = useRef(false);
  const initialFetchDone = useRef(false);
  const isDefaultView = !params.category && !params.query && !params.family && !params.recipe_type;

  // Restore cache for default view
  useEffect(() => {
    if (!isDefaultView) return;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(BROWSE_CACHE_KEY);
        if (cached) {
          const { recipes: cr, totalInDb: t } = JSON.parse(cached);
          setRecipes(cr ?? []);
          setTotalInDb(t ?? 0);
          setLoading(false);
          hasCachedData.current = true;
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    if (params.category && !selectedCategories.includes(params.category)) {
      setSelectedCategories([params.category]);
    }
    if (params.query) setQuery(params.query);
    if (params.family && !selectedFamilies.includes(params.family)) {
      setSelectedFamilies([params.family]);
    }
    if (params.recipe_type && !selectedRecipeTypes.includes(params.recipe_type)) {
      setSelectedRecipeTypes([params.recipe_type]);
    }
  }, [params.category, params.query, params.family, params.recipe_type]);

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
    initialFetchDone.current = true;
  }, [debouncedQuery, selectedCategories, selectedFamilies, selectedRecipeTypes, selectedCuisines, selectedCookTimes, selectedSort, selectedDietary]);

  // Refresh on focus — only when returning to this tab, not on filter changes
  useFocusEffect(
    useCallback(() => {
      if (!initialFetchDone.current) return;
      fetchRecipes(0, true);
    }, [])
  );


  const activeFilterCount = [
    selectedFamilies.length > 0,
    selectedRecipeTypes.length > 0,
    selectedCategories.length > 0,
    selectedCuisines.length > 0,
    selectedCookTimes.length > 0,
    selectedDietary.length > 0,
  ].filter(Boolean).length;

  async function fetchRecipes(pageNum: number, reset: boolean) {
    const currentFetchId = ++fetchId.current;
    if (reset && !hasCachedData.current) setLoading(true);
    else if (!reset) setLoadingMore(true);

    const hasClientFilters = selectedCategories.length > 0 || debouncedQuery.trim() || selectedCookTimes.length > 0 || selectedDietary.length > 0;
    const fetchSize = hasClientFilters ? FETCH_SIZE : PAGE_SIZE;
    const from = pageNum * fetchSize;
    const to = from + fetchSize - 1;

    let req = supabase.from('recipes').select('id,title,description,image_url,blurhash,family,recipe_type,categories,cuisine,prep_time,cook_time,estimated_calories,tags,ingredients,created_at', { count: 'exact' });

    // Server-side filters where possible
    if (selectedFamilies.length === 1) {
      req = req.eq('family', selectedFamilies[0]);
    } else if (selectedFamilies.length > 1) {
      req = req.in('family', selectedFamilies);
    }
    if (selectedRecipeTypes.length === 1) {
      req = req.eq('recipe_type', selectedRecipeTypes[0]);
    } else if (selectedRecipeTypes.length > 1) {
      req = req.in('recipe_type', selectedRecipeTypes);
    }
    if (selectedCuisines.length === 1) {
      req = req.eq('cuisine', selectedCuisines[0]);
    } else if (selectedCuisines.length > 1) {
      req = req.in('cuisine', selectedCuisines);
    }
    // Server-side text search on title/description
    if (debouncedQuery.trim()) {
      const q = escapePostgrestString(debouncedQuery.trim());
      req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Categories is a JSONB array - filter client-side for reliability
    req = req.order('title').range(from, to);

    const { data, count } = await req;
    // Ignore stale responses from superseded fetches
    if (currentFetchId !== fetchId.current) return;
    let results = data ?? [];

    // Client-side category filtering
    if (selectedCategories.length > 0) {
      results = results.filter((r) =>
        selectedCategories.some((cat) => (r.categories ?? []).includes(cat))
      );
    }

    // Client-side search for tags and ingredients (title/description already filtered server-side)
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

    // Sort — use direct string comparison for ISO dates (avoids creating Date objects)
    results.sort((a, b) => {
      switch (selectedSort) {
        case 'newest':
          return (b.created_at ?? '').localeCompare(a.created_at ?? '');
        case 'oldest':
          return (a.created_at ?? '').localeCompare(b.created_at ?? '');
        default:
          return a.title.localeCompare(b.title);
      }
    });

    if (reset) {
      setRecipes(results as Recipe[]);
    } else {
      setRecipes((prev) => [...prev, ...(results as Recipe[])]);
    }

    const totalFromDb = count ?? 0;
    if (reset) setTotalInDb(totalFromDb);
    setHasMore(from + fetchSize < totalFromDb);
    setLoading(false);
    setLoadingMore(false);
    hasCachedData.current = true;

    // Cache the default view (first page, no filters)
    if (reset && pageNum === 0 && isDefaultView) {
      AsyncStorage.setItem(BROWSE_CACHE_KEY, JSON.stringify({
        recipes: results,
        totalInDb: totalFromDb,
      })).catch(() => { /* ignore */ });
    }
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
        <View style={styles.headerContent}>
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
            <ChipRow
              label="Recipe Type"
              items={[{ label: 'Family Recipe', value: 'family_recipe' }, { label: 'Personal Favorite', value: 'personal_favorite' }]}
              selected={selectedRecipeTypes}
              onToggle={(v) => setSelectedRecipeTypes(toggleMulti(selectedRecipeTypes, v))}
            />
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
                  setSelectedRecipeTypes([]);
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
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4].map((i) => <RecipeCardSkeleton key={i} />)}
        </View>
      ) : recipes.length === 0 ? (
        totalInDb === 0 ? (
          <EmptyState
            icon="restaurant-outline"
            title="No recipes yet"
            description={isMemberOrAdmin ? 'Be the first to add a recipe!' : 'Recipes will appear here once members start adding them.'}
            actionLabel={isMemberOrAdmin ? 'Add the first recipe' : undefined}
            actionIcon={isMemberOrAdmin ? 'add-circle-outline' : undefined}
            onAction={isMemberOrAdmin ? () => router.push('/add-recipe') : undefined}
          />
        ) : (
          <EmptyState
            icon="search-outline"
            title="No matches"
            description="No recipes match your current filters."
            actionLabel="Clear all filters"
            onAction={() => {
              setSelectedFamilies([]);
              setSelectedRecipeTypes([]);
              setSelectedCategories([]);
              setSelectedCuisines([]);
              setSelectedCookTimes([]);
              setSelectedDietary([]);
              setQuery('');
            }}
          />
        )
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
            <>
              {loadingMore && <ActivityIndicator style={{ paddingVertical: 16 }} color={Colors.primary} />}
              <View style={styles.footer}>
                <Text style={styles.footerText}>McMichael Munchies. Recipes from our home to yours.</Text>
              </View>
            </>
          }
          renderItem={({ item }) => <RecipeCard recipe={item} isFavorited={isFavorite(item.id)} />}
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
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    maxWidth: Layout.maxWidth,
    width: '100%',
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
  headerContent: { maxWidth: Layout.maxWidth, width: '100%' },
  clearButtonText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  skeletonList: { padding: 16, gap: 12 },
  footer: { alignItems: 'center', paddingVertical: 24, backgroundColor: Colors.footer },
  footerText: { fontSize: 12, color: Colors.textSecondary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
  emptyLink: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  resultCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  list: { padding: 16, gap: 12 },
});
