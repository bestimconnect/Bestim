import { useColorScheme } from 'react-native';
import { vars } from 'nativewind';

import { palette } from './palette';

export type Colors = typeof palette.light;

const toVars = (p: Colors) => vars(Object.fromEntries(Object.entries(p).map(([k, v]) => [`--${k}`, v])));
export const themeVars = { light: toVars(palette.light), dark: toVars(palette.dark) };

/** Raw hex colors for props that don't take className (icons, placeholderTextColor). */
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}

// RN >= 0.76 supports CSS boxShadow strings natively.
export const shadows = {
  card: '0 4px 16px rgba(0,0,0,0.06)',
  soft: '0 2px 8px rgba(0,0,0,0.04)',
  elevated: '0 8px 24px -2px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.04)',
  glow: '0 6px 16px -2px rgba(211,245,61,0.35)',
  nav: '0 -4px 20px -2px rgba(0,0,0,0.16)',
  field: 'inset 0 1px 3px rgba(0,0,0,0.05)',
} as const;
