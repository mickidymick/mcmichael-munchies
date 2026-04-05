import { useState } from 'react';
import { Image, ImageProps, Platform, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

export default function LazyImage(props: ImageProps) {
  const [error, setError] = useState(false);

  if (error || !props.source) {
    return (
      <View style={[styles.fallback, props.style as any]}>
        <Ionicons name="image-outline" size={32} color={Colors.textSecondary} />
      </View>
    );
  }

  const imageProps = {
    ...props,
    onError: () => setError(true),
  };

  if (Platform.OS === 'web') {
    // @ts-ignore - loading is a valid HTML img attribute but not in RN types
    return <Image {...imageProps} loading="lazy" />;
  }
  return <Image {...imageProps} />;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
