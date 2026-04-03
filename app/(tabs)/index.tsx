import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';

const HEADER_TOP = Platform.OS === 'web' ? 16 : 60;
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Colors, Layout } from '../../constants/colors';
import { supabase, Recipe } from '../../lib/supabase';
import SearchBar from '../../components/SearchBar';
import { useUserRole } from '../../lib/useUserRole';
import FamilyBadge from '../../components/FamilyBadge';
import { FAMILIES, CATEGORY_ICONS } from '../../constants/recipes';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { isMemberOrAdmin } = useUserRole();
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

  const CARD_GAP = 8;
  const CARD_WIDTH = (width - 32 - CARD_GAP * 2) / 3;

  useEffect(() => {
    loadRecipes();
  }, []);

  async function loadRecipes() {
    setLoading(true);
    setLoadError(false);
    try {
      const [countRes, recentRes, carouselRes] = await Promise.all([
        supabase.from('recipes').select('*', { count: 'exact', head: true }),
        supabase.from('recipes').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('recipes').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      if (countRes.error && recentRes.error && carouselRes.error) {
        setLoadError(true);
      } else {
        if (countRes.count !== null) setTotalCount(countRes.count);
        if (recentRes.data) setRecentRecipes(recentRes.data);
        if (carouselRes.data) setCarouselRecipes(carouselRes.data);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }

  // Auto-scroll carousel - interval only exists when autoScroll is true
  useEffect(() => {
    if (!autoScroll || carouselRecipes.length < 2) return;
    const totalWidth = carouselRecipes.length * (CARD_WIDTH + CARD_GAP);
    const interval = setInterval(() => {
      if (hoveringRef.current) return;
      scrollPos.current += 1;
      if (scrollPos.current >= totalWidth) {
        scrollPos.current = 0;
        scrollRef.current?.scrollTo({ x: 0, animated: false });
      } else {
        scrollRef.current?.scrollTo({ x: scrollPos.current, animated: false });
      }
    }, 30);
    return () => clearInterval(interval);
  }, [autoScroll, carouselRecipes.length, CARD_WIDTH]);

  const carouselData = carouselRecipes.length >= 2
    ? [...carouselRecipes, ...carouselRecipes]
    : carouselRecipes;

  const cardHoverProps = (index: number) =>
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => { hoveringRef.current = true; setHoveredCard(index); },
          onMouseLeave: () => { hoveringRef.current = false; setHoveredCard(null); },
        }
      : {};

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header — mobile only (web uses NavBar) */}
      {Platform.OS !== 'web' && (
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            {isMemberOrAdmin && (
              <TouchableOpacity onPress={() => router.push('/add-recipe')} style={styles.addButton}>
                <Ionicons name="add-circle-outline" size={28} color={Colors.primary} />
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
        <View style={styles.carouselLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : carouselRecipes.length > 0 ? (
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
                  <Image source={{ uri: item.image_url }} style={styles.carouselCardImage} resizeMode="cover" accessibilityLabel={`Photo of ${item.title}`} />
                ) : (
                  <View style={[styles.carouselCardImage, styles.carouselCardPlaceholder]}>
                    <Ionicons name="restaurant-outline" size={28} color={Colors.textSecondary} />
                  </View>
                )}
                {item.family && (
                  <View style={styles.carouselBadge}>
                    <FamilyBadge family={item.family} size={26} />
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
      ) : (
        <View style={styles.carouselPlaceholderContainer}>
          <Ionicons name="restaurant-outline" size={40} color={Colors.textSecondary} />
          <Text style={styles.placeholderText}>Add some recipes to see them here!</Text>
        </View>
      )}

      {loadError && (
        <TouchableOpacity style={styles.errorBanner} onPress={loadRecipes}>
          <Ionicons name="cloud-offline-outline" size={18} color={Colors.danger} />
          <Text style={styles.errorBannerText}>Failed to load recipes. Tap to retry.</Text>
        </TouchableOpacity>
      )}

      {/* Intro */}
      <View style={styles.intro}>
        <View style={styles.contentWrap}>
          <Text style={styles.introTitle}>McMichael Munchies</Text>
          <Text style={styles.introText}>
            Your go-to place for family recipes, personal favorites, and tasty treats — all organized and easy to find. I wanted to create this to be a place where we can save and have easy access to all the amazing food we grew up with, as well as share new and amazing things we have found and created over the years. It contains recipes from the McMichaels, Knepps, and Elmores.
          </Text>
          {totalCount > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalCount}</Text>
                <Text style={styles.statLabel}>{totalCount === 1 ? 'Recipe' : 'Recipes'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>3</Text>
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

      {/* Family Recipes */}
      <View style={styles.section}>
        <View style={styles.contentWrap}>
          <Text style={styles.sectionTitle}>Family Recipes</Text>
          <View style={styles.familyRow}>
            {FAMILIES.map((fam) => (
              <TouchableOpacity
                key={fam}
                style={styles.familyButton}
                onPress={() => router.push({ pathname: '/browse', params: { family: fam } })}
                // @ts-ignore
                dataSet={{ hover: 'family' }}
              >
                <Ionicons name="people-outline" size={22} color={Colors.primary} />
                <Text style={styles.familyButtonText}>{fam}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            ))}
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
                // @ts-ignore
                dataSet={{ hover: 'catChip' }}
              >
                <Ionicons name={cat.icon} size={16} color={Colors.primary} />
                <Text style={styles.categoryChipLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Recent Recipes */}
      {recentRecipes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.contentWrap}>
            <Text style={styles.sectionTitle}>Recently Added</Text>
            <View style={styles.recipeGrid}>
              {recentRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.recipeCard}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  // @ts-ignore
                  dataSet={{ hover: 'card' }}
                >
                  {recipe.image_url ? (
                    <Image source={{ uri: recipe.image_url }} style={styles.recipeCardImage} accessibilityLabel={`Photo of ${recipe.title}`} />
                  ) : (
                    <View style={[styles.recipeCardImage, styles.recipeCardPlaceholder]}>
                      <Ionicons name="restaurant-outline" size={28} color={Colors.textSecondary} />
                    </View>
                  )}
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
              // @ts-ignore
              dataSet={{ hover: 'btn' }}
            >
              <Text style={styles.viewAllText}>View All Recipes</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>McMichael Munchies. Recipes from our home to yours.</Text>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  webSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  webSearchRow: { maxWidth: Layout.maxWidth, width: '100%' },

  // Carousel
  carouselLoading: {
    height: 220,
    backgroundColor: Colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  carouselStrip: { marginTop: 12 },
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
  recipeCardPlaceholder: {
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
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
  footer: { alignItems: 'center', paddingVertical: 24, backgroundColor: Colors.footer },
  footerText: { fontSize: 12, color: Colors.textSecondary },
});
