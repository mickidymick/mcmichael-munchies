// Backup of the Pixabay-based StockPhotoPicker, kept in case we want to swap back.
// Not imported anywhere — to use, replace components/StockPhotoPicker.tsx with this file's contents.

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

type PixabayHit = {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  user: string;
};

type Props = {
  initialQuery: string;
  onSelect: (url: string) => void;
  onCancel: () => void;
};

const PIXABAY_KEY = process.env.EXPO_PUBLIC_PIXABAY_API_KEY ?? '';
const PER_PAGE = 6;

export default function StockPhotoPicker({ initialQuery, onSelect, onCancel }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<PixabayHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (!PIXABAY_KEY) {
      setError('Pixabay API key is not configured. Add EXPO_PUBLIC_PIXABAY_API_KEY to your .env file.');
      setSearched(true);
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(trimmed)}&image_type=photo&category=food&per_page=${PER_PAGE}&safesearch=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setHits(data.hits ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Could not fetch photos.');
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery.trim()) search(initialQuery);
  }, [initialQuery, search]);

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Find a stock photo</Text>
          <TouchableOpacity onPress={onCancel} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search food photos..."
            placeholderTextColor={Colors.textSecondary}
            onSubmitEditing={() => search(query)}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => search(query)}
            disabled={loading || !query.trim()}
          >
            <Ionicons name="search" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.resultsArea}>
          {loading && (
            <View style={styles.centerState}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}

          {!loading && error && (
            <View style={styles.centerState}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !error && searched && hits.length === 0 && (
            <View style={styles.centerState}>
              <Ionicons name="image-outline" size={32} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No photos found. Try a different search.</Text>
            </View>
          )}

          {!loading && !error && hits.length > 0 && (
            <ScrollView contentContainerStyle={styles.grid}>
              {hits.map((hit) => (
                <TouchableOpacity
                  key={hit.id}
                  style={styles.gridItem}
                  onPress={() => onSelect(hit.largeImageURL)}
                  accessibilityLabel={`Photo by ${hit.user}`}
                >
                  <Image source={{ uri: hit.webformatURL }} style={styles.gridImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <TouchableOpacity onPress={() => Linking.openURL('https://pixabay.com/')}>
          <Text style={styles.attribution}>Powered by Pixabay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '94%',
    maxWidth: 720,
    maxHeight: '90%',
    gap: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsArea: { minHeight: 240, maxHeight: 480 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, minHeight: 240 },
  errorText: { fontSize: 14, color: Colors.danger, textAlign: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' },
  gridItem: {
    width: '32%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.border,
  },
  gridImage: { width: '100%', height: '100%' } as any,
  attribution: { fontSize: 11, color: Colors.primary, textAlign: 'center', textDecorationLine: 'underline' },
});
