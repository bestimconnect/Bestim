import { I18nManager, Pressable, View } from 'react-native';

/** Figma `fresh/toggle` (screens 27, 28): 44×24 track, teal when on. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      className={`h-6 w-11 justify-center rounded-full px-0.5 ${value ? 'bg-teal' : 'bg-line'}`}
      // The design keeps "on" at the physical right in both languages.
      style={{ alignItems: value !== I18nManager.isRTL ? 'flex-end' : 'flex-start' }}>
      <View className="h-5 w-5 rounded-full bg-[#FFFFFF]" />
    </Pressable>
  );
}
