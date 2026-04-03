import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase, Profile, UserRole } from '../lib/supabase';
import { useUserRole } from '../lib/useUserRole';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'member', label: 'Member' },
];

type AccessRequest = {
  id: string;
  user_id: string;
  message: string | null;
  status: string;
  created_at: string;
  profile?: { full_name: string } | null;
};

export default function AdminScreen() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/(tabs)');
    }
  }, [roleLoading, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadProfiles();
      loadRequests();
    }
  }, [isAdmin]);

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    setProfiles(data ?? []);
    setLoading(false);
  }

  async function loadRequests() {
    const { data } = await supabase
      .from('access_requests')
      .select('*, profiles(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    const mapped: AccessRequest[] = (data ?? []).map((r: any) => ({
      ...r,
      profile: r.profiles,
    }));
    setRequests(mapped);
  }

  async function changeRole(profileId: string, newRole: UserRole) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, role: newRole } : p))
    );
  }

  async function handleRequest(requestId: string, userId: string, approve: boolean) {
    // Update request status
    await supabase
      .from('access_requests')
      .update({ status: approve ? 'approved' : 'denied' })
      .eq('id', requestId);

    // If approved, upgrade to member
    if (approve) {
      await supabase
        .from('profiles')
        .update({ role: 'member' })
        .eq('id', userId);

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: 'member' as UserRole } : p))
      );
    }

    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  if (roleLoading || loading) {
    return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;
  }

  if (!isAdmin) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          requests.length > 0 ? (
            <View style={styles.requestsSection}>
              <View style={styles.requestsHeader}>
                <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
                <Text style={styles.requestsTitle}>Access Requests ({requests.length})</Text>
              </View>
              {requests.map((req) => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{req.profile?.full_name ?? 'Unknown'}</Text>
                    {req.message && (
                      <Text style={styles.requestMessage}>"{req.message}"</Text>
                    )}
                    <Text style={styles.requestDate}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleRequest(req.id, req.user_id, true)}
                      // @ts-ignore
                      dataSet={{ hover: 'btn' }}
                    >
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.denyBtn}
                      onPress={() => handleRequest(req.id, req.user_id, false)}
                      // @ts-ignore
                      dataSet={{ hover: 'btn' }}
                    >
                      <Ionicons name="close" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.full_name || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.nameColumn}>
                <Text style={styles.name}>{item.full_name || 'No name'}</Text>
                {item.role === 'admin' && (
                  <Text style={styles.adminBadge}>Admin</Text>
                )}
              </View>
            </View>
            {item.role !== 'admin' && (
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.roleChip,
                      item.role === opt.value && styles.roleChipActive,
                    ]}
                    onPress={() => changeRole(item.id, opt.value)}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        item.role === opt.value && styles.roleChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No users found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center' },

  // Access requests
  requestsSection: {
    marginBottom: 20,
  },
  requestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  requestsTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  requestInfo: { flex: 1 },
  requestName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  requestMessage: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  requestDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: 8 },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Member cards
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  nameColumn: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: Colors.text },
  adminBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 2,
  },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleChipText: { fontSize: 14, fontWeight: '500', color: Colors.text },
  roleChipTextActive: { color: '#FFF' },
  empty: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: 40,
    fontSize: 15,
  },
});
