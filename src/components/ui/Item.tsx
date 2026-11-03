import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, View, type PressableProps } from 'react-native';

import { useColors } from '@/lib/theme';
import { Card } from './Card';
import { useInGroup } from './Group';
import { IconTile } from './IconTile';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

const badges = { mint: 'mint', paper: 'paper', sky: 'sky', amber: 'amber', blush: 'blush' } as const;

type Props = Omit<PressableProps, 'style'> & {
  icon?: LucideIcon;
  image?: number; // a picture (vehicle art) in place of the icon badge; falls back to `icon` when missing
  leading?: ReactNode; // replaces the icon badge (a part drawing)
  tone?: keyof typeof badges;
  title: string;
  subtitle?: string;
  chevron?: boolean;
  aside?: ReactNode; // replaces the chevron (a tick, a status dot)
};

/** Figma `fresh/item`: 72h, icon tile, chevron at the end side. Alone it is a `Card`; inside a `Group` it is one row of that card. */
export function Item({ icon: Icon, image, leading, tone = 'mint', title, subtitle, chevron = true, aside, ...rest }: Props) {
  const c = useColors();
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  const grouped = useInGroup();
  const row = (
    <>
      {leading ?? (image ? (
        <Image source={image} contentFit="contain" style={{ width: 64, height: 32 }} />
      ) : Icon ? (
        <IconTile icon={Icon} tone={badges[tone]} size={grouped ? 36 : 40} />
      ) : null)}
      <View className="flex-1 gap-0.5">
        <Text variant="label" numberOfLines={2}>{title}</Text>
        {subtitle ? <Text variant="caption" className="text-muted" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {aside ? <View className="shrink-0">{aside}</View> : chevron ? <Chevron size={18} color={c.muted} /> : null}
    </>
  );
  return grouped ? (
    <PressableScale accessibilityRole="button" className="min-h-[64px] flex-row items-center gap-3 px-3.5 py-3" {...rest} scale={0.99}>{row}</PressableScale>
  ) : (
    <Card className={`min-h-[72px] flex-row items-center gap-3 p-3.5 ${rest.disabled ? 'opacity-50' : ''}`} {...rest}>{row}</Card>
  );
}
