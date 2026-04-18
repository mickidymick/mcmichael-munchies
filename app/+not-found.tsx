import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';

export default function NotFoundScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons name="restaurant-outline" size={64} color={colors.primary} />
      <Text style={styles.code}>404</Text>
      <Text style={[styles.title, { color: colors.text }]}>Page Not Found</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        This recipe must have gotten lost in the kitchen.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(tabs)/')}
      >
        <Ionicons name="home-outline" size={18} color="#fff" />
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  code: {
    fontSize: 56,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
