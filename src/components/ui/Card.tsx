import type { ReactNode } from 'react';
import { View, type PressableProps } from 'react-native';

import { shadows, useScheme } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Sheen } from './Sheen';

const tones = { white: 'bg-white', mint: 'bg-mint', sky: 'bg-sky', amber: 'bg-amber', lime: 'bg-lime', blush: 'bg-blush' };

type Props = Omit<PressableProps, 'style' | 'children'> & { tone?: keyof typeof tones; className?: string; children: ReactNode; scale?: number; flat?: boolean };

/**
 * The one card (Q124): a hairline edge, a contact shadow plus a soft lift, and a faint same-hue shade (bottom darker in
 * light, top lighter in dark) so it has volume (`flat` drops it, for opaque pictures that would show a band). `className` adds layout (padding, gap, radius override). `onPress` makes it tappable.
 */
export function Card({ tone = 'white', className = '', children, scale = 0.98, flat, ...press }: Props) {
  const dark = useScheme() === 'dark';
  const body = (
    <>
      {flat ? null : tone === 'white' ? <Sheen color={dark ? '#FFFFFF' : '#222E29'} opacity={dark ? 0.04 : 0.03} flip={!dark} /> : <Sheen color="#FFFFFF" opacity={0.45} />}
      {children}
    </>
  );
  const box = `overflow-hidden rounded-item border ${dark ? 'border-line' : 'border-[#1018140D]'} ${tones[tone]} ${className}`;
  return press.onPress ? (
    <PressableScale accessibilityRole="button" scale={scale} {...press} className={box} style={{ boxShadow: shadows.lift }}>{body}</PressableScale>
  ) : (
    <View className={box} style={{ boxShadow: shadows.lift }}>{body}</View>
  );
}
