import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase, Recipe } from '../../lib/supabase';
import { useUserRole } from '../../lib/useUserRole';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isMemberOrAdmin, userId } = useUserRole();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    loadRecipe();
    checkFavorite();
  }, [id]);

  async function loadRecipe() {
    const { data } = await supabase.from('recipes').select('*').eq('id', id).single();
    setRecipe(data);
    setLoading(false);
  }

  async function checkFavorite() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('recipe_id', id)
      .maybeSingle();
    setIsFavorite(!!data);
  }

  async function handleDelete() {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this recipe? This cannot be undone.')
      : await new Promise<boolean>((resolve) =>
          Alert.alert(
            'Delete Recipe',
            'Are you sure you want to delete this recipe? This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        );

    if (!confirmed) return;
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) { Alert.alert('Error', error.message); return; }
    router.replace('/(tabs)');
  }

  async function toggleFavorite() {
    if (!userId) {
      Alert.alert('Sign in required', 'Sign in to save favorites.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/profile') },
      ]);
      return;
    }
    if (isFavorite) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('recipe_id', id);
    } else {
      await supabase.from('favorites').insert({ user_id: userId, recipe_id: id });
    }
    setIsFavorite(!isFavorite);
  }

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={Colors.primary} />;
  }

  if (!recipe) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: Colors.textSecondary }}>Recipe not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Image */}
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} style={styles.heroImage} />
      ) : (
        <View style={[styles.heroImage, styles.heroPlaceholder]} />
      )}

      <View style={styles.body}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{recipe.title}</Text>
          <View style={styles.titleActions}>
            {isMemberOrAdmin && (
              <>
                <TouchableOpacity onPress={() => router.push(`/edit-recipe/${recipe.id}`)} style={styles.editButton}>
                  <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={styles.editButton}>
                  <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={toggleFavorite} style={styles.favButton}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={26}
                color={isFavorite ? Colors.primary : Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Meta */}
        <Text style={styles.meta}>{recipe.category} · {recipe.cuisine}</Text>
        {recipe.tags?.length > 0 && (
          <View style={styles.tags}>
            {recipe.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}

        {/* Ingredients */}
        {recipe.ingredients?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ing, i) => (
              <View key={i} style={styles.ingredient}>
                <View style={styles.bullet} />
                <Text style={styles.ingredientText}>
                  {[ing.amount, ing.unit, ing.item].filter(Boolean).join(' ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Steps */}
        {recipe.steps?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.steps
              .sort((a, b) => a.order - b.order)
              .map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepText}>{step.instruction}</Text>
                    {step.image_url && (
                      <Image source={{ uri: step.image_url }} style={styles.stepImage} />
                    )}
                  </View>
                </View>
              ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroImage: { width: '100%', height: 260 },
  heroPlaceholder: { backgroundColor: Colors.border },
  body: { padding: 20 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  title: { flex: 1, fontSize: 26, fontWeight: '800', color: Colors.text, lineHeight: 32 },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  editButton: { padding: 4 },
  favButton: {},
  meta: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag: {
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
    marginBottom: 20,
  },
  section: { marginTop: 8, marginBottom: 20 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  ingredient: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 7,
  },
  ingredientText: { flex: 1, fontSize: 15, color: Colors.text, lineHeight: 22 },
  step: { flexDirection: 'row', marginBottom: 20, gap: 14 },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  stepNumberText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  stepContent: { flex: 1 },
  stepText: { fontSize: 15, color: Colors.text, lineHeight: 23 },
  stepImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
  },
});
