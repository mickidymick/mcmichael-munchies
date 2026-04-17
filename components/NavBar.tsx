import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout } from '../constants/colors';
import { useUserRole } from '../lib/useUserRole';

const NAV_LINKS: { label: string; href: string; icon: keyof typeof Ionicons.glyphMap; match: (p: string) => boolean }[] = [
  { label: 'Home', href: '/(tabs)/', icon: 'home-outline', match: (p) => p === '/' || p === '/(tabs)' || p === '/(tabs)/' },
  { label: 'Browse', href: '/(tabs)/browse', icon: 'search-outline', match: (p) => p.startsWith('/browse') },
  { label: 'Favorites', href: '/(tabs)/favorites', icon: 'heart-outline', match: (p) => p.startsWith('/favorites') },
  { label: 'Profile', href: '/(tabs)/profile', icon: 'person-outline', match: (p) => p.startsWith('/profile') },
];

const COMPACT_BREAKPOINT = 700;

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMemberOrAdmin } = useUserRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const { width } = Dimensions.get('window');
  const isCompact = width < COMPACT_BREAKPOINT;

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.nav}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/')}>
          <Image
            source={require('../assets/logo.png')}
            style={isCompact ? styles.logoCompact : styles.logo}
            resizeMode="contain"
            accessibilityLabel="McMichael Munchies home"
          />
        </TouchableOpacity>

        {/* Nav links */}
        <View style={styles.links}>
          {NAV_LINKS.map((link) => {
            const isActive = link.match(pathname);
            return (
              <TouchableOpacity
                key={link.label}
                style={[styles.link, isActive && styles.linkActive]}
                onPress={() => { router.push(link.href as any); setMenuOpen(false); }}
                accessibilityRole="link"
                accessibilityLabel={link.label}
                accessibilityState={{ selected: isActive }}
                dataSet={{ hover: 'nav' }}
              >
                {isCompact ? (
                  <Ionicons name={link.icon} size={22} color={isActive ? Colors.primary : Colors.text} />
                ) : (
                  <Text style={[styles.linkText, isActive && styles.linkTextActive]}>
                    {link.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Action buttons */}
        {isMemberOrAdmin && (
          isCompact ? (
            <View>
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => setMenuOpen(!menuOpen)}
              >
                <Ionicons name={menuOpen ? 'close' : 'menu'} size={24} color={Colors.primary} />
              </TouchableOpacity>
              {menuOpen && (
                <View style={styles.dropdown}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => { router.push('/add-recipe'); setMenuOpen(false); }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                    <Text style={styles.dropdownText}>Add Recipe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => { router.push('/auto-import'); setMenuOpen(false); }}
                  >
                    <Ionicons name="documents-outline" size={18} color={Colors.primary} />
                    <Text style={styles.dropdownText}>Auto Import</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => router.push('/auto-import')}
                dataSet={{ hover: 'btn' }}
              >
                <Ionicons name="documents-outline" size={16} color={Colors.primary} />
                <Text style={styles.bulkBtnText}>Auto Import</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push('/add-recipe')}
                dataSet={{ hover: 'btn' }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Add Recipe</Text>
              </TouchableOpacity>
            </View>
          )
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 1000,
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
  logoCompact: { height: 40, width: 130 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  linkActive: { backgroundColor: Colors.secondary },
  linkText: { fontSize: 15, fontWeight: '500', color: Colors.text },
  linkTextActive: { color: Colors.primary, fontWeight: '700' },

  // Desktop action buttons
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

  // Compact menu
  menuBtn: { padding: 6 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginTop: 4,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownText: { fontSize: 14, fontWeight: '600', color: Colors.text },
});
