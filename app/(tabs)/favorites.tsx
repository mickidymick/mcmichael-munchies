import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Layout } from '../../constants/colors';
import { useThemeColors } from '../../lib/useTheme';
import { supabase, Recipe } from '../../lib/supabase';

const FAVORITES_CACHE_KEY = 'favorites_cache_v1';
import RecipeCard from '../../components/RecipeCard';
import { RecipeCardSkeleton } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import SearchBar from '../../components/SearchBar';
import ChipRow from '../../components/ChipRow';
import { SORT_OPTIONS, FAMILIES, CATEGORIES, CUISINES } from '../../constants/recipes';
import { toggleMulti } from '../../lib/utils';

const HEADER_TOP = Layout.headerTop;

export default function FavoritesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [allFavorites, setAllFavorites] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState('az');
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [error, setError] = useState(false);
  const [staleWarning, setStaleWarning] = useState(false);
  const hasCachedData = useRef(false);

  // Restore cache on mount
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(FAVORITES_CACHE_KEY);
        if (cached) {
          const { favorites, loggedIn: li } = JSON.parse(cached);
          setAllFavorites(favorites ?? []);
          setLoggedIn(li ?? false);
          setLoading(false);
          hasCachedData.current = true;
        }
      } catch { /* ignore */ }
      loadFavorites();
    })();
  }, []);

  const loadFavorites = useCallback(async () => {
    setError(false);
    setStaleWarning(false);
    if (!hasCachedData.current) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      setLoggedIn(true);

      const { data, error: err } = await supabase
        .from('favorites')
        .select('recipe_id, recipes(id,title,image_url,blurhash,family,recipe_type,categories,cuisine,prep_time,cook_time,estimated_calories,tags,created_at)')
        .eq('user_id', user.id);

      if (err) throw err;

      const recipes: Recipe[] = (data ?? [])
        .map((f) => (f as any).recipes as Recipe | null)
        .filter((r): r is Recipe => r !== null);

      setAllFavorites(recipes);
      hasCachedData.current = true;

      AsyncStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify({
        favorites: recipes,
        loggedIn: true,
      })).catch(() => { /* ignore */ });
    } catch {
      // Show stale warning if we have cached data, full error if not
      if (hasCachedData.current) {
        setStaleWarning(true);
      } else {
        setError(true);
      }
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );


  const activeFilterCount = [
    selectedFamilies.length > 0,
    selectedCategories.length > 0,
    selectedCuisines.length > 0,
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    let results = [...allFavorites];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter((r) =>
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q)) ||
        r.ingredients?.some((ing) => ing.item?.toLowerCase().includes(q))
      );
    }

    if (selectedFamilies.length > 0) {
      results = results.filter((r) => r.family && selectedFamilies.includes(r.family));
    }
    if (selectedCategories.length > 0) {
      results = results.filter((r) =>
        selectedCategories.some((cat) => (r.categories ?? []).includes(cat))
      );
    }
    if (selectedCuisines.length > 0) {
      results = results.filter((r) => r.cuisine && selectedCuisines.includes(r.cuisine));
    }

    results.sort((a, b) => {
      switch (selectedSort) {
        case 'newest': return (b.created_at ?? '').localeCompare(a.created_at ?? '');
        case 'oldest': return (a.created_at ?? '').localeCompare(b.created_at ?? '');
        default: return a.title.localeCompare(b.title);
      }
    });

    return results;
  }, [allFavorites, query, selectedFamilies, selectedCategories, selectedCuisines, selectedSort]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.heading, { color: colors.text }]}>Favorites</Text>
          </View>
        </View>
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3].map((i) => <RecipeCardSkeleton key={i} />)}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Connection error"
        description="Failed to load favorites."
        actionLabel="Try again"
        onAction={loadFavorites}
      />
    );
  }

  if (!loggedIn) {
    return (
      <EmptyState
        icon="heart-outline"
        title="Favorites"
        description="Sign in to save your favorite recipes."
        actionLabel="Sign In"
        onAction={() => router.push('/profile')}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
        <Text style={[styles.heading, { color: colors.text }]}>Favorites</Text>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search favorites..."
          navigateOnSelect
        />

        <View style={styles.headerControls}>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterToggle}>
            <Ionicons name="options-outline" size={18} color={showFilters ? colors.primary : colors.text} />
            <Text style={[styles.filterToggleText, showFilters && { color: colors.primary }]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>

          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sortChip, { backgroundColor: colors.background, borderColor: colors.border }, selectedSort === opt.value && styles.sortChipActive]}
                dataSet={{ hover: 'chip' }}
                onPress={() => setSelectedSort(opt.value)}
              >
                <Text style={[styles.sortChipText, { color: colors.text }, selectedSort === opt.value && styles.sortChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            <ChipRow label="Family" items={FAMILIES} selected={selectedFamilies} onToggle={(v) => setSelectedFamilies(toggleMulti(selectedFamilies, v))} />
            <ChipRow label="Category" items={CATEGORIES} selected={selectedCategories} onToggle={(v) => setSelectedCategories(toggleMulti(selectedCategories, v))} />
            <ChipRow label="Cuisine" items={CUISINES} selected={selectedCuisines} onToggle={(v) => setSelectedCuisines(toggleMulti(selectedCuisines, v))} />

            {activeFilterCount > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setSelectedFamilies([]);
                  setSelectedCategories([]);
                  setSelectedCuisines([]);
                }}
              >
                <Text style={styles.clearButtonText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        </View>
      </View>

      {staleWarning && (
        <TouchableOpacity style={[styles.staleBanner, { backgroundColor: colors.secondary }]} onPress={loadFavorites}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.primary} />
          <Text style={styles.staleBannerText}>Showing cached data. Tap to retry.</Text>
        </TouchableOpacity>
      )}

      {filtered.length === 0 ? (
        allFavorites.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No favorites yet"
            description="Tap the heart on any recipe to save it here for quick access."
            actionLabel="Browse Recipes"
            actionIcon="search-outline"
            onAction={() => router.push('/(tabs)/browse')}
          />
        ) : (
          <EmptyState
            icon="heart-outline"
            title="No matches"
            description="No favorites match your current filters."
            actionLabel="Clear all filters"
            onAction={() => {
              setSelectedFamilies([]);
              setSelectedCategories([]);
              setSelectedCuisines([]);
              setQuery('');
            }}
          />
        )
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: colors.textSecondary }]}>{filtered.length} favorite{filtered.length !== 1 ? 's' : ''}</Text>
          }
          ListFooterComponent={
            <View style={[styles.footer, { backgroundColor: colors.footer }]}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>McMichael Munchies. Recipes from our home to yours.</Text>
            </View>
          }
          renderItem={({ item }) => <RecipeCard recipe={item} isFavorited />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  skeletonList: { padding: 16, gap: 12 },
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
  headerContent: { maxWidth: Layout.maxWidth, width: '100%' },
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
  filterToggleText: { fontSize: 14, fontWeight: '600', color: Colors.text },
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
  resultCount: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  list: { padding: 16, gap: 12 },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.secondary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  staleBannerText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  emptyLink: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  footer: { alignItems: 'center', paddingVertical: 24, backgroundColor: Colors.footer },
  footerText: { fontSize: 12, color: Colors.textSecondary },
});
