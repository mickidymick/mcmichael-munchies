import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  secondaryLabel,
  onSecondary,
}: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color={colors.primary} style={styles.icon} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          {actionIcon && <Ionicons name={actionIcon} size={18} color="#FFF" />}
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      {secondaryLabel && onSecondary && (
        <TouchableOpacity onPress={onSecondary}>
          <Text style={styles.link}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  icon: { opacity: 0.4 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  description: {
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
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  link: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
});
