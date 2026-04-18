import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
import { supabase } from '../lib/supabase';
import { useUserRole } from '../lib/useUserRole';

type AccessRequest = {
  id: string;
  user_id: string;
  message: string | null;
  status: string;
  created_at: string;
  profile: { full_name: string; role: string } | null;
};

export default function PendingRequestsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/(tabs)');
    }
  }, [roleLoading, isAdmin]);

  useEffect(() => {
    if (isAdmin) loadRequests();
  }, [isAdmin]);

  async function loadRequests() {
    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for each request
    const userIds = data.map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const mapped: AccessRequest[] = data.map((r: any) => ({
      ...r,
      profile: profileMap.get(r.user_id) ?? null,
    }));
    setRequests(mapped);
    setLoading(false);
  }

  async function handleRequest(requestId: string, userId: string, approve: boolean) {
    setProcessing(requestId);
    const newStatus = approve ? 'approved' : 'denied';

    // Update all pending requests for this user (handles duplicates)
    const { error: updateError } = await supabase
      .from('access_requests')
      .update({ status: newStatus })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (updateError) {
      alert(`Failed to ${approve ? 'approve' : 'deny'} request: ${updateError.message}`);
      setProcessing(null);
      return;
    }

    if (approve) {
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'member' })
        .eq('id', userId);

      if (roleError) {
        alert(`Request approved but failed to update role: ${roleError.message}`);
      }
    }

    // Remove all requests for this user from local state
    setRequests((prev) => prev.filter((r) => r.user_id !== userId));
    setProcessing(null);
  }

  if (roleLoading || loading) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  if (!isAdmin) return null;

  if (requests.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="checkmark-circle-outline" size={64} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Pending Requests</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>All caught up! New requests will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.infoBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={styles.infoCount}>{requests.length}</Text>
        <Text style={styles.infoLabel}>pending request{requests.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.profile?.full_name?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.text }]}>{item.profile?.full_name ?? 'Unknown'}</Text>
                <Text style={styles.cardDate}>
                  Requested {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </View>

            {item.message && (
              <View style={[styles.messageBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.messageText, { color: colors.text }]}>"{item.message}"</Text>
              </View>
            )}

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.denyBtn}
                onPress={() => handleRequest(item.id, item.user_id, false)}
                disabled={processing === item.id}
                dataSet={{ hover: 'btn' }}
              >
                {processing === item.id ? (
                  <ActivityIndicator color={Colors.danger} size="small" />
                ) : (
                  <>
                    <Ionicons name="close" size={18} color={Colors.danger} />
                    <Text style={styles.denyBtnText}>Deny</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => handleRequest(item.id, item.user_id, true)}
                disabled={processing === item.id}
                dataSet={{ hover: 'btn' }}
              >
                {processing === item.id ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },

  infoBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  infoCount: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },

  list: { padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center', gap: 12 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 18 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  cardDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  messageBox: {
    backgroundColor: Colors.secondary,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 10,
  },
  messageText: { fontSize: 13, color: Colors.text, fontStyle: 'italic' },

  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  denyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  denyBtnText: { fontSize: 14, fontWeight: '600', color: Colors.danger },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
