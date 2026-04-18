import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';

type Props = {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export default function Skeleton({ width, height, borderRadius = 8, style }: Props) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

export function RecipeCardSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={[skStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width={120} height={68} borderRadius={0} />
      <View style={skStyles.info}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={10} />
        <Skeleton width="30%" height={10} />
      </View>
    </View>
  );
}

export function CarouselSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={[skStyles.carousel, { backgroundColor: colors.background }]}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width={300} height={220} borderRadius={12} />
      ))}
    </View>
  );
}

export function HomeGridSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={skStyles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[skStyles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Skeleton width="100%" height={120} borderRadius={0} />
          <View style={skStyles.gridInfo}>
            <Skeleton width="80%" height={14} />
            <Skeleton width="50%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    height: 80,
  },
  info: { flex: 1, padding: 12, justifyContent: 'center', gap: 8 },
  carousel: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
    maxWidth: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gridInfo: { padding: 10, gap: 8 },
});
