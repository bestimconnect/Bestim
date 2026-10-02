import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { EASE_OUT } from '@/lib/motion';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

/** Figma `fresh/choice`: rounded-full segmented control, selected pill dark with light text. */
/** `className` overrides the track colour, e.g. `bg-line` on paper screens (09, 10). */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  className = 'bg-paper',
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const [width, setWidth] = useState(0);
  const still = useReducedMotion();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const seg = width ? (width - 8 - (options.length - 1) * 4) / options.length : 0; // p-1 + gap-1
  return (
    <View className={`h-11 flex-row items-center gap-1 rounded-nav p-1 ${className}`} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* The pill slides between segments (decisions Q57). `left`, not translateX: RN mirrors it in RTL and under a
          forced-ltr parent alike, and the pill is out of flow and childless, so nothing else re-lays out. */}
      {seg ? (
        <Animated.View
          pointerEvents="none"
          className="absolute bottom-1 top-1 rounded-nav bg-ink"
          style={{ width: seg, left: 4 + index * (seg + 4), transitionProperty: 'left', transitionDuration: still ? '0ms' : '220ms', transitionTimingFunction: EASE_OUT }}
        />
      ) : null}
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          // Until the track is measured the selected segment paints itself, so there's no empty first frame.
          className={`h-full flex-1 items-center justify-center rounded-nav ${!seg && value === o.value ? 'bg-ink' : ''}`}>
          <Text variant="caption" className={value === o.value ? 'text-paper' : 'text-muted'}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
