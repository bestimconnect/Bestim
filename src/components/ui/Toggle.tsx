import { Pressable } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { EASE_OUT } from '@/lib/motion';

/** Figma `fresh/toggle` (screens 27, 28): 44×24 track, teal when on. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  const still = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      className={`h-6 w-11 justify-center rounded-full px-0.5 ${value ? 'bg-teal' : 'bg-line'}`}
      // The design keeps "on" at the physical right in both languages.
      style={{ direction: 'ltr', alignItems: 'flex-start' }}>
      <Animated.View
        className="h-5 w-5 rounded-full bg-[#FFFFFF]"
        style={{ transform: [{ translateX: value ? 20 : 0 }], transitionProperty: 'transform', transitionDuration: still ? '0ms' : '160ms', transitionTimingFunction: EASE_OUT }}
      />
    </Pressable>
  );
}
