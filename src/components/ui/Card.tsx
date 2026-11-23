import type { ReactNode } from 'react';
import { View, type PressableProps } from 'react-native';

import { shadows } from '@/lib/theme';
import { PressableScale } from './PressableScale';

const tones = { white: 'bg-white', mint: 'bg-mint', sky: 'bg-sky', amber: 'bg-amber', lime: 'bg-lime', blush: 'bg-blush' };

type Props = Omit<PressableProps, 'style' | 'children'> & { tone?: keyof typeof tones; className?: string; children: ReactNode; scale?: number; flat?: boolean };

/**
 * The one card, v2 (Q133): a flat soft tile, 24 radius, only a 1px ring (no gradient, no lift). `flat` is kept for API
 * compatibility (every card is flat now). `className` adds layout (padding, gap, radius override). `onPress` makes it tappable.
 */
export function Card({ tone = 'white', className = '', children, scale = 0.98, flat: _flat, ...press }: Props) {
  const box = `overflow-hidden rounded-tile ${tones[tone]} ${className}`;
  return press.onPress ? (
    <PressableScale accessibilityRole="button" scale={scale} {...press} className={box} style={{ boxShadow: shadows.ring }}>{children}</PressableScale>
  ) : (
    <View className={box} style={{ boxShadow: shadows.ring }}>{children}</View>
  );
}

/** v2 `.t` (Figma Tile): a Card with the tile padding (15 top/bottom, 16 sides). */
export function Tile({ className = '', ...p }: Props) {
  return <Card className={`px-4 py-[15px] ${className}`} {...p} />;
}
