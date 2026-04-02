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
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'login' | 'signup';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function handleLogin() {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Login failed', error.message);
    setSubmitting(false);
  }

  async function handleSignup() {
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

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={Colors.primary} />;
  }

  if (user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.heading}>Profile</Text>
        </View>
        <View style={styles.profileBody}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user.user_metadata?.full_name ?? user.email ?? '?')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user.user_metadata?.full_name ?? 'Family Member'}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

        {/* OAuth buttons */}
        <TouchableOpacity style={styles.oauthButton} onPress={() => handleOAuth('google')}>
          <Ionicons name="logo-google" size={20} color="#EA4335" />
          <Text style={styles.oauthText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email/password form */}
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
  loader: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heading: { fontSize: 24, fontWeight: '700', color: Colors.text },
  profileBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 32, color: '#FFF', fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: Colors.text },
  email: { fontSize: 14, color: Colors.textSecondary },
  logoutButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 8,
  },
  logoutText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  authContainer: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 12 },
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
