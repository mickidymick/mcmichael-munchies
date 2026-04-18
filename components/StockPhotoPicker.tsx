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
import { useThemeColors } from '../lib/useTheme';
import { supabase } from '../lib/supabase';

type SpoonacularResult = {
  id: number;
  title: string;
  image: string;
  imageType?: string;
};

type Props = {
  initialQuery: string;
  onSelect: (url: string) => void;
  onCancel: () => void;
};

const PER_PAGE = 6;

// Spoonacular returns image URLs like https://img.spoonacular.com/recipes/{id}-312x231.jpg.
// Swap the size segment to upgrade the saved image to the largest available (636x393).
function upgradeImage(url: string): string {
  return url.replace(/-\d+x\d+\.(jpg|jpeg|png|webp)$/i, '-636x393.$1');
}

export default function StockPhotoPicker({ initialQuery, onSelect, onCancel }: Props) {
  const colors = useThemeColors();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SpoonacularResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/spoonacular-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
        },
        body: JSON.stringify({ query: trimmed, number: PER_PAGE }),
      });
      if (!res.ok) {
        if (res.status === 402) throw new Error('Daily Spoonacular quota reached. Try again tomorrow.');
        throw new Error(`Search failed (${res.status})`);
      }
      const data = await res.json();
      setResults((data.results ?? []).filter((r: SpoonacularResult) => r.image));
    } catch (e: any) {
      setError(e?.message ?? 'Could not fetch photos.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery.trim()) search(initialQuery);
  }, [initialQuery, search]);

  return (
    <View style={styles.overlay}>
      <View style={[styles.modal, { backgroundColor: colors.surface }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Find a stock photo</Text>
          <TouchableOpacity onPress={onCancel} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes..."
            placeholderTextColor={colors.textSecondary}
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
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {!loading && error && (
            <View style={styles.centerState}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !error && searched && results.length === 0 && (
            <View style={styles.centerState}>
              <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No recipes found. Try a different search.</Text>
            </View>
          )}

          {!loading && !error && results.length > 0 && (
            <ScrollView contentContainerStyle={styles.grid}>
              {results.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.gridItem}
                  onPress={() => onSelect(upgradeImage(r.image))}
                  accessibilityLabel={r.title}
                >
                  <Image source={{ uri: r.image }} style={styles.gridImage} />
                  <Text style={[styles.gridCaption, { color: colors.text, backgroundColor: colors.surface }]} numberOfLines={2}>{r.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <TouchableOpacity onPress={() => Linking.openURL('https://spoonacular.com/food-api')}>
          <Text style={styles.attribution}>Powered by spoonacular API</Text>
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
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.border,
  },
  gridImage: { width: '100%', aspectRatio: 16 / 9 } as any,
  gridCaption: { fontSize: 11, color: Colors.text, padding: 6, backgroundColor: Colors.surface },
  attribution: { fontSize: 11, color: Colors.primary, textAlign: 'center', textDecorationLine: 'underline' },
});
