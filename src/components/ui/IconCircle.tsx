import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useColors } from '@/lib/theme';

const tones = {
  neutral: { bg: 'bg-paper', ink: 'muted' },
  card: { bg: 'bg-white', ink: 'muted' },
  ok: { bg: 'bg-okTint', ink: 'ok' },
  soon: { bg: 'bg-soonTint', ink: 'soon' },
  late: { bg: 'bg-lateTint', ink: 'late' },
  lime: { bg: 'bg-lime', ink: 'onlime' },
  ink: { bg: 'bg-btn', ink: 'onbtn' },
} as const;
export type IconTone = keyof typeof tones;

/** v2 `.ic`: a round holder for an icon (44 in rows, 34 in menu rows, 50 for the top-bar buttons). Icon is 0.45 of the size, stroke 1.7. */
export function IconCircle({ icon: Icon, tone = 'neutral', size = 44, color }: { icon: LucideIcon; tone?: IconTone; size?: number; color?: string }) {
  const c = useColors();
  const t = tones[tone];
  return (
    <View className={`items-center justify-center rounded-full ${t.bg}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.45)} color={color ?? c[t.ink]} strokeWidth={1.7} />
    </View>
  );
}
