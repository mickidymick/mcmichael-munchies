import { View, Text, StyleSheet } from 'react-native';

const FAMILY_CONFIG: Record<string, { letter: string; bg: string; color: string }> = {
  "McMichael's": { letter: 'M', bg: '#2E86AB', color: '#FFF' },
  "Knepp's": { letter: 'K', bg: '#A23B72', color: '#FFF' },
  "Elmore's": { letter: 'E', bg: '#F18F01', color: '#FFF' },
  "Ross's": { letter: 'R', bg: '#2D936C', color: '#FFF' },
};

type Props = {
  family: string | null | undefined;
  size?: number;
};

export default function FamilyBadge({ family, size = 32 }: Props) {
  if (!family || !FAMILY_CONFIG[family]) return null;

  const config = FAMILY_CONFIG[family];
  const fontSize = size * 0.5;
  const borderRadius = size / 2;

  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius, backgroundColor: config.bg }]}>
      <Text style={[styles.letter, { fontSize, color: config.color }]}>{config.letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '800',
  },
});
