import { CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useColors } from '@/lib/theme';
import { Text } from './Text';

const tones: Record<'error' | 'warn' | 'ok' | 'info', { bg: string; ink: 'late' | 'soon' | 'ok' | 'muted'; icon: LucideIcon }> = {
  error: { bg: 'bg-lateTint', ink: 'late', icon: TriangleAlert },
  warn: { bg: 'bg-soonTint', ink: 'soon', icon: TriangleAlert },
  ok: { bg: 'bg-okTint', ink: 'ok', icon: CircleCheck },
  info: { bg: 'bg-paper', ink: 'muted', icon: Info },
};

/** v2 Error banner (Figma): a state-tinted box, 18 radius, 12/14 padding, the state icon and a 13.5 line in ink. */
export function Banner({ text, tone = 'error' }: { text: string; tone?: keyof typeof tones }) {
  const c = useColors();
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <View accessibilityRole="alert" className={`flex-row items-start gap-2.5 rounded-input px-3.5 py-3 ${t.bg}`}>
      <Icon size={20} color={c[t.ink]} />
      <Text variant="body-sm" className="flex-1">{text}</Text>
    </View>
  );
}
