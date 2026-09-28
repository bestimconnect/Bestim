import { Pressable, View } from 'react-native';

import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

/** Figma `fresh/choice`: rounded-full segmented control, selected pill dark with light text. */
export function Choice<T extends string>({ value, options, onChange }: { value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  return (
    <View className="h-11 flex-row items-center gap-1 rounded-nav bg-paper p-1">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          className={`h-full flex-1 items-center justify-center rounded-nav ${value === o.value ? 'bg-ink' : ''}`}>
          <Text variant="caption" className={value === o.value ? 'text-paper' : 'text-muted'}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
