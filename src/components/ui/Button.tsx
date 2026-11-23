import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, View, type PressableProps } from 'react-native';

import { shadows, useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

// v2 (Q133, Figma Button): flat 58-high pills, label 15 Medium. `secondary` = v2 `.btnb.ghost` (card + hairline ring). Primary = `btn`/`onbtn` (dark green with a lime label in light, lime in dark).
// On-danger text stays fixed white. A disabled button turns into a quiet grey pill instead of just fading.
const styles = {
  primary: { box: 'bg-btn', text: 'text-onbtn', shadow: undefined, spin: 'onbtn' },
  secondary: { box: 'bg-white', text: 'text-ink', shadow: shadows.ring, spin: 'ink' },
  dark: { box: 'bg-panel', text: 'text-onpanel', shadow: undefined, spin: 'onpanel' },
  danger: { box: 'bg-danger', text: 'text-[#FFFFFF]', shadow: undefined, spin: 'onpanel' },
  ghost: { box: '', text: 'text-teal', shadow: undefined, spin: 'teal' },
  soft: { box: 'bg-paper', text: 'text-ink', shadow: undefined, spin: 'ink' }, // secondary action inside a sheet or dialog
  lime: { box: 'bg-lime', text: 'text-onlime', shadow: undefined, spin: 'onlime' },
  link: { box: '', text: 'text-muted', shadow: undefined, spin: 'muted' }, // quiet text action under a button ("Keep my account")
} as const;
const sizes = { md: 'h-[58px] rounded-full px-6', sm: 'h-10 rounded-full px-4' };

type Props = PressableProps & { title: string; variant?: keyof typeof styles; size?: keyof typeof sizes; loading?: boolean; icon?: ReactNode; className?: string };

export function Button({ title, variant = 'primary', size = 'md', loading, icon, disabled, className = '', onPress, onPressIn, onPressOut, ...rest }: Props) {
  const s = styles[variant];
  const c = useColors();
  const [down, setDown] = useState(false);
  const off = !!disabled && !['secondary', 'ghost', 'link'].includes(variant);
  return (
    <PressableScale
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`flex-row items-center justify-center gap-2 overflow-hidden ${sizes[size]} ${off ? 'bg-line' : s.box} ${disabled && !off ? 'opacity-50' : ''} ${className}`}
      {...rest}
      onPressIn={(e) => { setDown(true); onPressIn?.(e); }}
      onPressOut={(e) => { setDown(false); onPressOut?.(e); }}
      onPress={(e) => {
        if (variant === 'primary') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={{ boxShadow: off ? undefined : s.shadow }}>
      {down && variant !== 'ghost' && variant !== 'link' ? <View pointerEvents="none" className="absolute inset-0 bg-[#0000000F]" /> : null}
      {loading ? (
        <ActivityIndicator color={c[s.spin]} />
      ) : (
        <>
          {icon}
          <Text variant="label" className={`shrink ${off ? 'text-muted' : s.text}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}
