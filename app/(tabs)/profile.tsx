import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../lib/useUserRole';

const HEADER_TOP = Platform.OS === 'web' ? 16 : 60;

WebBrowser.maybeCompleteAuthSession();

type Mode = 'login' | 'signup';

export default function ProfileScreen() {
  const router = useRouter();
  const { role, isAdmin, isMemberOrAdmin } = useUserRole();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Stats
  const [recipesAdded, setRecipesAdded] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Reload stats every time profile tab gets focus
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      supabase
        .from('recipes')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .then(({ count }) => { if (count !== null) setRecipesAdded(count); });

      supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => { if (count !== null) setFavoritesCount(count); });

      supabase
        .from('review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => { if (count !== null) setReviewCount(count); });
    }, [user])
  );

  async function handleLogin() {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Login failed', error.message);
    setSubmitting(false);
  }

  async function handleSignup() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name so the family knows who you are.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) Alert.alert('Signup failed', error.message);
    else Alert.alert('Check your email', 'We sent you a confirmation link.');
    setSubmitting(false);
  }

  async function handleOAuth(provider: 'google') {
    const redirectTo = Platform.OS === 'web'
      ? window.location.origin
      : 'mcmichael-munchies://auth/callback';

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) Alert.alert(`${provider} sign in failed`, error.message);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={Colors.primary} />;
  }

  if (user) {
    const displayName = user.user_metadata?.full_name ?? 'Family Member';
    const memberSince = user.created_at ? formatDate(user.created_at) : null;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.heading}>Profile</Text>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(displayName[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {role === 'admin' ? 'Admin' : role === 'member' ? 'Family Member' : 'Pending Approval'}
            </Text>
          </View>
          {memberSince && (
            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(tabs)/browse')}
            // @ts-ignore
            dataSet={{ hover: 'card' }}
          >
            <Ionicons name="book-outline" size={24} color={Colors.primary} />
            <Text style={styles.statNumber}>{recipesAdded}</Text>
            <Text style={styles.statLabel}>Recipes Added</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(tabs)/favorites')}
            // @ts-ignore
            dataSet={{ hover: 'card' }}
          >
            <Ionicons name="heart-outline" size={24} color={Colors.primary} />
            <Text style={styles.statNumber}>{favoritesCount}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {isMemberOrAdmin && (
            <>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => router.push('/add-recipe')}
                // @ts-ignore
                dataSet={{ hover: 'family' }}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text style={styles.actionTitle}>Add a Recipe</Text>
                  <Text style={styles.actionDesc}>Add a new recipe to the collection</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => router.push('/bulk-import')}
                // @ts-ignore
                dataSet={{ hover: 'family' }}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="documents-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text style={styles.actionTitle}>Bulk Import</Text>
                  <Text style={styles.actionDesc}>Import recipes from a cookbook using Claude</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>

              {reviewCount > 0 && (
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => router.push('/review-queue')}
                  // @ts-ignore
                  dataSet={{ hover: 'family' }}
                >
                  <View style={[styles.actionIcon, { backgroundColor: Colors.primary }]}>
                    <Ionicons name="clipboard-outline" size={22} color="#FFF" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionTitle}>Review Queue</Text>
                    <Text style={styles.actionDesc}>{reviewCount} imported recipe{reviewCount !== 1 ? 's' : ''} to review</Text>
                  </View>
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewBadgeText}>{reviewCount}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/(tabs)/browse')}
            // @ts-ignore
            dataSet={{ hover: 'family' }}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="search-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>Browse Recipes</Text>
              <Text style={styles.actionDesc}>Search and filter all recipes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/(tabs)/favorites')}
            // @ts-ignore
            dataSet={{ hover: 'family' }}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="heart-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitle}>My Favorites</Text>
              <Text style={styles.actionDesc}>View your saved recipes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/admin')}
              // @ts-ignore
              dataSet={{ hover: 'family' }}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="shield-outline" size={22} color={Colors.primary} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={styles.actionTitle}>Manage Members</Text>
                <Text style={styles.actionDesc}>Approve and manage family members</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          // @ts-ignore
          dataSet={{ hover: 'btn' }}
        >
          <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Auth screen ──────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.authContainer}>
        <Text style={styles.authTitle}>McMichael Munchies</Text>
        <Text style={styles.authSubtitle}>
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </Text>

        {/* @ts-ignore */}
        <TouchableOpacity style={styles.oauthButton} onPress={() => handleOAuth('google')} dataSet={{ hover: 'btn' }}>
          <Ionicons name="logo-google" size={20} color="#EA4335" />
          <Text style={styles.oauthText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={Colors.textSecondary}
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={mode === 'login' ? handleLogin : handleSignup}
          disabled={submitting}
          // @ts-ignore
          dataSet={{ hover: 'btn' }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          <Text style={styles.switchText}>
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },
  loader: { flex: 1 },
  header: {
    paddingTop: HEADER_TOP,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heading: { fontSize: 22, fontWeight: '700', color: Colors.text },

  // Profile card
  profileCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, color: '#FFF', fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: Colors.text },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  roleBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
  },
  roleBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  memberSince: { fontSize: 12, color: Colors.textSecondary, marginTop: 8 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  statNumber: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  // Actions
  actionsSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  actionDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reviewBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  reviewBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },

  // Auth
  authContainer: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 12, maxWidth: 420, width: '100%', alignSelf: 'center' },
  authTitle: {
    fontFamily: 'Pacifico_400Regular',
    fontSize: 32,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  authSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  oauthText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 13, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  switchText: {
    textAlign: 'center',
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
