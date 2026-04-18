import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  // Supabase sets a session from the reset link token automatically
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasSession(true);
        setChecking(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleReset() {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) setError(err.message);
    else setSuccess(true);
    setSubmitting(false);
  }

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Password Updated!</Text>
          <Text style={styles.text}>
            Your password has been changed successfully. You can now sign in with your new password.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              supabase.auth.signOut();
              router.replace('/(tabs)/profile');
            }}
            dataSet={{ hover: 'btn' }}
          >
            <Text style={styles.btnText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!hasSession) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Invalid or Expired Link</Text>
          <Text style={styles.text}>
            This password reset link is no longer valid. Please request a new one.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace('/forgot-password')}
            dataSet={{ hover: 'btn' }}
          >
            <Text style={styles.btnText}>Request New Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.text}>Enter your new password below.</Text>

        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(''); }}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor={colors.textSecondary}
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setError(''); }}
          secureTextEntry
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, (!password || !confirm) && styles.btnDisabled]}
          onPress={handleReset}
          disabled={submitting || !password || !confirm}
          dataSet={{ hover: 'btn' }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
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
  errorBox: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 10,
  },
  errorText: { fontSize: 13, color: Colors.danger, textAlign: 'center' },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
