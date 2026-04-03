import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase, Recipe } from '../../lib/supabase';
import RecipeCard from '../../components/RecipeCard';
import ChipRow from '../../components/ChipRow';
import { SORT_OPTIONS, FAMILIES, CATEGORIES, CUISINES } from '../../constants/recipes';
import { toggleMulti } from '../../lib/utils';

const HEADER_TOP = Platform.OS === 'web' ? 16 : 60;

export default function FavoritesScreen() {
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

  const loadFavorites = useCallback(async () => {
    setError(false);
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
        .select('recipe_id, recipes(*)')
        .eq('user_id', user.id);

      if (err) throw err;

      const recipes: Recipe[] = (data ?? [])
        .map((f) => (f as any).recipes as Recipe | null)
        .filter((r): r is Recipe => r !== null);

      setAllFavorites(recipes);
    } catch {
      setError(true);
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
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return a.title.localeCompare(b.title);
      }
    });

    return results;
  }, [allFavorites, query, selectedFamilies, selectedCategories, selectedCuisines, selectedSort]);

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={Colors.primary} />;
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>Failed to load favorites.</Text>
        <TouchableOpacity onPress={loadFavorites}>
          <Text style={styles.emptyLink}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!loggedIn) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={48} color={Colors.textSecondary} />
        <Text style={styles.emptyTitle}>Favorites</Text>
        <Text style={styles.emptyText}>Sign in to save your favorite recipes.</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/profile')}>
          <Text style={styles.emptyBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Favorites</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search favorites..."
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerControls}>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterToggle}>
            <Ionicons name="options-outline" size={18} color={showFilters ? Colors.primary : Colors.text} />
            <Text style={[styles.filterToggleText, showFilters && { color: Colors.primary }]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>

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

      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>
            {allFavorites.length === 0 ? 'No favorites yet.' : 'No favorites match your filters.'}
          </Text>
          {allFavorites.length === 0 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/browse')}>
              <Text style={styles.emptyLink}>Browse recipes</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.resultCount}>{filtered.length} favorite{filtered.length !== 1 ? 's' : ''}</Text>
          }
          renderItem={({ item }) => <RecipeCard recipe={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1 },
  header: {
    paddingTop: HEADER_TOP,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
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
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
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
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  emptyLink: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
