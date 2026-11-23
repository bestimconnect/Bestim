import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, View, type PressableProps } from 'react-native';

import { useColors } from '@/lib/theme';
import { Card } from './Card';
import { useInGroup } from './Group';
import { IconCircle, type IconTone } from './IconCircle';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

// Old tile tones onto the v2 icon circles: the soft tints mean a state, the rest are the plain paper circle.
const circle: Record<string, IconTone> = { mint: 'neutral', paper: 'neutral', sky: 'neutral', amber: 'soon', blush: 'late', ok: 'ok', soon: 'soon', late: 'late' };

type Props = Omit<PressableProps, 'style'> & {
  icon?: LucideIcon;
  image?: number; // a picture (vehicle art) in place of the icon circle; falls back to `icon` when missing
  leading?: ReactNode; // replaces the icon circle (a part drawing)
  tone?: 'mint' | 'paper' | 'sky' | 'amber' | 'blush' | 'ok' | 'soon' | 'late';
  title: string;
  subtitle?: string;
  chevron?: boolean;
  aside?: ReactNode; // replaces the chevron (a tick, a status dot, a "when" label)
};

/**
 * v2 `.row` (Figma List row): card, 22 radius, 13/14 padding, a 44 icon circle, title 15 Medium, sub-line 12.5 muted, chevron or
 * `aside` at the end. Inside a `Group` it is a v2 menu row (`.mr`): 34 circle, no card of its own.
 */
export function Item({ icon: Icon, image, leading, tone = 'paper', title, subtitle, chevron = true, aside, ...rest }: Props) {
  const c = useColors();
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  const grouped = useInGroup();
  const row = (
    <>
      {leading ?? (image ? (
        <Image source={image} contentFit="contain" style={{ width: 64, height: 32 }} />
      ) : Icon ? (
        <IconCircle icon={Icon} tone={circle[tone]} size={grouped ? 34 : 44} />
      ) : null)}
      <View className="flex-1 gap-0.5">
        <Text variant="label" numberOfLines={2}>{title}</Text>
        {subtitle ? <Text variant="caption" className="text-muted" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {aside ? <View className="shrink-0">{aside}</View> : chevron ? <Chevron size={18} color={c.muted} /> : null}
    </>
  );
  return grouped ? (
    <PressableScale accessibilityRole="button" className="min-h-[58px] flex-row items-center gap-3 px-3.5 py-3" {...rest} scale={0.99}>{row}</PressableScale>
  ) : (
    <Card className={`min-h-[70px] flex-row items-center gap-[13px] !rounded-row px-3.5 py-[13px] ${rest.disabled ? 'opacity-50' : ''}`} {...rest}>{row}</Card>
  );
}
