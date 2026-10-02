import type { ReactNode } from 'react';
import { ActivityIndicator, type PressableProps } from 'react-native';

import { shadows } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

// On-lime and on-danger text stay fixed: the ink/white tokens invert in dark mode.
const styles = {
  primary: { box: 'bg-lime', text: 'text-[#222E29]', shadow: shadows.glow },
  secondary: { box: 'bg-white border border-line', text: 'text-ink', shadow: undefined },
  dark: { box: 'bg-panel', text: 'text-onpanel', shadow: undefined },
  danger: { box: 'bg-danger', text: 'text-[#FFFFFF]', shadow: undefined },
};

type Props = PressableProps & { title: string; variant?: keyof typeof styles; loading?: boolean; icon?: ReactNode; className?: string };

export function Button({ title, variant = 'primary', loading, icon, disabled, className = '', ...rest }: Props) {
  const s = styles[variant];
  return (
    <PressableScale
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`h-[52px] flex-row items-center justify-center gap-2 rounded-field px-6 ${s.box} ${disabled ? 'opacity-50' : ''} ${className}`}
      {...rest}
      style={{ boxShadow: s.shadow }}>
      {loading ? (
        <ActivityIndicator color="#222E29" />
      ) : (
        <>
          {icon}
          <Text variant="label" className={s.text}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}
