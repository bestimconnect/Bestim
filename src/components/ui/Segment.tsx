import { Pressable, View } from 'react-native';

import { shadows } from '@/lib/theme';
import { Text } from './Text';

/** v2 `.sg` (Figma Segmented control): a card track (16 radius, 4 padding), the chosen segment a paper tile (12 radius) with a soft lift. */
export function Segment<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View className="flex-row rounded-2xl bg-white p-1" style={{ boxShadow: shadows.hair }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} className={`h-10 flex-1 items-center justify-center rounded-xl ${on ? 'bg-paper' : ''}`} style={on ? { boxShadow: shadows.segment } : undefined}>
            <Text variant="body-sm" className={on ? 'font-medium' : 'text-muted'} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
