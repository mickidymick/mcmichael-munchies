import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';

type LazyImageProps = ImageProps & {
  blurhash?: string | null;
};

export default function LazyImage({ blurhash, ...props }: LazyImageProps) {
  const colors = useThemeColors();
  const [error, setError] = useState(false);

  if (error || !props.source) {
    return (
      <View style={[styles.fallback, { backgroundColor: colors.secondary }, props.style as any]}>
        <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <Image
      {...props}
      placeholder={blurhash ? { blurhash } : undefined}
      transition={250}
      cachePolicy="disk"
      onError={() => setError(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
