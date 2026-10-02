import { I18nManager, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { EASE_OUT } from '@/lib/motion';

/** The step you just reached fills in from the start side (decisions Q57). */
export const FILL = {
  animationName: { from: { transform: [{ scaleX: 0 }] }, to: { transform: [{ scaleX: 1 }] } },
  animationDuration: '450ms',
  animationTimingFunction: EASE_OUT,
  transformOrigin: I18nManager.isRTL ? 'right' : 'left',
} as const;

/** Shared step progress bar for the 3 add-vehicle onboarding screens. */
export function Progress({ step, total }: { step: number; total: number }) {
  const still = useReducedMotion();
  return (
    <View className="h-1.5 flex-row items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <View key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
          {n <= step ? <Animated.View className="h-full rounded-full bg-lime" style={n === step && !still ? FILL : undefined} /> : null}
        </View>
      ))}
    </View>
  );
}
