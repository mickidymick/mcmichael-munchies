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
import { useEffect, useState, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Share } from 'react-native';
import { Colors, Layout } from '../../constants/colors';
import { supabase, Recipe } from '../../lib/supabase';
import FamilyBadge from '../../components/FamilyBadge';
import Tooltip from '../../components/Tooltip';
import Skeleton from '../../components/Skeleton';
import { useUserRole } from '../../lib/useUserRole';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isMemberOrAdmin, userId } = useUserRole();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [addedByName, setAddedByName] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadRecipe();
  }, [id]);

  // Update page title and OG meta on web when recipe loads
  useEffect(() => {
    if (Platform.OS !== 'web' || !recipe) return;
    const title = `${recipe.title} — McMichael Munchies`;
    document.title = title;

    function setMeta(attr: string, name: string, content: string) {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    }

    setMeta('property', 'og:title', recipe.title);
    setMeta('property', 'og:description', recipe.description || `A recipe from McMichael Munchies`);
    if (recipe.image_url) setMeta('property', 'og:image', recipe.image_url);

    return () => { document.title = 'McMichael Munchies'; };
  }, [recipe]);

  // Refresh recipe data when screen regains focus (e.g. after editing)
  useFocusEffect(
    useCallback(() => {
      loadRecipe();
    }, [id])
  );

  const recipeColumns = 'id,title,description,image_url,blurhash,family,recipe_type,categories,cuisine,prep_time,cook_time,servings,estimated_calories,tags,ingredients,steps,notes,is_ai_generated,is_stock_image,created_by,created_at';

  async function loadRecipe() {
    setError(false);
    // Fetch recipe and check favorite in parallel
    const [recipeRes, userRes] = await Promise.all([
      supabase.from('recipes').select(recipeColumns).eq('id', id).single(),
      supabase.auth.getUser(),
    ]);

    if (recipeRes.error) { setError(true); setLoading(false); return; }
    const data = recipeRes.data;
    setRecipe(data);
    setLoading(false);

    // Fetch profile name and favorite status in parallel
    const user = userRes.data?.user;
    const promises: PromiseLike<void>[] = [];

    if (data?.created_by) {
      promises.push(
        supabase.from('profiles').select('full_name').eq('id', data.created_by).maybeSingle()
          .then(({ data: profile }) => { setAddedByName(profile?.full_name?.trim() || null); })
      );
    } else {
      setAddedByName(null);
    }

    if (user) {
      promises.push(
        supabase.from('favorites').select('id').eq('user_id', user.id).eq('recipe_id', id).maybeSingle()
          .then(({ data: fav }) => { setIsFavorite(!!fav); })
      );
    }

    await Promise.all(promises);
  }

  async function confirmDelete() {
    setDeleting(true);
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    setDeleting(false);
    if (error) { Alert.alert('Error', error.message); setShowDeleteConfirm(false); return; }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  async function toggleFavorite() {
    if (!userId) {
      Alert.alert('Sign in required', 'Sign in to save favorites.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/profile') },
      ]);
      return;
    }
    const wasF = isFavorite;
    const newVal = !wasF;
    // Optimistic update
    setIsFavorite(newVal);
    try {
      if (wasF) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('recipe_id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: userId, recipe_id: id });
        if (error) throw error;
      }
      setToast(newVal ? 'Added to favorites' : 'Removed from favorites');
    } catch {
      // Rollback on failure
      setIsFavorite(wasF);
      setToast('Failed to update favorite');
    }
    setTimeout(() => setToast(''), 2000);
  }

  async function handleShare() {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } else {
      try {
        await Share.share({
          title: recipe?.title ?? 'Recipe',
          message: `Check out ${recipe?.title} on McMichael Munchies!`,
        });
      } catch { /* user cancelled */ }
    }
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
        #recipe-printable, #recipe-printable * { visibility: visible; color: #333 !important; }
        #recipe-printable {
          position: absolute; left: 0; top: 0; width: 100%;
          font-family: Georgia, serif; padding: 24px; color: #333;
          max-width: 700px; margin: 0 auto;
        }
        #recipe-printable img { max-width: 100%; page-break-inside: avoid; }
        #recipe-printable [style*="background"] { background: transparent !important; -webkit-print-color-adjust: exact; }
        h1, h2, h3, p, li { page-break-inside: avoid; orphans: 3; widows: 3; }
      }
    `;
    window.print();
  }

  if (loading) {
    return (
      <View style={styles.outerWrap}>
        <View style={styles.skeletonWrap}>
          <Skeleton width="100%" height={200} borderRadius={12} />
          <View style={styles.skeletonBody}>
            <Skeleton width="70%" height={24} />
            <Skeleton width="50%" height={14} />
            <Skeleton width="100%" height={60} borderRadius={10} />
            <Skeleton width="100%" height={16} />
            <Skeleton width="100%" height={16} />
            <Skeleton width="80%" height={16} />
          </View>
        </View>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.loader}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
        <Text style={styles.errorText}>
          {error ? 'Failed to load recipe.' : 'Recipe not found.'}
        </Text>
        <TouchableOpacity onPress={loadRecipe} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.outerWrap}>
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 400)}
      scrollEventThrottle={200}
    >
      {/* Web back link */}
      {Platform.OS === 'web' && (
        <View style={styles.backRow}>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.canGoBack() ? router.back() : router.push('/(tabs)/browse')}
          >
            <Ionicons name="arrow-back" size={16} color={Colors.primary} />
            <Text style={styles.backLinkText}>Back to recipes</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hero Image */}
      {recipe.image_url ? (
        <View style={styles.heroWrap}>
          <Image source={{ uri: recipe.image_url }} style={styles.heroImage} resizeMode="cover" accessibilityLabel={`Photo of ${recipe.title}`} />
          {recipe.is_ai_generated ? (
            <View style={styles.stockBadge} accessibilityLabel="AI generated — replace with your own">
              <Ionicons name="sparkles" size={14} color={Colors.textSecondary} />
              <Text style={styles.stockBadgeText}>AI generated</Text>
            </View>
          ) : recipe.is_stock_image ? (
            <View style={styles.stockBadge} accessibilityLabel="Stock photo — replace with your own">
              <MaterialCommunityIcons name="camera-off" size={14} color={Colors.textSecondary} />
              <Text style={styles.stockBadgeText}>Stock photo</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.heroImage, styles.heroPlaceholder]}>
          <Ionicons name="restaurant-outline" size={48} color={Colors.primary} style={{ opacity: 0.3 }} />
          <Text style={styles.heroPlaceholderTitle} numberOfLines={2}>{recipe.title}</Text>
        </View>
      )}

      <View style={styles.body} nativeID="recipe-printable">
        {/* Title row */}
        <View style={styles.titleRow}>
          <View style={styles.titleWithBadge}>
            <FamilyBadge family={recipe.family} size={36} />
            <Text style={styles.title}>{recipe.title}</Text>
          </View>
          <View style={styles.titleActions}>
            <Tooltip label={linkCopied ? 'Copied!' : Platform.OS === 'web' ? 'Copy link' : 'Share'}>
              <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
                <Ionicons
                  name={linkCopied ? 'checkmark' : Platform.OS === 'web' ? 'link-outline' : 'share-outline'}
                  size={20}
                  color={linkCopied ? Colors.primary : Colors.textSecondary}
                />
              </TouchableOpacity>
            </Tooltip>
            {Platform.OS === 'web' && (
              <Tooltip label="Print recipe">
                <TouchableOpacity onPress={handlePrint} style={styles.actionButton}>
                  <Ionicons name="print-outline" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </Tooltip>
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

        {(recipe.recipe_type === 'personal_favorite' || addedByName) && (
          <View style={styles.attribution}>
            {recipe.recipe_type === 'personal_favorite' && (
              <View style={styles.favoriteBadge}>
                <Ionicons name="bookmark" size={12} color={Colors.primary} />
                <Text style={styles.favoriteBadgeText}>Personal Favorite</Text>
              </View>
            )}
            {addedByName && (
              <Text style={styles.addedBy}>Added by {addedByName}</Text>
            )}
          </View>
        )}

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
                {recipe.servings != null && (() => {
                  const lower = parseInt(String(recipe.servings), 10);
                  return lower > 0 ? (
                    <Text style={styles.infoSub}>{Math.round(recipe.estimated_calories / lower)}/serving</Text>
                  ) : null;
                })()}
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
        dataSet={{ hover: 'btn' }}
      >
        <Ionicons name="arrow-up" size={18} color="#FFF" />
      </TouchableOpacity>
    )}
    {toast ? (
      <View style={styles.toast}>
        <Text style={styles.toastText}>{toast}</Text>
      </View>
    ) : null}
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
  outerWrap: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: Colors.textSecondary, fontSize: 16, marginTop: 12 },
  retryButton: { marginTop: 12 },
  retryText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  skeletonWrap: { flex: 1, backgroundColor: Colors.background, maxWidth: 700, width: '100%', alignSelf: 'center' },
  skeletonBody: { padding: 20, gap: 14 },
  backRow: { maxWidth: 700, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLinkText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  heroWrap: { width: '100%', maxWidth: 600, alignSelf: 'center', position: 'relative' },
  heroImage: { width: '100%', maxWidth: 600, aspectRatio: 16 / 9, alignSelf: 'center', borderRadius: 12 },
  heroPlaceholder: { backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroPlaceholderTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary, opacity: 0.5, textAlign: 'center', paddingHorizontal: 20 },
  stockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stockBadgeText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  body: { padding: 20, maxWidth: 700, width: '100%', alignSelf: 'center' },
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
  attribution: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  favoriteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  favoriteBadgeText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  addedBy: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
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
    aspectRatio: 16 / 9,
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
  toast: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 50,
  },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
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
