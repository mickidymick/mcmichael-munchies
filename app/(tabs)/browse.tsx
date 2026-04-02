import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase, Recipe } from '../../lib/supabase';

const CATEGORIES = [
  'All', "Zach's Favorites", 'All things Sourdough', 'Pizza',
  'Desserts', 'Quick & Easy', 'The Wok',
];

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [selectedCategory, setSelectedCategory] = useState(params.category ?? 'All');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.category) setSelectedCategory(params.category);
    if (params.query) setQuery(params.query);
  }, [params.category, params.query]);

  useEffect(() => {
    fetchRecipes();
  }, [query, selectedCategory]);

  async function fetchRecipes() {
    setLoading(true);
    let req = supabase.from('recipes').select('*');

    if (query.trim()) {
      req = req.ilike('title', `%${query.trim()}%`);
    }
    if (selectedCategory !== 'All') {
      req = req.eq('category', selectedCategory);
    }

    const { data } = await req.order('title');
    setRecipes(data ?? []);
    setLoading(false);
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
            placeholder="Search recipes..."
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Category chips */}
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, selectedCategory === item && styles.chipActive]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[styles.chipText, selectedCategory === item && styles.chipTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/recipe/${item.id}`)}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.imagePlaceholder]} />
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{item.category} · {item.cuisine}</Text>
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
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
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
  loader: { flex: 1, marginTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
  emptyLink: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
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
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textSecondary },
  cardTags: { fontSize: 11, color: Colors.primary, marginTop: 2 },
});
