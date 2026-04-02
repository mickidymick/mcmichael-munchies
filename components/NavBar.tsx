import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useUserRole } from '../lib/useUserRole';

const NAV_LINKS = [
  { label: 'Home', href: '/(tabs)/', icon: 'home-outline' as const },
  { label: 'Browse', href: '/(tabs)/browse', icon: 'search-outline' as const },
  { label: 'Favorites', href: '/(tabs)/favorites', icon: 'heart-outline' as const },
  { label: 'Profile', href: '/(tabs)/profile', icon: 'person-outline' as const },
];

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMemberOrAdmin } = useUserRole();

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.nav}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/')}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <View style={styles.links}>
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href ||
              (link.href !== '/(tabs)/' && pathname.startsWith(link.href));
            return (
              <TouchableOpacity
                key={link.label}
                style={[styles.link, isActive && styles.linkActive]}
                onPress={() => router.push(link.href as any)}
              >
                <Text style={[styles.linkText, isActive && styles.linkTextActive]}>
                  {link.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isMemberOrAdmin && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/add-recipe')}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Recipe</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  logo: { height: 48, width: 160 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  linkActive: { backgroundColor: Colors.secondary },
  linkText: { fontSize: 15, fontWeight: '500', color: Colors.text },
  linkTextActive: { color: Colors.primary, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
