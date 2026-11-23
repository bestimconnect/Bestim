import { View } from 'react-native';

/** v2 `.prog`: a 4-high tick track with an ink fill (`value` 0..1). Always fills from the start side. */
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <View className="h-1 overflow-hidden rounded bg-tick">
      <View className={`h-full rounded ${color ? '' : 'bg-ink'}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, ...(color ? { backgroundColor: color } : null) }} />
    </View>
  );
}
