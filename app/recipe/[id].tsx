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
import { useEffect, useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase, Recipe } from '../../lib/supabase';
import FamilyBadge from '../../components/FamilyBadge';
import Tooltip from '../../components/Tooltip';
import { useUserRole } from '../../lib/useUserRole';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isMemberOrAdmin, userId } = useUserRole();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadRecipe();
    checkFavorite();
  }, [id]);

  async function loadRecipe() {
    setError(false);
    const { data, error: err } = await supabase.from('recipes').select('*').eq('id', id).single();
    if (err) { setError(true); setLoading(false); return; }
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

  async function confirmDelete() {
    setDeleting(true);
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    setDeleting(false);
    if (error) { Alert.alert('Error', error.message); setShowDeleteConfirm(false); return; }
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

  async function handleCopyLink() {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }

  function esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function handlePrint() {
    if (Platform.OS !== 'web' || !recipe) return;
    // Inject print-only styles, then trigger browser print
    const styleId = 'print-recipe-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        #recipe-printable, #recipe-printable * { visibility: visible; }
        #recipe-printable {
          position: absolute; left: 0; top: 0; width: 100%;
          font-family: Georgia, serif; padding: 20px; color: #333;
        }
      }
    `;
    window.print();
  }

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={Colors.primary} />;
  }

  if (error || !recipe) {
    return (
      <View style={styles.loader}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
        <Text style={{ color: Colors.textSecondary, fontSize: 16, marginTop: 12 }}>
          {error ? 'Failed to load recipe.' : 'Recipe not found.'}
        </Text>
        <TouchableOpacity onPress={loadRecipe} style={{ marginTop: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 15 }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 400)}
      scrollEventThrottle={200}
    >
      {/* Hero Image */}
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} style={styles.heroImage} resizeMode="cover" accessibilityLabel={`Photo of ${recipe.title}`} />
      ) : (
        <View style={[styles.heroImage, styles.heroPlaceholder]} />
      )}

      <View style={styles.body} nativeID="recipe-printable">
        {/* Title row */}
        <View style={styles.titleRow}>
          <View style={styles.titleWithBadge}>
            <FamilyBadge family={recipe.family} size={36} />
            <Text style={styles.title}>{recipe.title}</Text>
          </View>
          <View style={styles.titleActions}>
            {Platform.OS === 'web' && (
              <>
                <Tooltip label={linkCopied ? 'Copied!' : 'Copy link'}>
                  <TouchableOpacity onPress={handleCopyLink} style={styles.actionButton}>
                    <Ionicons name={linkCopied ? 'checkmark' : 'link-outline'} size={20} color={linkCopied ? Colors.primary : Colors.textSecondary} />
                  </TouchableOpacity>
                </Tooltip>
                <Tooltip label="Print recipe">
                  <TouchableOpacity onPress={handlePrint} style={styles.actionButton}>
                    <Ionicons name="print-outline" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </Tooltip>
              </>
            )}
            {isMemberOrAdmin && (
              <>
                <Tooltip label="Edit recipe">
                  <TouchableOpacity onPress={() => router.push(`/edit-recipe/${recipe.id}`)} style={styles.actionButton}>
                    <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </Tooltip>
                <Tooltip label="Delete recipe">
                  <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </Tooltip>
              </>
            )}
            <Tooltip label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
              <TouchableOpacity onPress={toggleFavorite} style={styles.favButton}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                size={26}
                color={isFavorite ? Colors.primary : Colors.textSecondary}
              />
            </TouchableOpacity>
            </Tooltip>
          </View>
        </View>

        {/* Meta */}
        <Text style={styles.meta}>{[recipe.family, ...(recipe.categories ?? []), recipe.cuisine].filter(Boolean).join(' · ')}</Text>

        {/* Time & Servings */}
        {(recipe.prep_time || recipe.cook_time || recipe.servings || recipe.estimated_calories) && (
          <View style={styles.infoBar}>
            {recipe.prep_time != null && (
              <View style={styles.infoItem}>
                <Ionicons name="timer-outline" size={18} color={Colors.primary} />
                <Text style={styles.infoLabel}>Prep</Text>
                <Text style={styles.infoValue}>{recipe.prep_time} min</Text>
              </View>
            )}
            {recipe.cook_time != null && (
              <View style={styles.infoItem}>
                <Ionicons name="flame-outline" size={18} color={Colors.primary} />
                <Text style={styles.infoLabel}>Cook</Text>
                <Text style={styles.infoValue}>{recipe.cook_time} min</Text>
              </View>
            )}
            {recipe.servings != null && (
              <View style={styles.infoItem}>
                <Ionicons name="people-outline" size={18} color={Colors.primary} />
                <Text style={styles.infoLabel}>Servings</Text>
                <Text style={styles.infoValue}>{recipe.servings}</Text>
              </View>
            )}
            {recipe.estimated_calories != null && (
              <View style={styles.infoItem}>
                <Ionicons name="nutrition-outline" size={18} color={Colors.primary} />
                <Text style={styles.infoLabel}>Calories</Text>
                <Text style={styles.infoValue}>{recipe.estimated_calories}</Text>
                {recipe.servings != null && recipe.servings > 0 && (
                  <Text style={styles.infoSub}>{Math.round(recipe.estimated_calories / recipe.servings)}/serving</Text>
                )}
              </View>
            )}
          </View>
        )}

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

        {recipe.notes ? (
          <View style={styles.notesBox}>
            <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
            <Text style={styles.notesText}>{recipe.notes}</Text>
          </View>
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
    {showScrollTop && (
      <TouchableOpacity
        style={styles.scrollTopBtn}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        // @ts-ignore
        dataSet={{ hover: 'btn' }}
      >
        <Ionicons name="arrow-up" size={18} color="#FFF" />
      </TouchableOpacity>
    )}
    {showDeleteConfirm && (
      <View style={styles.deleteOverlay}>
        <View style={styles.deleteModal}>
          <Ionicons name="warning-outline" size={40} color={Colors.danger} />
          <Text style={styles.deleteModalTitle}>Delete Recipe?</Text>
          <Text style={styles.deleteModalText}>
            This will permanently delete "{recipe.title}". This cannot be undone.
          </Text>
          <View style={styles.deleteModalButtons}>
            <TouchableOpacity
              style={styles.deleteModalCancel}
              onPress={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              <Text style={styles.deleteModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteModalConfirm}
              onPress={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.deleteModalConfirmText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroImage: { width: '100%', maxWidth: 600, height: 260, alignSelf: 'center', borderRadius: 12 },
  heroPlaceholder: { backgroundColor: Colors.border },
  body: { padding: 20 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  titleWithBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 26, fontWeight: '800', color: Colors.text, lineHeight: 32 },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  actionButton: { padding: 4 },
  favButton: {},
  meta: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  infoBar: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    gap: 16,
    justifyContent: 'center',
  },
  infoItem: { alignItems: 'center', gap: 2, flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 15, color: Colors.text, fontWeight: '700' },
  infoSub: { fontSize: 10, color: Colors.textSecondary },
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
  notesBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
    fontStyle: 'italic',
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
    maxWidth: 600,
    height: 200,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: 'center',
  },
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  deleteModal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    maxWidth: 360,
    width: '90%',
    gap: 8,
  },
  deleteModalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 4 },
  deleteModalText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  deleteModalButtons: { flexDirection: 'row', gap: 12, marginTop: 12, width: '100%' },
  deleteModalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  deleteModalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  deleteModalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    alignItems: 'center',
  },
  deleteModalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  scrollTopBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
});
