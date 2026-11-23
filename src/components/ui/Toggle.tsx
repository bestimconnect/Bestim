import { I18nManager, Pressable } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { EASE_OUT } from '@/lib/motion';

/** v2 `.tgl` (50×30): on = dark green track with a lime knob at the end side (left in Arabic), off = tick track, card knob at the start. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  const still = useReducedMotion();
  const shift = I18nManager.isRTL ? -20 : 20; // translateX is physical; the knob travels toward the end side
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      className={`h-[30px] w-[50px] items-start justify-center rounded-full px-[3px] ${value ? 'bg-btn' : 'bg-tick'}`}>
      <Animated.View
        className={`h-6 w-6 rounded-full ${value ? 'bg-onbtn' : 'bg-white'}`}
        style={{ transform: [{ translateX: value ? shift : 0 }], transitionProperty: 'transform', transitionDuration: still ? '0ms' : '160ms', transitionTimingFunction: EASE_OUT }}
      />
    </Pressable>
  );
}
