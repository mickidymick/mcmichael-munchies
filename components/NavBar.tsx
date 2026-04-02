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
import { Colors, Layout } from '../constants/colors';
import { useUserRole } from '../lib/useUserRole';

const NAV_LINKS = [
  { label: 'Home', href: '/(tabs)/', match: (p: string) => p === '/' || p === '/(tabs)' || p === '/(tabs)/' },
  { label: 'Browse', href: '/(tabs)/browse', match: (p: string) => p.startsWith('/browse') },
  { label: 'Favorites', href: '/(tabs)/favorites', match: (p: string) => p.startsWith('/favorites') },
  { label: 'Profile', href: '/(tabs)/profile', match: (p: string) => p.startsWith('/profile') },
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
            accessibilityLabel="McMichael Munchies home"
          />
        </TouchableOpacity>

        <View style={styles.links}>
          {NAV_LINKS.map((link) => {
            const isActive = link.match(pathname);
            return (
              <TouchableOpacity
                key={link.label}
                style={[styles.link, isActive && styles.linkActive]}
                onPress={() => router.push(link.href as any)}
                // @ts-ignore
                dataSet={{ hover: 'nav' }}
              >
                <Text style={[styles.linkText, isActive && styles.linkTextActive]}>
                  {link.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isMemberOrAdmin && (
          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={styles.bulkBtn}
              onPress={() => router.push('/bulk-import')}
              // @ts-ignore
              dataSet={{ hover: 'btn' }}
            >
              <Ionicons name="documents-outline" size={16} color={Colors.primary} />
              <Text style={styles.bulkBtnText}>Bulk Import</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push('/add-recipe')}
              // @ts-ignore
              dataSet={{ hover: 'btn' }}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Add Recipe</Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: Layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  logo: { height: 56, width: 190 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  linkActive: { backgroundColor: Colors.secondary },
  linkText: { fontSize: 15, fontWeight: '500', color: Colors.text },
  linkTextActive: { color: Colors.primary, fontWeight: '700' },
  actionBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bulkBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
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
