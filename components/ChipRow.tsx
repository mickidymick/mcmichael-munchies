import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';

type Props = {
  label: string;
  items: (string | { label: string; value: string })[];
  selected: string[];
  onToggle: (val: string) => void;
};

export default function ChipRow({ label, items, selected, onToggle }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.wrap}>
        {items.map((item) => {
          const value = typeof item === 'string' ? item : item.value;
          const chipLabel = typeof item === 'string' ? item : item.label;
          const isActive = selected.includes(value);
          return (
            <TouchableOpacity
              key={value}
              style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }, isActive && styles.chipActive]}
              onPress={() => onToggle(value)}
              accessibilityRole="button"
              accessibilityLabel={`${chipLabel} filter`}
              accessibilityState={{ selected: isActive }}
              dataSet={{ hover: 'chip' }}
            >
              <Text style={[styles.chipText, { color: colors.text }, isActive && styles.chipTextActive]}>
                {chipLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  chipTextActive: { color: '#FFF' },
});
