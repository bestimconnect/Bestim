import type { ReactNode } from 'react';
import { View } from 'react-native';

import { shadows } from '@/lib/theme';
import { Text } from './Text';

// Figma metric cards: 06 (white, on the hero), 09 (white + translucent on ink), 11 (lime).
const tones = {
  white: { box: 'bg-white', text: '', muted: 'text-muted' },
  lime: { box: 'bg-lime', text: 'text-[#222E29]', muted: 'text-[#222E29]' }, // fixed ink on lime (both themes)
  glass: { box: 'bg-[#FFFFFF26]', text: 'text-[#FFFFFF]', muted: 'text-[#FFFFFF]' }, // on the ink hero
};

type Props = {
  label: string;
  value: string;
  caption?: string;
  tone?: keyof typeof tones;
  size?: 'large' | 'small';
  aside?: ReactNode; // e.g. the refresh button on 06
  className?: string;
};

export function Metric({ label, value, caption, tone = 'white', size = 'large', aside, className = '' }: Props) {
  const t = tones[tone];
  return (
    <View
      className={`flex-row items-center gap-3 rounded-metric p-5 ${t.box} ${className}`}
      style={tone === 'white' ? { boxShadow: shadows.soft } : tone === 'lime' ? { boxShadow: shadows.glow } : undefined}>
      <View className="flex-1 gap-1">
        <Text variant="caption" className={t.muted}>{label}</Text>
        <Text variant={size === 'large' ? 'number' : 'small-number'} className={t.text} numberOfLines={1}>
          {value}
        </Text>
        {caption ? <Text variant="caption" className={t.muted}>{caption}</Text> : null}
      </View>
      {aside}
    </View>
  );
}
