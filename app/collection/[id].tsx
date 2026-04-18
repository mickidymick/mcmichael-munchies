import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout } from '../../constants/colors';
import { useThemeColors } from '../../lib/useTheme';
import { supabase, Recipe, Collection } from '../../lib/supabase';
import { useUserRole } from '../../lib/useUserRole';
import { useFavorites } from '../../lib/useFavorites';
import RecipeCard from '../../components/RecipeCard';
import EmptyState from '../../components/EmptyState';

export default function CollectionDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useUserRole();
  const { isFavorite } = useFavorites();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCollection() {
    const [colRes, recipesRes] = await Promise.all([
      supabase.from('collections').select('*').eq('id', id).single(),
      supabase.from('collection_recipes')
        .select('recipe_id, recipes(id,title,image_url,blurhash,family,recipe_type,categories,cuisine,prep_time,cook_time,estimated_calories,tags,created_at)')
        .eq('collection_id', id)
        .order('added_at', { ascending: false }),
    ]);
    if (colRes.data) setCollection(colRes.data as Collection);
    if (recipesRes.data) {
      setRecipes(
        recipesRes.data
          .map((r: any) => r.recipes as Recipe | null)
          .filter((r): r is Recipe => r !== null)
      );
    }
    setLoading(false);
  }

  useEffect(() => { loadCollection(); }, [id]);
  useFocusEffect(useCallback(() => { loadCollection(); }, [id]));

  async function removeRecipe(recipeId: string) {
    await supabase.from('collection_recipes').delete()
      .eq('collection_id', id)
      .eq('recipe_id', recipeId);
    setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
  }

  async function deleteCollection() {
    Alert.alert('Delete Collection', `Delete "${collection?.name}"? Recipes won't be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('collections').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  const isOwner = collection?.user_id === userId;

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  if (!collection) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Not found"
        description="This collection doesn't exist."
        actionLabel="Back"
        onAction={() => router.back()}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          {Platform.OS === 'web' && (
            <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.push('/collections')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          <View style={styles.headerText}>
            <Text style={[styles.heading, { color: colors.text }]}>{collection.name}</Text>
            {collection.description && (
              <Text style={[styles.subheading, { color: colors.textSecondary }]}>{collection.description}</Text>
            )}
          </View>
          {isOwner && (
            <TouchableOpacity onPress={deleteCollection}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {recipes.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="Empty collection"
          description="Add recipes from the recipe detail page."
          actionLabel="Browse Recipes"
          actionIcon="search-outline"
          onAction={() => router.push('/(tabs)/browse')}
        />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.count}>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</Text>
          }
          renderItem={({ item }) => (
            <View>
              <RecipeCard recipe={item} isFavorited={isFavorite(item.id)} />
              {isOwner && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeRecipe(item.id)}
                >
                  <Ionicons name="close-circle-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.removeText}>Remove from collection</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const HEADER_TOP = Layout.headerTop;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: HEADER_TOP,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  headerContent: {
    maxWidth: Layout.maxWidth,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  heading: { fontSize: 22, fontWeight: '700', color: Colors.text },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  list: { padding: 16, gap: 12 },
  count: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  removeText: { fontSize: 12, color: Colors.textSecondary },
});
