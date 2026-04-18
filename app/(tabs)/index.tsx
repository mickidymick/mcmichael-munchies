import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Layout } from '../../constants/colors';
import { useThemeColors } from '../../lib/useTheme';
const HEADER_TOP = Layout.headerTop;
import { supabase, Recipe } from '../../lib/supabase';

const HOME_CACHE_KEY = 'home_cache_v1';
import SearchBar from '../../components/SearchBar';
import { useUserRole } from '../../lib/useUserRole';
import { useFavorites } from '../../lib/useFavorites';
import FamilyBadge from '../../components/FamilyBadge';
import LazyImage from '../../components/LazyImage';
import { Image as ExpoImage } from 'expo-image';
import { FAMILIES, CATEGORY_ICONS } from '../../constants/recipes';
import { CarouselSkeleton, HomeGridSkeleton } from '../../components/Skeleton';

const CARD_GAP = 8;

export default function HomeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isMemberOrAdmin } = useUserRole();
  const { isFavorite } = useFavorites();
  const [carouselRecipes, setCarouselRecipes] = useState<Recipe[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const scrollPos = useRef(0);
  const hoveringRef = useRef(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [featuredRecipe, setFeaturedRecipe] = useState<Recipe | null>(null);
  const hasCachedData = useRef(false);
  const initialFetchDone = useRef(false);

  const carouselWidth = Math.min(width, Layout.maxWidth);
  const CARD_WIDTH = (carouselWidth - 32 - CARD_GAP * 2) / 3;

  // On mount: restore cached data instantly, then fetch fresh data
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(HOME_CACHE_KEY);
        if (cached) {
          const { totalCount: tc, carouselRecipes: cr, recentRecipes: rr } = JSON.parse(cached);
          setTotalCount(tc ?? 0);
          setCarouselRecipes(cr ?? []);
          setRecentRecipes(rr ?? []);
          setLoading(false);
          hasCachedData.current = true;
        }
      } catch { /* ignore cache errors */ }
      fetchRecipes();
      initialFetchDone.current = true;
    })();
  }, []);

  // Refresh on focus — but skip the very first mount (already handled above)
  useFocusEffect(
    useCallback(() => {
      if (!initialFetchDone.current) return;
      fetchRecipes();
    }, [])
  );

  async function fetchRecipes() {
    // If we have cached data, skip the loading spinner — refresh silently
    if (!hasCachedData.current) setLoading(true);
    setLoadError(false);
    try {
      const listColumns = 'id,title,image_url,blurhash,family,categories,cuisine,prep_time,cook_time,description,estimated_calories';
      const [countRes, recentRes, carouselRes] = await Promise.all([
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
        supabase.from('recipes').select(listColumns).order('created_at', { ascending: false }).limit(6),
        supabase.from('recipes').select(listColumns).order('created_at', { ascending: false }).limit(10),
      ]);
      if (countRes.error && recentRes.error && carouselRes.error) {
        setLoadError(true);
      } else {
        const newCount = countRes.count ?? 0;
        const newRecent = (recentRes.data ?? []) as Recipe[];
        const newCarousel = (carouselRes.data ?? []) as Recipe[];

        setTotalCount(newCount);
        setRecentRecipes(newRecent);
        setCarouselRecipes(newCarousel);

        // Warm the image cache
        const urls = newCarousel.map((r) => r.image_url).filter(Boolean) as string[];
        if (urls.length) ExpoImage.prefetch(urls).catch(() => { /* ignore */ });

        // Persist for next launch
        AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify({
          totalCount: newCount,
          carouselRecipes: newCarousel,
          recentRecipes: newRecent,
        })).catch(() => { /* ignore */ });

        // Fetch featured recipe of the week
        loadFeaturedRecipe(listColumns);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }

  async function loadFeaturedRecipe(columns: string) {
    try {
      // Check app_settings for admin-set featured recipe
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value,updated_at')
        .eq('key', 'featured_recipe')
        .maybeSingle();

      let recipeId: string | null = null;

      if (setting?.value?.recipe_id) {
        // Check if it's been more than 7 days — auto-rotate
        const updatedAt = new Date(setting.updated_at).getTime();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (updatedAt > weekAgo) {
          recipeId = setting.value.recipe_id;
        }
      }

      if (recipeId) {
        const { data } = await supabase.from('recipes').select(columns).eq('id', recipeId).maybeSingle();
        if (data) { setFeaturedRecipe(data as unknown as Recipe); return; }
      }

      // Auto-select: pick a random recipe
      const { data: rand } = await supabase.from('recipes').select(columns).limit(1).order('created_at', { ascending: false }).range(
        Math.floor(Math.random() * Math.max(totalCount, 1)),
        Math.floor(Math.random() * Math.max(totalCount, 1))
      );
      if (rand?.[0]) setFeaturedRecipe(rand[0] as unknown as Recipe);
    } catch { /* ignore */ }
  }

  async function goToRandomRecipe() {
    try {
      const { count } = await supabase.from('recipes').select('id', { count: 'exact', head: true });
      if (!count) return;
      const offset = Math.floor(Math.random() * count);
      const { data } = await supabase.from('recipes').select('id').range(offset, offset).limit(1);
      if (data?.[0]) router.push(`/recipe/${data[0].id}`);
    } catch { /* ignore */ }
  }

  // Auto-scroll carousel using requestAnimationFrame
  useEffect(() => {
    if (!autoScroll || carouselRecipes.length < 2) return;
    const oneSetWidth = carouselRecipes.length * (CARD_WIDTH + CARD_GAP);
    let rafId: number;
    let lastTime = 0;
    const PIXELS_PER_SECOND = 30;

    function tick(time: number) {
      if (lastTime) {
        const delta = time - lastTime;
        if (!hoveringRef.current) {
          scrollPos.current += (PIXELS_PER_SECOND * delta) / 1000;
          if (scrollPos.current >= oneSetWidth) {
            scrollPos.current -= oneSetWidth;
            scrollRef.current?.scrollTo({ x: scrollPos.current, animated: false });
          } else {
            scrollRef.current?.scrollTo({ x: scrollPos.current, animated: false });
          }
        }
      }
      lastTime = time;
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoScroll, carouselRecipes.length, CARD_WIDTH]);

  const carouselData = useMemo(() =>
    carouselRecipes.length >= 2
      ? [...carouselRecipes, ...carouselRecipes]
      : carouselRecipes,
    [carouselRecipes]
  );

  const cardHoverProps = useCallback((index: number) =>
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => { hoveringRef.current = true; setHoveredCard(index); },
          onMouseLeave: () => { hoveringRef.current = false; setHoveredCard(null); },
        }
      : {}, []);

  function scrollCarousel(direction: 'left' | 'right') {
    const offset = direction === 'left' ? -CARD_WIDTH - CARD_GAP : CARD_WIDTH + CARD_GAP;
    scrollPos.current = Math.max(0, scrollPos.current + offset);
    scrollRef.current?.scrollTo({ x: scrollPos.current, animated: true });
    // Pause auto-scroll briefly after manual nav
    setAutoScroll(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setAutoScroll(true), 4000);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header — mobile only (web uses NavBar) */}
      {Platform.OS !== 'web' && (
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            {isMemberOrAdmin && (
              <TouchableOpacity onPress={() => router.push('/add-recipe')} style={styles.addButton}>
                <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            navigateOnSelect
            onSubmit={() => {
              if (searchQuery.trim()) {
                router.push({ pathname: '/browse', params: { query: searchQuery.trim() } });
                setSearchQuery('');
              }
            }}
          />
        </View>
      )}

      {/* Web search bar */}
      {Platform.OS === 'web' && (
        <View style={styles.webSearchContainer}>
          <View style={styles.webSearchRow}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              navigateOnSelect
              onSubmit={() => {
                if (searchQuery.trim()) {
                  router.push({ pathname: '/browse', params: { query: searchQuery.trim() } });
                  setSearchQuery('');
                }
              }}
            />
          </View>
        </View>
      )}

      {/* Auto-scrolling Carousel */}
      {loading ? (
        <CarouselSkeleton />
      ) : carouselRecipes.length > 0 ? (
        <View style={styles.carouselContainer}>
          {/* Left arrow */}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[styles.carouselArrow, styles.carouselArrowLeft]}
              onPress={() => scrollCarousel('left')}
              accessibilityLabel="Previous recipes"
              activeOpacity={0.7}
              dataSet={{ hover: 'btn' }}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
            style={styles.carouselStrip}
            contentContainerStyle={styles.carouselStripContent}
            decelerationRate="normal"
            onTouchStart={() => {
              setAutoScroll(false);
              if (resumeTimer.current) clearTimeout(resumeTimer.current);
            }}
            onTouchEnd={() => {
              // Small delay to read final scroll position after momentum
              setTimeout(() => {
                if (scrollRef.current) {
                  // @ts-ignore - access underlying DOM scrollLeft on web
                  const el = scrollRef.current as unknown as HTMLElement;
                  if (el?.scrollLeft !== undefined) {
                    scrollPos.current = el.scrollLeft;
                  }
                }
              }, 500);
              resumeTimer.current = setTimeout(() => setAutoScroll(true), 3000);
            }}
            onScroll={(e) => {
              if (!autoScroll) {
                scrollPos.current = e.nativeEvent.contentOffset.x;
              }
            }}
            scrollEventThrottle={100}
          >
            {carouselData.map((item, index) => (
              <TouchableOpacity
                key={`${item.id}-${index}`}
                style={[
                  styles.carouselCard,
                  { width: CARD_WIDTH, marginRight: CARD_GAP },
                  hoveredCard === index && styles.carouselCardHovered,
                ]}
                onPress={() => router.push(`/recipe/${item.id}`)}
                activeOpacity={0.85}
                {...cardHoverProps(index)}
              >
                  {item.image_url ? (
                    <LazyImage source={{ uri: item.image_url }} blurhash={item.blurhash} style={styles.carouselCardImage} contentFit="cover" accessibilityLabel={`Photo of ${item.title}`} />
                  ) : (
                    <View style={[styles.carouselCardImage, styles.carouselCardPlaceholder]}>
                      <Ionicons name="restaurant-outline" size={36} color={colors.primary} style={{ opacity: 0.5 }} />
                      <Text style={styles.placeholderTitle} numberOfLines={2}>{item.title}</Text>
                    </View>
                  )}
                  {item.family && (
                    <View style={styles.carouselBadge}>
                      <FamilyBadge family={item.family} size={26} />
                    </View>
                  )}
                  {isFavorite(item.id) && (
                    <View style={styles.carouselHeart}>
                      <Ionicons name="heart" size={16} color={colors.primary} />
                    </View>
                  )}
                  <View style={[styles.carouselCardOverlay, hoveredCard === index && styles.carouselCardOverlayExpanded]}>
                    <Text style={styles.carouselCardTitle} numberOfLines={hoveredCard === index ? 2 : 1}>{item.title}</Text>
                    {hoveredCard === index && (
                      <>
                        {(item.categories?.length > 0 || item.cuisine) && (
                          <Text style={styles.carouselCardMeta} numberOfLines={1}>
                            {[...(item.categories ?? []), item.cuisine].filter(Boolean).join(' · ')}
                          </Text>
                        )}
                        {(item.prep_time || item.cook_time) && (
                          <Text style={styles.carouselCardMeta}>
                            {(item.prep_time ?? 0) + (item.cook_time ?? 0)} min total
                          </Text>
                        )}
                        {item.description ? (
                          <Text style={styles.carouselCardDesc} numberOfLines={3}>{item.description}</Text>
                        ) : null}
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          {/* Right arrow */}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[styles.carouselArrow, styles.carouselArrowRight]}
              onPress={() => scrollCarousel('right')}
              accessibilityLabel="Next recipes"
              activeOpacity={0.7}
              dataSet={{ hover: 'btn' }}
            >
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          {/* Position dots on mobile */}
          {Platform.OS !== 'web' && carouselRecipes.length > 1 && (
            <View style={styles.dotsRow}>
              {carouselRecipes.map((_, i) => (
                <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.carouselPlaceholderContainer}>
          <Ionicons name="restaurant-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.placeholderText}>Add some recipes to see them here!</Text>
        </View>
      )}

      {loadError && (
        <TouchableOpacity style={styles.errorBanner} onPress={fetchRecipes}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
          <Text style={styles.errorBannerText}>Failed to load recipes. Tap to retry.</Text>
        </TouchableOpacity>
      )}

      {/* Intro */}
      <View style={styles.intro}>
        <View style={styles.contentWrap}>
          <Text style={styles.introTitle}>McMichael Munchies</Text>
          <Text style={styles.introText}>
            Family recipes, personal favorites, and tasty treats from the McMichaels, Murthas, Elmores, and Rosses — all in one place.
          </Text>
          {totalCount > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalCount}</Text>
                <Text style={styles.statLabel}>{totalCount === 1 ? 'Recipe' : 'Recipes'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{FAMILIES.length}</Text>
                <Text style={styles.statLabel}>Families</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{CATEGORY_ICONS.length}</Text>
                <Text style={styles.statLabel}>Categories</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Featured Recipe + Random */}
      {(featuredRecipe || totalCount > 0) && (
        <View style={styles.section}>
          <View style={styles.contentWrap}>
            {featuredRecipe && (
              <>
                <Text style={styles.sectionTitle}>Recipe of the Week</Text>
                <TouchableOpacity
                  style={styles.featuredCard}
                  onPress={() => router.push(`/recipe/${featuredRecipe.id}`)}
                  dataSet={{ hover: 'card' }}
                >
                  {featuredRecipe.image_url ? (
                    <LazyImage
                      source={{ uri: featuredRecipe.image_url }}
                      blurhash={featuredRecipe.blurhash}
                      style={styles.featuredImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.featuredImage, styles.featuredPlaceholder]}>
                      <Ionicons name="restaurant-outline" size={40} color={colors.primary} style={{ opacity: 0.3 }} />
                    </View>
                  )}
                  <View style={styles.featuredOverlay}>
                    <View style={styles.featuredBadge}>
                      <Ionicons name="star" size={12} color={colors.primary} />
                      <Text style={styles.featuredBadgeText}>Featured</Text>
                    </View>
                    <Text style={styles.featuredTitle} numberOfLines={2}>{featuredRecipe.title}</Text>
                    {featuredRecipe.description ? (
                      <Text style={styles.featuredDesc} numberOfLines={2}>{featuredRecipe.description}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </>
            )}
            {totalCount > 1 && (
              <TouchableOpacity
                style={styles.randomBtn}
                onPress={goToRandomRecipe}
                dataSet={{ hover: 'family' }}
              >
                <Ionicons name="shuffle-outline" size={22} color={colors.primary} />
                <Text style={styles.randomBtnText}>Surprise me! Pick a random recipe</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Family Recipes */}
      <View style={styles.section}>
        <View style={styles.contentWrap}>
          <Text style={styles.sectionTitle}>Family Recipes</Text>
          <View style={styles.familyRow}>
            {FAMILIES.map((fam) => (
              <TouchableOpacity
                key={fam}
                style={styles.familyButton}
                onPress={() => router.push({ pathname: '/browse', params: { family: fam, recipe_type: 'family_recipe' } })}
                dataSet={{ hover: 'family' }}
              >
                <Ionicons name="people-outline" size={22} color={colors.primary} />
                <Text style={styles.familyButtonText}>{fam}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.familyButton, styles.favoriteButton]}
              onPress={() => router.push({ pathname: '/browse', params: { recipe_type: 'personal_favorite' } })}
              dataSet={{ hover: 'family' }}
            >
              <Ionicons name="bookmark-outline" size={22} color={colors.primary} />
              <Text style={styles.familyButtonText}>Personal Favorites</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Categories - compact chip style */}
      <View style={styles.section}>
        <View style={styles.contentWrap}>
          <Text style={styles.sectionTitle}>Explore by Category</Text>
          <View style={styles.categoryChipGrid}>
            {CATEGORY_ICONS.map((cat) => (
              <TouchableOpacity
                key={cat.label}
                style={styles.categoryChip}
                onPress={() => router.push({ pathname: '/browse', params: { category: cat.label } })}
                dataSet={{ hover: 'catChip' }}
              >
                <Ionicons name={cat.icon} size={16} color={colors.primary} />
                <Text style={styles.categoryChipLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Recent Recipes */}
      {loading ? (
        <View style={styles.section}>
          <View style={styles.contentWrap}>
            <Text style={styles.sectionTitle}>Recently Added</Text>
            <HomeGridSkeleton />
          </View>
        </View>
      ) : recentRecipes.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.contentWrap}>
            <Text style={styles.sectionTitle}>Recently Added</Text>
            <View style={styles.recipeGrid}>
              {recentRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.recipeCard}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  dataSet={{ hover: 'card' }}
                >
                  <View>
                    {recipe.image_url ? (
                      <LazyImage source={{ uri: recipe.image_url }} blurhash={recipe.blurhash} style={styles.recipeCardImage} contentFit="cover" accessibilityLabel={`Photo of ${recipe.title}`} />
                    ) : (
                      <View style={[styles.recipeCardImage, styles.recipeCardPlaceholder]}>
                        <Ionicons name="restaurant-outline" size={32} color={colors.primary} style={{ opacity: 0.4 }} />
                        <Text style={styles.gridPlaceholderTitle} numberOfLines={1}>{recipe.title}</Text>
                      </View>
                    )}
                    {isFavorite(recipe.id) && (
                      <View style={styles.gridHeart}>
                        <Ionicons name="heart" size={14} color={colors.primary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.recipeCardInfo}>
                    <View style={styles.recipeCardTitleRow}>
                      <FamilyBadge family={recipe.family} size={22} />
                      <Text style={styles.recipeCardTitle} numberOfLines={2}>{recipe.title}</Text>
                    </View>
                    <Text style={styles.recipeCardMeta} numberOfLines={1}>
                      {[...(recipe.categories ?? []), recipe.cuisine].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/browse')}
              dataSet={{ hover: 'btn' }}
            >
              <Text style={styles.viewAllText}>View All Recipes</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>McMichael Munchies. Recipes from our home to yours.</Text>
        <TouchableOpacity onPress={() => router.push('/about')} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>About</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrap: { width: '100%', maxWidth: Layout.maxWidth, alignSelf: 'center' },
  header: {
    paddingTop: HEADER_TOP,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { height: 52, width: 180 },
  addButton: { padding: 4 },
  webSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  webSearchRow: { maxWidth: Layout.maxWidth, width: '100%' },

  // Carousel
  carouselContainer: {
    position: 'relative',
    maxWidth: Layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
    marginTop: 12,
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselArrowLeft: { left: 4 },
  carouselArrowRight: { right: 4 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 18 },
  carouselStrip: {},
  carouselStripContent: { paddingHorizontal: 16 },
  carouselCard: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  carouselCardHovered: {
    transform: [{ scale: 1.12 }],
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  carouselCardImage: { width: '100%', height: '100%' },
  carouselCardPlaceholder: {
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
    paddingHorizontal: 8,
    opacity: 0.7,
  },
  carouselCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  carouselBadge: { position: 'absolute', top: 8, right: 8, zIndex: 2 },
  carouselHeart: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  carouselCardOverlayExpanded: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
  },
  carouselCardTitle: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  carouselCardMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500' },
  carouselCardDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 11, lineHeight: 15, marginTop: 2 },
  carouselPlaceholderContainer: {
    height: 220,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderText: { color: Colors.textSecondary, fontSize: 15 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fdecea',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
  },
  errorBannerText: { fontSize: 14, color: Colors.danger, fontWeight: '500' },

  // Intro
  intro: { paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center' },
  introTitle: {
    fontFamily: 'Pacifico_400Regular',
    fontSize: 32,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  introText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 700,
    alignSelf: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 20,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 24, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.border },

  // Sections
  section: { paddingHorizontal: 20, paddingBottom: 28 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
  },

  // Featured recipe
  featuredCard: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  featuredImage: { width: '100%', height: 180 },
  featuredPlaceholder: { backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  featuredOverlay: { padding: 14, gap: 4 },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '18',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
  },
  featuredBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  featuredTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  featuredDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  randomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  randomBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.primary },

  // Family buttons
  familyRow: { gap: 10 },
  familyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  familyButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  favoriteButton: {
    borderStyle: 'dashed',
    marginTop: 4,
  },

  // Category chips - compact
  categoryChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  categoryChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },

  // Recipe grid
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recipeCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
    maxWidth: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recipeCardImage: { width: '100%', height: 120 },
  gridHeart: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeCardPlaceholder: {
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  gridPlaceholderTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    opacity: 0.6,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  recipeCardInfo: { padding: 10 },
  recipeCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recipeCardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  recipeCardMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },

  // View all
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  viewAllText: { fontSize: 15, fontWeight: '600', color: Colors.primary },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 24, backgroundColor: Colors.footer, gap: 6 },
  footerText: { fontSize: 12, color: Colors.textSecondary },
  footerLink: { paddingVertical: 4 },
  footerLinkText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
});
