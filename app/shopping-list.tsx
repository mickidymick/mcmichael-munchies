import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
import { supabase, ShoppingItem } from '../lib/supabase';
import { useUserRole } from '../lib/useUserRole';

export default function ShoppingListScreen() {
  const colors = useThemeColors();
  const { userId } = useUserRole();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');

  async function loadItems() {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', userId)
      .order('checked', { ascending: true })
      .order('created_at', { ascending: false });
    setItems((data ?? []) as ShoppingItem[]);
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, [userId]);
  useFocusEffect(useCallback(() => { loadItems(); }, [userId]));

  async function addItem() {
    if (!newItem.trim() || !userId) return;
    await supabase.from('shopping_list').insert({ user_id: userId, item: newItem.trim() });
    setNewItem('');
    loadItems();
  }

  async function toggleItem(id: string, checked: boolean) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, checked: !checked } : i));
    await supabase.from('shopping_list').update({ checked: !checked }).eq('id', id);
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from('shopping_list').delete().eq('id', id);
  }

  async function clearChecked() {
    const checkedIds = items.filter((i) => i.checked).map((i) => i.id);
    if (!checkedIds.length) return;
    setItems((prev) => prev.filter((i) => !i.checked));
    await supabase.from('shopping_list').delete().in('id', checkedIds);
  }

  const checkedCount = items.filter((i) => i.checked).length;
  const uncheckedCount = items.length - checkedCount;

  if (!userId) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={56} color={colors.primary} style={{ opacity: 0.4 }} />
        <Text style={styles.emptyTitle}>Shopping List</Text>
        <Text style={styles.emptyText}>Sign in to use your shopping list.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.heading}>Shopping List</Text>
          <View style={styles.headerActions}>
            {checkedCount > 0 && (
              <TouchableOpacity onPress={clearChecked}>
                <Text style={styles.clearText}>Clear checked ({checkedCount})</Text>
              </TouchableOpacity>
            )}
            {items.length > 0 && (
              <TouchableOpacity onPress={async () => {
                const allIds = items.map((i) => i.id);
                setItems([]);
                await supabase.from('shopping_list').delete().in('id', allIds);
              }}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Add item input */}
      <View style={styles.addRow}>
        <View style={styles.addRowInner}>
          <TextInput
            style={styles.addInput}
            placeholder="Add an item..."
            placeholderTextColor={colors.textSecondary}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={addItem}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !newItem.trim() && styles.addBtnDisabled]}
            onPress={addItem}
            disabled={!newItem.trim()}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Your shopping list is empty.</Text>
          <Text style={styles.emptySubtext}>Add items above or tap "Add to Shopping List" on any recipe.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            uncheckedCount > 0 ? (
              <Text style={styles.sectionLabel}>{uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} to get</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <TouchableOpacity
                style={[styles.checkbox, item.checked && styles.checkboxChecked]}
                onPress={() => toggleItem(item.id, item.checked)}
              >
                {item.checked && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </TouchableOpacity>
              <Text style={[styles.itemText, item.checked && styles.itemTextChecked]} numberOfLines={2}>
                {item.item}
              </Text>
              <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
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
  headerActions: { flexDirection: 'row', gap: 16 },
  clearText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  clearAllText: { fontSize: 14, color: Colors.danger, fontWeight: '600' },
  addRow: { paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  addRowInner: {
    flexDirection: 'row',
    gap: 8,
    maxWidth: Layout.maxWidth,
    width: '100%',
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: Colors.border },
  loader: { flex: 1, marginTop: 40 },
  list: { padding: 16 },
  sectionLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8, fontWeight: '500' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: Layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  itemText: { flex: 1, fontSize: 15, color: Colors.text },
  itemTextChecked: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  deleteBtn: { padding: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  emptySubtext: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', maxWidth: 280 },
});
