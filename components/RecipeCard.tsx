import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import LazyImage from './LazyImage';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Recipe } from '../lib/supabase';
import FamilyBadge from './FamilyBadge';

type Props = {
  recipe: Recipe;
  isFavorited?: boolean;
};

export default memo(function RecipeCard({ recipe, isFavorited }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`View recipe: ${recipe.title}`}
      // @ts-ignore - RN Web dataSet
      dataSet={{ hover: 'card' }}
    >
      <View style={styles.imageWrap}>
        {recipe.image_url ? (
          <LazyImage
            source={{ uri: recipe.image_url }}
            blurhash={recipe.blurhash}
            style={styles.cardImage}
            contentFit="cover"
            accessibilityLabel={`Photo of ${recipe.title}`}
          />
        ) : (
          <View style={[styles.cardImage, styles.imagePlaceholder]}>
            <Ionicons name="restaurant-outline" size={24} color={Colors.textSecondary} />
          </View>
        )}
        {isFavorited && (
          <View style={styles.heartBadge}>
            <Ionicons name="heart" size={14} color={Colors.primary} />
          </View>
        )}
        {recipe.is_ai_generated ? (
          <View style={styles.stockBadge} accessibilityLabel="AI generated — replace with your own">
            <Ionicons name="sparkles" size={12} color={Colors.textSecondary} />
          </View>
        ) : recipe.is_stock_image ? (
          <View style={styles.stockBadge} accessibilityLabel="Stock photo — replace with your own">
            <MaterialCommunityIcons name="camera-off" size={12} color={Colors.textSecondary} />
          </View>
        ) : null}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <FamilyBadge family={recipe.family} size={20} />
          {recipe.recipe_type === 'personal_favorite' && (
            <View style={styles.typeBadge} accessibilityLabel="Personal Favorite">
              <Ionicons name="bookmark" size={10} color={Colors.primary} />
            </View>
          )}
          <Text style={styles.cardTitle} numberOfLines={1}>{recipe.title}</Text>
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {[...(recipe.categories ?? []), recipe.cuisine].filter(Boolean).join(' · ')}
        </Text>
        {(recipe.prep_time || recipe.cook_time) ? (
          <Text style={styles.cardTime}>
            {((recipe.prep_time ?? 0) + (recipe.cook_time ?? 0))} min
            {recipe.estimated_calories ? ` · ${recipe.estimated_calories} cal` : ''}
          </Text>
        ) : null}
        {recipe.tags?.length > 0 && (
          <Text style={styles.cardTags} numberOfLines={1}>{recipe.tags.slice(0, 3).join(' · ')}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  imageWrap: { width: 120, backgroundColor: Colors.secondary, alignSelf: 'stretch', justifyContent: 'center', borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  cardImage: { width: 120, aspectRatio: 16 / 9 } as any,
  heartBadge: {
    position: 'absolute' as const,
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stockBadge: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  imagePlaceholder: { backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'center', gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textSecondary },
  cardTime: { fontSize: 11, color: Colors.textSecondary },
  cardTags: { fontSize: 11, color: Colors.primary, marginTop: 2 },
});
