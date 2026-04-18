import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
import { supabase, Recipe } from '../lib/supabase';
import FamilyBadge from '../components/FamilyBadge';

type QueueItem = {
  id: string;
  recipe_id: string;
  created_at: string;
  recipe: Recipe;
};

export default function ReviewQueueScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error: err } = await supabase
        .from('review_queue')
        .select('id, recipe_id, created_at, recipes(id,title,image_url,family,categories,cuisine)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (err) throw err;

      const queue: QueueItem[] = (data ?? [])
        .map((row: any) => ({
          id: row.id,
          recipe_id: row.recipe_id,
          created_at: row.created_at,
          recipe: row.recipes as Recipe,
        }))
        .filter((item) => item.recipe !== null);

      setItems(queue);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  // Reload when screen gets focus (after editing a recipe)
  useFocusEffect(
    useCallback(() => {
      loadQueue();
    }, [loadQueue])
  );

  async function markReviewed(queueId: string) {
    setRemoving(queueId);
    await supabase.from('review_queue').delete().eq('id', queueId);
    setItems((prev) => prev.filter((item) => item.id !== queueId));
    setRemoving(null);
  }

  async function deleteRecipe(queueId: string, recipeId: string, title: string) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Delete "${title}"? This will permanently remove the recipe.`)
      : true;
    if (!confirmed) return;
    setRemoving(queueId);
    await supabase.from('review_queue').delete().eq('id', queueId);
    await supabase.from('recipes').delete().eq('id', recipeId);
    setItems((prev) => prev.filter((item) => item.id !== queueId));
    setRemoving(null);
  }

  async function clearAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Mark all recipes as reviewed?')
      : true;
    if (!confirmed) return;
    await supabase.from('review_queue').delete().eq('user_id', user.id);
    setItems([]);
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>Failed to load review queue.</Text>
        <TouchableOpacity onPress={loadQueue}>
          <Text style={styles.emptyLink}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle-outline" size={64} color={colors.primary} />
        <Text style={styles.emptyTitle}>All caught up!</Text>
        <Text style={styles.emptyText}>No recipes to review. Import some to get started.</Text>
        <View style={styles.emptyButtons}>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/auto-import')}
          >
            <Text style={styles.emptyBtnText}>Auto Import</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emptyBtn, styles.emptyBtnOutline]}
            onPress={() => router.push('/(tabs)/browse')}
          >
            <Text style={[styles.emptyBtnText, styles.emptyBtnOutlineText]}>Browse Recipes</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header info */}
      <View style={styles.infoBar}>
        <View style={styles.infoLeft}>
          <Text style={styles.infoCount}>{items.length}</Text>
          <Text style={styles.infoLabel}>recipe{items.length !== 1 ? 's' : ''} to review</Text>
        </View>
        <TouchableOpacity onPress={clearAll} style={styles.clearAllBtn}>
          <Text style={styles.clearAllText}>Mark All Reviewed</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={styles.card}
            dataSet={{ hover: 'card' }}
          >
            <TouchableOpacity
              style={styles.cardContent}
              onPress={() => router.push(`/recipe/${item.recipe_id}`)}
            >
              {item.recipe.image_url ? (
                <Image
                  source={{ uri: item.recipe.image_url }}
                  style={styles.cardImage}
                  accessibilityLabel={`Photo of ${item.recipe.title}`}
                />
              ) : (
                <View style={[styles.cardImage, styles.imagePlaceholder]}>
                  <Ionicons name="restaurant-outline" size={20} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <View style={styles.cardTitleRow}>
                  <FamilyBadge family={item.recipe.family} size={18} />
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.recipe.title}</Text>
                </View>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {[...(item.recipe.categories ?? []), item.recipe.cuisine].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteRecipe(item.id, item.recipe_id, item.recipe.title)}
                disabled={removing === item.id}
                dataSet={{ hover: 'btn' }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push(`/edit-recipe/${item.recipe_id}`)}
                dataSet={{ hover: 'btn' }}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reviewedBtn}
                onPress={() => markReviewed(item.id)}
                disabled={removing === item.id}
                dataSet={{ hover: 'btn' }}
              >
                {removing === item.id ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                    <Text style={styles.reviewedBtnText}>Reviewed</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  emptyLink: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  emptyButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  emptyBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  emptyBtnOutlineText: { color: Colors.primary },

  // Info bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  infoCount: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  clearAllBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  clearAllText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  // List
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  cardImage: { width: 60, height: 60, borderRadius: 8 },
  imagePlaceholder: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, justifyContent: 'center', gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textSecondary },

  // Card actions
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deleteBtn: {
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  reviewedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
  },
  reviewedBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
