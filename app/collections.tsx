import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
import { supabase, Collection } from '../lib/supabase';
import { useUserRole } from '../lib/useUserRole';
import EmptyState from '../components/EmptyState';

export default function CollectionsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { userId } = useUserRole();
  const [collections, setCollections] = useState<(Collection & { recipe_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  async function loadCollections() {
    const { data } = await supabase
      .from('collections')
      .select('*, collection_recipes(count)')
      .order('created_at', { ascending: false });
    if (data) {
      setCollections(data.map((c: any) => ({
        ...c,
        recipe_count: c.collection_recipes?.[0]?.count ?? 0,
      })));
    }
    setLoading(false);
  }

  useEffect(() => { loadCollections(); }, []);
  useFocusEffect(useCallback(() => { loadCollections(); }, []));

  async function createCollection() {
    if (!newName.trim() || !userId) return;
    await supabase.from('collections').insert({
      user_id: userId,
      name: newName.trim(),
      description: newDesc.trim() || null,
    });
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
    loadCollections();
  }

  if (!userId) {
    return (
      <EmptyState
        icon="book-outline"
        title="Collections"
        description="Sign in to create and view collections."
        actionLabel="Sign In"
        onAction={() => router.push('/profile')}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.heading, { color: colors.text }]}>Collections</Text>
          <TouchableOpacity onPress={() => setShowCreate(!showCreate)}>
            <Ionicons name={showCreate ? 'close' : 'add-circle-outline'} size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {showCreate && (
        <View style={[styles.createCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.createInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Collection name"
            placeholderTextColor={colors.textSecondary}
            value={newName}
            onChangeText={setNewName}
            maxLength={50}
          />
          <TextInput
            style={[styles.createInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textSecondary}
            value={newDesc}
            onChangeText={setNewDesc}
            maxLength={200}
          />
          <TouchableOpacity
            style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]}
            onPress={createCollection}
            disabled={!newName.trim()}
          >
            <Text style={styles.createBtnText}>Create Collection</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && collections.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="No collections yet"
          description="Create a collection to organize your favorite recipes into themed groups."
          actionLabel="Create Collection"
          actionIcon="add-circle-outline"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.collectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/collection/${item.id}`)}
              dataSet={{ hover: 'card' }}
            >
              <View style={styles.collectionIcon}>
                <Ionicons name="book-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.collectionInfo}>
                <Text style={[styles.collectionName, { color: colors.text }]}>{item.name}</Text>
                {item.description && (
                  <Text style={styles.collectionDesc} numberOfLines={1}>{item.description}</Text>
                )}
                <Text style={styles.collectionCount}>
                  {item.recipe_count} recipe{item.recipe_count !== 1 ? 's' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const HEADER_TOP = Layout.headerTop;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: HEADER_TOP,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  headerContent: {
    maxWidth: Layout.maxWidth,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { fontSize: 22, fontWeight: '700', color: Colors.text },
  createCard: {
    margin: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    maxWidth: Layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  createInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createBtnDisabled: { backgroundColor: Colors.border },
  createBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  list: { padding: 16 },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: Layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  collectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionInfo: { flex: 1 },
  collectionName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  collectionDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  collectionCount: { fontSize: 12, color: Colors.primary, fontWeight: '500', marginTop: 2 },
});
