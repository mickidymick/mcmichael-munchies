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
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Colors, Layout } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../lib/useUserRole';
import UserAvatar from '../../components/UserAvatar';
import { useTheme, useThemeColors } from '../../lib/useTheme';

const HEADER_TOP = Layout.headerTop;

WebBrowser.maybeCompleteAuthSession();

type Mode = 'login' | 'signup';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { role, isAdmin, isMemberOrAdmin, refresh: refreshRole } = useUserRole();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
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
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  // Access request
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'denied' | 'sending'>('none');
  const [requestMessage, setRequestMessage] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Real-time subscription for access requests so admin sees new requests immediately
    const channel = supabase
      .channel('access-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, () => {
        refreshStats();
      })
      .subscribe();

    return () => {
      listener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  async function refreshStats() {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;
      const [recipesRes, favoritesRes, reviewRes, pendingRes, requestRes] = await Promise.all([
        supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('created_by', currentUser.id),
        supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
        supabase.from('review_queue').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
        supabase.from('access_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('access_requests').select('status').eq('user_id', currentUser.id).in('status', ['pending', 'denied']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (recipesRes.count !== null) setRecipesAdded(recipesRes.count);
      if (favoritesRes.count !== null) setFavoritesCount(favoritesRes.count);
      if (reviewRes.count !== null) setReviewCount(reviewRes.count);
      if (pendingRes.count !== null) setPendingRequestCount(pendingRes.count);
      if (requestRes.data) setRequestStatus(requestRes.data.status as 'pending' | 'denied');
      else setRequestStatus('none');

      // Load avatar
      const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('id', currentUser.id).maybeSingle();
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    } catch { /* silently keep stale stats on network error */ }
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !user) return;
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = blob.type?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      const path = `avatar-${user.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('recipe-images')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (uploadErr) { Alert.alert('Upload failed', uploadErr.message); return; }
      const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(path);
      const url = urlData.publicUrl + '?t=' + Date.now(); // bust cache
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      setAvatarUrl(url);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload image.');
    }
  }

  // Reload stats and role every time profile tab gets focus
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      refreshRole();
      refreshStats();
    }, [user])
  );

  async function handleRequestAccess() {
    if (!user) return;
    setRequestStatus('sending');
    const { error } = await supabase.from('access_requests').insert({
      user_id: user.id,
      message: requestMessage.trim() || null,
    });
    if (error) {
      Alert.alert('Error', error.message);
      setRequestStatus('none');
    } else {
      setRequestStatus('pending');
      setRequestMessage('');
      Alert.alert('Request Sent', 'Your access request has been submitted. You will be notified when an admin reviews it.');
    }
  }

  const [authMessage, setAuthMessage] = useState('');

  function showMessage(msg: string) {
    setAuthMessage(msg);
  }


  async function handleLogin() {
    setAuthMessage('');
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        showMessage('Please check your email and click the confirmation link before signing in.');
      } else {
        showMessage(error.message);
      }
    }
    setSubmitting(false);
  }

  async function handleSignup() {
    setAuthMessage('');
    if (!name.trim()) {
      showMessage('Please enter your name.');
      return;
    }
    if (password.length < 8) {
      showMessage('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) showMessage(error.message);
    else {
      showMessage('Account created! Check your email for a confirmation link, then sign in.');
      setMode('login');
    }
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
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Sign out failed', error.message);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }

  if (user) {
    const displayName = user.user_metadata?.full_name ?? 'Family Member';
    const memberSince = user.created_at ? formatDate(user.created_at) : null;

    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.text }]}>Profile</Text>
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap}>
            <UserAvatar name={displayName} avatarUrl={avatarUrl} size={80} />
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={12} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.secondary }]}>
            <Text style={styles.roleBadgeText}>
              {role === 'admin' ? 'Admin' : role === 'member' ? 'Family Member' : 'Viewer'}
            </Text>
          </View>
          {memberSince && (
            <Text style={[styles.memberSince, { color: colors.textSecondary }]}>Member since {memberSince}</Text>
          )}
        </View>

        {/* Access request for viewers */}
        {role === 'viewer' && (
          requestStatus === 'pending' ? (
            <View style={styles.requestBanner}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={styles.requestBannerText}>Access request pending</Text>
            </View>
          ) : requestStatus === 'denied' ? (
            <TouchableOpacity style={styles.requestBanner} onPress={() => { setRequestStatus('none'); setShowRequestForm(true); }}>
              <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.requestBannerText}>Access request denied. Tap to try again.</Text>
            </TouchableOpacity>
          ) : showRequestForm ? (
            <View style={styles.requestCard}>
              <Text style={styles.requestTitle}>Request Member Access</Text>
              <TextInput
                style={styles.requestInput}
                placeholder="Optional message (e.g. which family you're from)"
                placeholderTextColor={colors.textSecondary}
                value={requestMessage}
                onChangeText={setRequestMessage}
                maxLength={200}
              />
              <View style={styles.requestFormButtons}>
                <TouchableOpacity style={styles.requestCancelBtn} onPress={() => setShowRequestForm(false)}>
                  <Text style={styles.requestCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.requestBtn}
                  onPress={handleRequestAccess}
                  disabled={requestStatus === 'sending'}
                >
                  {requestStatus === 'sending' ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.requestBtnText}>Send Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.requestBanner}
              onPress={() => setShowRequestForm(true)}
              dataSet={{ hover: 'family' }}
            >
              <Ionicons name="lock-open-outline" size={18} color={colors.primary} />
              <Text style={styles.requestBannerText}>Want to add recipes? Request access</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/browse')}
            dataSet={{ hover: 'card' }}
          >
            <Ionicons name="book-outline" size={24} color={colors.primary} />
            <Text style={styles.statNumber}>{recipesAdded}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Recipes Added</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/favorites')}
            dataSet={{ hover: 'card' }}
          >
            <Ionicons name="heart-outline" size={24} color={colors.primary} />
            <Text style={styles.statNumber}>{favoritesCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Favorites</Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>

          {isMemberOrAdmin && (
            <>
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push('/add-recipe')}
                dataSet={{ hover: 'family' }}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>Add a Recipe</Text>
                  <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Add a new recipe to the collection</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push('/auto-import')}
                dataSet={{ hover: 'family' }}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="documents-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>Auto Import</Text>
                  <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Import recipes from a cookbook using AI</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {reviewCount > 0 && (
                <TouchableOpacity
                  style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push('/review-queue')}
                  dataSet={{ hover: 'family' }}
                >
                  <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                    <Ionicons name="clipboard-outline" size={22} color="#FFF" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Review Queue</Text>
                    <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>{reviewCount} imported recipe{reviewCount !== 1 ? 's' : ''} to review</Text>
                  </View>
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewBadgeText}>{reviewCount}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/browse')}
            dataSet={{ hover: 'family' }}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="search-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Browse Recipes</Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Search and filter all recipes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/favorites')}
            dataSet={{ hover: 'family' }}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="heart-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>My Favorites</Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>View your saved recipes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {isAdmin && (
            <>
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/admin')}
              dataSet={{ hover: 'family' }}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="shield-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Manage Members</Text>
                <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Approve and manage family members</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/pending-requests')}
              dataSet={{ hover: 'family' }}
            >
              <View style={[styles.actionIcon, pendingRequestCount > 0 && { backgroundColor: colors.primary }]}>
                <Ionicons name="mail-outline" size={22} color={pendingRequestCount > 0 ? '#FFF' : colors.primary} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Pending Requests</Text>
                <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                  {pendingRequestCount > 0
                    ? `${pendingRequestCount} request${pendingRequestCount !== 1 ? 's' : ''} waiting for review`
                    : 'No pending requests'}
                </Text>
              </View>
              {pendingRequestCount > 0 && (
                <View style={styles.reviewBadge}>
                  <Text style={styles.reviewBadgeText}>{pendingRequestCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            </>
          )}
        </View>

        {/* Theme */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.themeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, themeMode === opt && styles.themeBtnActive]}
                onPress={() => setThemeMode(opt)}
              >
                <Ionicons
                  name={opt === 'system' ? 'phone-portrait-outline' : opt === 'light' ? 'sunny-outline' : 'moon-outline'}
                  size={18}
                  color={themeMode === opt ? '#FFF' : colors.text}
                />
                <Text style={[styles.themeBtnText, themeMode === opt && styles.themeBtnTextActive]}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: colors.border }]}
          onPress={handleLogout}
          dataSet={{ hover: 'btn' }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={[styles.footer, { backgroundColor: colors.footer }]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>McMichael Munchies. Recipes from our home to yours.</Text>
        </View>
      </ScrollView>
    );
  }

  // ─── Auth screen ──────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.authContainer}>
        <Text style={styles.authTitle}>McMichael Munchies</Text>
        <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </Text>

        {/* @ts-ignore */}
        <TouchableOpacity style={[styles.oauthButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => handleOAuth('google')} dataSet={{ hover: 'btn' }}>
          <Ionicons name="logo-google" size={20} color="#EA4335" />
          <Text style={[styles.oauthText, { color: colors.text }]}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {mode === 'signup' && (
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {mode === 'login' && (
          <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={mode === 'login' ? handleLogin : handleSignup}
          disabled={submitting}
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

        {authMessage ? (
          <View style={styles.authMessageBox}>
            <Text style={styles.authMessageText}>{authMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setAuthMessage(''); }}>
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
  scrollContent: { paddingBottom: 0, maxWidth: Layout.maxWidth, width: '100%', alignSelf: 'center' },
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
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
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

  // Access request
  requestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestBannerText: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  requestCard: {
    backgroundColor: Colors.secondary,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  requestTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  requestInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  requestFormButtons: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  requestCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestCancelBtnText: { color: Colors.text, fontWeight: '600', fontSize: 14 },
  requestBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  requestBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

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
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  themeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  themeBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  themeBtnTextActive: { color: '#FFF' },
  logoutText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  footer: { alignItems: 'center', paddingVertical: 24, marginTop: 24, backgroundColor: Colors.footer },
  footerText: { fontSize: 12, color: Colors.textSecondary },

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
  authMessageBox: {
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    padding: 12,
  },
  authMessageText: {
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
  },
  forgotText: {
    textAlign: 'right',
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  switchText: {
    textAlign: 'center',
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
