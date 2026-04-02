import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Colors } from '../../constants/colors';
import { supabase, Recipe } from '../../lib/supabase';

export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  async function checkAuthAndLoad() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoggedIn(false);
      setLoading(false);
      return;
    }
    setLoggedIn(true);

    const { data } = await supabase
      .from('favorites')
      .select('recipe_id, recipes(*)')
      .eq('user_id', user.id);

    const recipes = data?.map((f: any) => f.recipes).filter(Boolean) ?? [];
    setFavorites(recipes);
    setLoading(false);
  }

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={Colors.primary} />;
  }

  if (!loggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Favorites</Text>
        <Text style={styles.subtext}>Sign in to save your favorite recipes.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/profile')}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Favorites</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.subtext}>No favorites yet.</Text>
          <TouchableOpacity onPress={() => router.push('/browse')}>
            <Text style={styles.link}>Browse recipes →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/recipe/${item.id}`)}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.imagePlaceholder]} />
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{[item.family, item.category, item.cuisine].filter(Boolean).join(' · ')}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, marginTop: 60 },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heading: { fontSize: 24, fontWeight: '700', color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  subtext: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  link: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardImage: { width: 90, height: 90 },
  imagePlaceholder: { backgroundColor: Colors.border },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'center', gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textSecondary },
});
