import { useEffect } from 'react';
import { type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** v2 `.sk` (Figma Skeleton block): a tick-coloured block that breathes (1.4s, to 45% and back); still under reduced motion. */
export function Skeleton({ width = '100%', height = 22, radius = 11 }: { width?: DimensionValue; height?: number; radius?: number }) {
  const still = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!still) o.value = withRepeat(withTiming(0.45, { duration: 700 }), -1, true);
  }, [still, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View className="bg-tick" style={[{ width, height, borderRadius: radius }, fade]} />;
}
