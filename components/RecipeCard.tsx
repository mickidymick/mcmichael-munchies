import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Recipe } from '../lib/supabase';
import FamilyBadge from './FamilyBadge';

type Props = {
  recipe: Recipe;
};

export default memo(function RecipeCard({ recipe }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      // @ts-ignore - RN Web dataSet
      dataSet={{ hover: 'card' }}
    >
      {recipe.image_url ? (
        <Image
          source={{ uri: recipe.image_url }}
          style={styles.cardImage}
          resizeMode="cover"
          accessibilityLabel={`Photo of ${recipe.title}`}
        />
      ) : (
        <View style={[styles.cardImage, styles.imagePlaceholder]}>
          <Ionicons name="restaurant-outline" size={24} color={Colors.textSecondary} />
        </View>
      )}
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <FamilyBadge family={recipe.family} size={20} />
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
  },
  cardImage: { width: 90, height: 90 },
  imagePlaceholder: { backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'center', gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textSecondary },
  cardTime: { fontSize: 11, color: Colors.textSecondary },
  cardTags: { fontSize: 11, color: Colors.primary, marginTop: 2 },
});
