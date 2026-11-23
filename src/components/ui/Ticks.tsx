import { View } from 'react-native';

const fills = { ok: 'bg-ok', soon: 'bg-soon', late: 'bg-late' } as const;

/** The tick meter (v2 `.ticks`, Figma Tick bar): `n` bars (12), the first `on` filled in the state colour (or `color`). Never mirrored. */
export function Ticks({ on, n = 12, tone = 'ok', color, height = 34 }: { on: number; n?: number; tone?: keyof typeof fills; color?: string; height?: number }) {
  return (
    <View className="flex-row gap-1" style={{ height, direction: 'ltr' }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} className={`flex-1 rounded-[2px] ${i < on ? (color ? '' : fills[tone]) : 'bg-tick'}`} style={i < on && color ? { backgroundColor: color } : undefined} />
      ))}
    </View>
  );
}
