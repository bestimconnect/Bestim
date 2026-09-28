import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { shadows } from '@/lib/theme';
import { Text } from './Text';

// On-lime and on-danger text stay fixed: the ink/white tokens invert in dark mode.
const styles = {
  primary: { box: 'bg-lime', text: 'text-[#222E29]', shadow: shadows.glow },
  secondary: { box: 'bg-white border border-line', text: 'text-ink', shadow: undefined },
  dark: { box: 'bg-ink', text: 'text-paper', shadow: undefined },
  danger: { box: 'bg-danger', text: 'text-[#FFFFFF]', shadow: undefined },
};

type Props = PressableProps & { title: string; variant?: keyof typeof styles; loading?: boolean; className?: string };

export function Button({ title, variant = 'primary', loading, disabled, className = '', ...rest }: Props) {
  const s = styles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`h-14 flex-row items-center justify-center rounded-field px-6 active:opacity-80 ${s.box} ${disabled ? 'opacity-50' : ''} ${className}`}
      style={{ boxShadow: s.shadow }}
      {...rest}>
      {loading ? <ActivityIndicator color="#222E29" /> : <Text variant="label" className={s.text}>{title}</Text>}
    </Pressable>
  );
}
