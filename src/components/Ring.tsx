import Svg, { Circle } from 'react-native-svg';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useColors } from '@/lib/theme';

/** A progress ring with the label in the middle. `value` 0 to 1; starts at 12 o'clock and is never mirrored. */
export function Ring({ value, color, size = 64, label }: { value: number; color: string; size?: number; label: string }) {
  const c = useColors();
  const stroke = Math.max(5, size / 9);
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${len * Math.min(1, Math.max(0.02, value))} ${len}`}
        />
      </Svg>
      <Text variant="label" style={{ fontSize: size / 3.6, lineHeight: size / 3 }}>{label}</Text>
    </View>
  );
}
