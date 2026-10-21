import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, View, type PressableProps } from 'react-native';

import { shadows, useColors } from '@/lib/theme';
import { useInGroup } from './Group';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

const badges = { mint: 'bg-mint', paper: 'bg-paper', sky: 'bg-sky', amber: 'bg-amber', blush: 'bg-blush' };

type Props = PressableProps & {
  icon?: LucideIcon;
  image?: number; // a picture (vehicle art) in place of the icon badge; falls back to `icon` when missing
  leading?: ReactNode; // replaces the icon badge (a part drawing)
  tone?: keyof typeof badges;
  title: string;
  subtitle?: string;
  chevron?: boolean;
  aside?: ReactNode; // replaces the chevron (a tick, a status dot)
};

/** Figma `fresh/item`: 72h, 18 radius, 44 round icon badge, 18 chevron at the end side. */
export function Item({ icon: Icon, image, leading, tone = 'mint', title, subtitle, chevron = true, aside, ...rest }: Props) {
  const c = useColors();
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  const grouped = useInGroup(); // inside a Group the row is part of one card: no card of its own
  return (
    <PressableScale
      accessibilityRole="button"
      className={grouped ? 'min-h-[64px] flex-row items-center gap-3 px-3.5 py-3' : 'min-h-[72px] flex-row items-center gap-3 rounded-item bg-white p-3.5'}
      {...rest}
      scale={grouped ? 0.99 : 0.98}
      style={grouped ? undefined : { boxShadow: shadows.soft }}>
      {leading ?? (image ? (
        <Image source={image} contentFit="contain" style={{ width: 64, height: 32 }} />
      ) : Icon ? (
        // inside a Group the icon stands alone (no coloured badge behind it)
        <View className={grouped ? 'h-8 w-8 items-center justify-center' : `h-11 w-11 items-center justify-center rounded-full ${badges[tone]}`}>
          <Icon size={grouped ? 24 : 20} color={c.teal} />
        </View>
      ) : null)}
      <View className="flex-1 gap-0.5">
        <Text variant="label">{title}</Text>
        {subtitle ? <Text variant="caption" className="text-muted">{subtitle}</Text> : null}
      </View>
      {aside ?? (chevron ? <Chevron size={18} color={c.ink} /> : null)}
    </PressableScale>
  );
}
