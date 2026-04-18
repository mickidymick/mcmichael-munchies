import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
import { FAMILIES } from '../constants/recipes';

export default function AboutScreen() {
  const colors = useThemeColors();
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>About McMichael Munchies</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="heart" size={28} color={colors.primary} />
        <Text style={[styles.heading, { color: colors.text }]}>Our Story</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          McMichael Munchies was created as a place where our families can save, share, and have easy access to all the amazing food we grew up with — as well as discover new favorites together.
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          From Grandma's secret recipes to that amazing dish someone brought to Thanksgiving, this is our family cookbook — digital, searchable, and always in your pocket.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="people" size={28} color={colors.primary} />
        <Text style={[styles.heading, { color: colors.text }]}>Our Families</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Recipes from across our extended family, spanning generations of home cooking:
        </Text>
        <View style={styles.familyList}>
          {FAMILIES.map((fam) => (
            <View key={fam} style={styles.familyItem}>
              <View style={styles.familyDot} />
              <Text style={[styles.familyName, { color: colors.text }]}>{fam}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="restaurant" size={28} color={colors.primary} />
        <Text style={[styles.heading, { color: colors.text }]}>Features</Text>
        <View style={styles.featureList}>
          {[
            ['search-outline', 'Search by ingredient, category, cuisine, or tag'],
            ['resize-outline', 'Scale servings up or down with a tap'],
            ['restaurant-outline', 'Cook mode for hands-free step-by-step cooking'],
            ['heart-outline', 'Save your favorites for quick access'],
            ['people-outline', 'Browse by family to find recipes from each side'],
            ['print-outline', 'Print any recipe for the kitchen'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.featureItem}>
              <Ionicons name={icon as any} size={18} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>McMichael Munchies</Text>
        <Text style={styles.footerSub}>Recipes from our home to yours.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingBottom: 40,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: 'Pacifico_400Regular',
    fontSize: 28,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 10,
  },
  heading: { fontSize: 20, fontWeight: '700', color: Colors.text },
  body: { fontSize: 15, color: Colors.textSecondary, lineHeight: 23, textAlign: 'center' },
  familyList: { gap: 8, marginTop: 4, alignSelf: 'center' },
  familyItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  familyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  familyName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  featureList: { gap: 12, marginTop: 4, alignSelf: 'stretch' },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  footer: { alignItems: 'center', paddingVertical: 24, marginTop: 8 },
  footerText: { fontFamily: 'Pacifico_400Regular', fontSize: 18, color: Colors.primary },
  footerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
