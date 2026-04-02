import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Colors } from '../../constants/colors';
import { supabase, Recipe, RecipeFamily } from '../../lib/supabase';
import { useUserRole } from '../../lib/useUserRole';
import FamilyBadge from '../../components/FamilyBadge';

const { width } = Dimensions.get('window');

const FAMILIES: RecipeFamily[] = ["McMichael's", "Knepp's", "Elmore's"];

const CATEGORIES: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Zach's Favorites", icon: 'heart-outline' },
  { label: 'All things Sourdough', icon: 'leaf-outline' },
  { label: 'Pizza', icon: 'pizza-outline' },
  { label: 'Desserts', icon: 'ice-cream-outline' },
  { label: 'Quick & Easy', icon: 'timer-outline' },
  { label: 'The Wok', icon: 'flame-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { isMemberOrAdmin } = useUserRole();
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const scrollPos = useRef(0);

  const CARD_GAP = 8;
  const CARD_WIDTH = (width - 32 - CARD_GAP * 2) / 3;

  useEffect(() => {
    loadRecipes();
  }, []);

  async function loadRecipes() {
    const { data, count } = await supabase
      .from('recipes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (data) {
      setAllRecipes(data);
      setRecentRecipes(data.slice(0, 6));
    }
    if (count !== null) setTotalCount(count);
  }

  // Auto-scroll: slowly shift left, loop when past the first set
  useEffect(() => {
    if (allRecipes.length < 2) return;
    const totalWidth = allRecipes.length * (CARD_WIDTH + CARD_GAP);
    const interval = setInterval(() => {
      scrollPos.current += 1;
      if (scrollPos.current >= totalWidth) {
        scrollPos.current = 0;
        scrollRef.current?.scrollTo({ x: 0, animated: false });
      } else {
        scrollRef.current?.scrollTo({ x: scrollPos.current, animated: false });
      }
    }, 30);
    return () => clearInterval(interval);
  }, [allRecipes.length, CARD_WIDTH]);

  // Duplicate data for seamless looping
  const carouselData = allRecipes.length >= 2
    ? [...allRecipes, ...allRecipes]
    : allRecipes;

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
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => {
                if (searchQuery.trim()) {
                  router.push({ pathname: '/browse', params: { query: searchQuery.trim() } });
                  setSearchQuery('');
                }
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => router.push({ pathname: '/browse', params: { query: searchQuery.trim() } })}>
                <Ionicons name="arrow-forward-circle" size={24} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Web search bar */}
      {Platform.OS === 'web' && (
        <View style={styles.webSearchContainer}>
          <View style={[styles.searchRow, styles.webSearchRow]}>
            <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => {
                if (searchQuery.trim()) {
                  router.push({ pathname: '/browse', params: { query: searchQuery.trim() } });
                  setSearchQuery('');
                }
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => router.push({ pathname: '/browse', params: { query: searchQuery.trim() } })}>
                <Ionicons name="arrow-forward-circle" size={24} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Auto-scrolling Carousel */}
      {allRecipes.length > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={styles.carouselStrip}
          contentContainerStyle={styles.carouselStripContent}
        >
          {carouselData.map((item, index) => (
            <TouchableOpacity
              key={`${item.id}-${index}`}
              style={[styles.carouselCard, { width: CARD_WIDTH, marginRight: CARD_GAP }]}
              onPress={() => router.push(`/recipe/${item.id}`)}
              activeOpacity={0.85}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.carouselCardImage} resizeMode="cover" />
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
              <View style={styles.carouselCardOverlay}>
                <Text style={styles.carouselCardTitle} numberOfLines={1}>{item.title}</Text>
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
                <Text style={styles.statNumber}>{CATEGORIES.length}</Text>
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
              >
                <Ionicons name="people-outline" size={22} color={Colors.primary} />
                <Text style={styles.familyButtonText}>{fam}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <View style={styles.contentWrap}>
          <Text style={styles.sectionTitle}>Explore by Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.label}
                style={styles.categoryCard}
                onPress={() => router.push({ pathname: '/browse', params: { category: cat.label } })}
              >
                <Ionicons name={cat.icon} size={24} color={Colors.primary} style={styles.categoryIcon} />
                <Text style={styles.categoryLabel}>{cat.label}</Text>
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
                >
                  {recipe.image_url ? (
                    <Image source={{ uri: recipe.image_url }} style={styles.recipeCardImage} />
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
                      {[recipe.category, recipe.cuisine].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/browse')}
            >
              <Text style={styles.viewAllText}>View All Recipes</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 McMichael Munchies. Recipes from our home to yours.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrap: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: {
    paddingTop: 60,
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
  webSearchRow: { maxWidth: 900, width: '100%' },

  // Auto-scrolling carousel
  carouselStrip: { marginTop: 12 },
  carouselStripContent: { paddingHorizontal: 16 },
  carouselCard: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
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
  carouselCardTitle: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  carouselPlaceholderContainer: {
    height: 220,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderText: { color: Colors.textSecondary, fontSize: 15 },

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
    marginBottom: 0,
  },
  familyButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  categoryIcon: { marginBottom: 2 },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },

  // Recipe grid
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recipeCard: {
    width: '47%',
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
