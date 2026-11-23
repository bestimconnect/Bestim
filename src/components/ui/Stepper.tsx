import { Minus, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { shadows, useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/**
 * v2 `stp()` row (Edit schedule sheet): a `.fld` card (18 radius, 11/16 padding, hairline) with the 11.5 muted label over a
 * 16 Medium value and its 13 muted unit, then `.stp`: − and + as 38 paper circles, 6 apart.
 */
export function Stepper({ label, value, unit, onChange, step = 1, min = 0, max = Infinity }: { label: string; value: number; unit?: string; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  const c = useColors();
  return (
    <View className="flex-row items-center justify-between rounded-input bg-white px-4 py-[11px]" style={{ boxShadow: shadows.hair }}>
      <View className="shrink gap-0.5">
        <Text variant="caption" className="!text-[11.5px] !leading-[16px] text-muted">{label}</Text>
        <Text variant="body" className="font-medium !text-[16px] !leading-[22px]" style={{ fontFamily: 'Poppins_500Medium', writingDirection: 'ltr' }}>
          {value.toLocaleString('en-US')}
          {unit ? <Text variant="body" className="!text-[13px] text-muted">{` ${unit}`}</Text> : null}
        </Text>
      </View>
      <View className="flex-row gap-1.5">
        {([[Minus, -step], [Plus, step]] as const).map(([Icon, d]) => (
          <PressableScale key={d} accessibilityRole="button" accessibilityLabel={d > 0 ? '+' : '-'} disabled={d > 0 ? value >= max : value <= min} onPress={() => onChange(Math.min(max, Math.max(min, value + d)))} className="h-[38px] w-[38px] items-center justify-center rounded-full bg-paper">
            <Icon size={18} color={c.ink} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}
