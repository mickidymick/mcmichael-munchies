import { View, Image, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type Props = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
};

export default function UserAvatar({ name, avatarUrl, size = 32 }: Props) {
  const borderRadius = size / 2;
  const fontSize = size * 0.4;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius }]}>
      <Text style={[styles.letter, { fontSize }]}>
        {(name?.[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#FFF',
    fontWeight: '700',
  },
});
