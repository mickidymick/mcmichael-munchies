import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase, Collection } from '../lib/supabase';

type Props = {
  visible: boolean;
  recipeId: string;
  userId: string;
  onClose: () => void;
  onDone: (message: string) => void;
};

export default function CollectionPicker({ visible, recipeId, userId, onClose, onDone }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (visible) loadCollections();
  }, [visible]);

  async function loadCollections() {
    setLoading(true);
    const { data } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    setCollections((data ?? []) as Collection[]);
    setLoading(false);
  }

  async function addToCollection(collectionId: string, collectionName: string) {
    const { error } = await supabase
      .from('collection_recipes')
      .insert({ collection_id: collectionId, recipe_id: recipeId });
    if (error?.code === '23505') {
      onDone('Already in this collection');
    } else if (error) {
      onDone('Failed to add to collection');
    } else {
      onDone(`Added to ${collectionName}`);
    }
    onClose();
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from('collections')
      .insert({ user_id: userId, name: newName.trim() })
      .select()
      .single();
    if (error || !data) {
      onDone('Failed to create collection');
      onClose();
      return;
    }
    await addToCollection(data.id, data.name);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add to Collection</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ paddingVertical: 40 }} color={Colors.primary} />
          ) : (
            <>
              <FlatList
                data={collections}
                keyExtractor={(item) => item.id}
                style={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No collections yet. Create one below.</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.collectionRow}
                    onPress={() => addToCollection(item.id, item.name)}
                  >
                    <Ionicons name="book-outline" size={18} color={Colors.primary} />
                    <Text style={styles.collectionName}>{item.name}</Text>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              />

              {showCreate ? (
                <View style={styles.createRow}>
                  <TextInput
                    style={styles.createInput}
                    placeholder="New collection name"
                    placeholderTextColor={Colors.textSecondary}
                    value={newName}
                    onChangeText={setNewName}
                    onSubmitEditing={createAndAdd}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]}
                    onPress={createAndAdd}
                    disabled={!newName.trim()}
                  >
                    <Text style={styles.createBtnText}>Create</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.newCollectionBtn}
                  onPress={() => setShowCreate(true)}
                >
                  <Ionicons name="add" size={18} color={Colors.primary} />
                  <Text style={styles.newCollectionText}>New Collection</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  list: { maxHeight: 300 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', padding: 20 },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  collectionName: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.text },
  createRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  createInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  createBtnDisabled: { backgroundColor: Colors.border },
  createBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  newCollectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  newCollectionText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
