import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, View, type PressableProps } from 'react-native';

import { PressableScale } from './PressableScale';
import { Sheen } from './Sheen';
import { Text } from './Text';

// On-lime and on-danger text stay fixed: the ink/white tokens invert in dark mode.
// Primary carries its glow and a 1px inner highlight on top; a disabled button turns into a quiet grey pill instead of just fading.
const styles = {
  primary: { box: 'bg-lime', text: 'text-[#222E29]', shadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 6px 16px -4px rgba(180,214,30,0.55)', spin: '#222E29' },
  secondary: { box: 'border border-line bg-white', text: 'text-ink', shadow: '0 1px 2px rgba(16,24,20,0.05), 0 4px 10px -4px rgba(16,24,20,0.08)', spin: '#222E29' },
  dark: { box: 'bg-panel', text: 'text-onpanel', shadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 14px -6px rgba(16,24,20,0.35)', spin: '#F5F7F5' },
  danger: { box: 'bg-danger', text: 'text-[#FFFFFF]', shadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 14px -6px rgba(172,40,70,0.5)', spin: '#FFFFFF' },
  ghost: { box: '', text: 'text-teal', shadow: undefined, spin: '#08736F' },
};
const sizes = { md: 'h-14 rounded-[18px] px-6', sm: 'h-10 rounded-[14px] px-4' };

type Props = PressableProps & { title: string; variant?: keyof typeof styles; size?: keyof typeof sizes; loading?: boolean; icon?: ReactNode; className?: string };

export function Button({ title, variant = 'primary', size = 'md', loading, icon, disabled, className = '', onPress, onPressIn, onPressOut, ...rest }: Props) {
  const s = styles[variant];
  const [down, setDown] = useState(false);
  const off = !!disabled && variant !== 'secondary' && variant !== 'ghost';
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
      {!off && (variant === 'primary' || variant === 'dark') ? <Sheen opacity={variant === 'primary' ? 0.3 : 0.08} /> : null}
      {down && variant !== 'ghost' ? <View pointerEvents="none" className="absolute inset-0 bg-[#0000000F]" /> : null}
      {loading ? (
        <ActivityIndicator color={s.spin} />
      ) : (
        <>
          {icon}
          <Text variant="label" className={`shrink ${off ? 'text-muted' : s.text}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}
