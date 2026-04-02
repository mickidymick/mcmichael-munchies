import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Colors } from '../../constants/colors';
import { supabase, Recipe } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  "Zach's Favorites",
  'All things Sourdough',
  'Pizza',
  'Desserts',
  'Quick & Easy',
  'The Wok',
];

export default function HomeScreen() {
  const router = useRouter();
  const [featured, setFeatured] = useState<Recipe[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<FlatList>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRecipes();
    const interval = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = (prev + 1) % Math.max(featured.length, 1);
        carouselRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [featured.length]);

  async function loadRecipes() {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setFeatured(data.slice(0, 3));
      setRecentRecipes(data);
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header — mobile only (web uses NavBar) */}
      {Platform.OS !== 'web' && (
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <TouchableOpacity onPress={() => router.push('/add-recipe')} style={styles.addButton}>
              <Ionicons name="add-circle-outline" size={28} color={Colors.primary} />
            </TouchableOpacity>
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

      {/* Carousel */}
      {featured.length > 0 ? (
        <View style={styles.carouselContainer}>
          <FlatList
            ref={carouselRef}
            data={featured}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setCarouselIndex(index);
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.carouselSlide}
                onPress={() => router.push(`/recipe/${item.id}`)}
                activeOpacity={0.9}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.carouselImage} />
                ) : (
                  <View style={[styles.carouselImage, styles.carouselPlaceholder]} />
                )}
                <View style={styles.carouselOverlay}>
                  <Text style={styles.carouselTitle}>{item.title}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
          <View style={styles.dots}>
            {featured.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === carouselIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.carouselPlaceholderContainer}>
          <Text style={styles.placeholderText}>Add some recipes to see them here!</Text>
        </View>
      )}

      {/* Intro */}
      <View style={styles.intro}>
        <View style={styles.contentWrap}>
          <Text style={styles.introTitle}>McMichael Munchies</Text>
          <Text style={styles.introText}>
            Your go-to place for family recipes, personal favorites, and tasty treats — all organized and easy to find. I wanted to create this to be a place where we can save and have easy access to all the amazing food we grew up with, as well as share new and amazing things we have found and created over the years. It contains recipes from the McMichaels, Knepps, and Elmores. If there is a great recipe I am missing, let me know so I can add it for everyone to enjoy.
          </Text>
        </View>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <View style={styles.contentWrap}>
          <Text style={styles.sectionTitle}>Explore Recipes</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryCard}
                onPress={() => router.push({ pathname: '/browse', params: { category: cat } })}
              >
                <Text style={styles.categoryLabel}>{cat}</Text>
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
          {recentRecipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.recipeRow}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
            >
              {recipe.image_url ? (
                <Image source={{ uri: recipe.image_url }} style={styles.recipeThumb} />
              ) : (
                <View style={[styles.recipeThumb, styles.thumbPlaceholder]} />
              )}
              <View style={styles.recipeRowInfo}>
                <Text style={styles.recipeRowTitle}>{recipe.title}</Text>
                <Text style={styles.recipeRowMeta}>{recipe.category} · {recipe.cuisine}</Text>
              </View>
            </TouchableOpacity>
          ))}
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 McMichael Munchies. Recipes from our home to yours.</Text>
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
  carouselContainer: { position: 'relative' },
  carouselSlide: { width, height: 220 },
  carouselImage: { width: '100%', height: '100%' },
  carouselPlaceholder: { backgroundColor: Colors.border },
  carouselPlaceholderContainer: {
    height: 180,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: Colors.textSecondary, fontSize: 14 },
  carouselOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  carouselTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary },
  intro: { paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center' },
  introTitle: {
    fontFamily: 'Pacifico_400Regular',
    fontSize: 32,
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  introText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 23, textAlign: 'center' },
  section: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recipeThumb: { width: 72, height: 72 },
  thumbPlaceholder: { backgroundColor: Colors.border },
  recipeRowInfo: { flex: 1, paddingHorizontal: 12 },
  recipeRowTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  recipeRowMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  footer: { alignItems: 'center', paddingVertical: 20, backgroundColor: Colors.footer },
  footerText: { fontSize: 12, color: Colors.textSecondary },
});
