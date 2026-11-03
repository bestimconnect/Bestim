import { useGlobalSearchParams, useSegments } from 'expo-router';
import { vars } from 'nativewind';

import { useSettings, type Theme } from '@/stores/settingsStore';

import { palette } from './palette';

export type Colors = typeof palette.light;

const toVars = (p: Colors) => vars(Object.fromEntries(Object.entries(p).map(([k, v]) => [`--${k}`, v])));
export const themeVars = { light: toVars(palette.light), dark: toVars(palette.dark) };

/**
 * Active theme: the user's choice inside the app; first-run flows (auth + onboarding) are always light.
 * Adding another vehicle later reuses the onboarding screens with ?mode=extra and follows the theme.
 */
export function useScheme(): Theme {
  const theme = useSettings((s) => s.theme);
  const group = useSegments()[0];
  const { mode } = useGlobalSearchParams<{ mode?: string }>();
  return group === '(auth)' || (group === '(onboarding)' && mode !== 'extra') ? 'light' : theme;
}

/** Raw hex colors for props that don't take className (icons, placeholderTextColor). */
export function useColors(): Colors {
  return palette[useScheme()];
}

// RN >= 0.76 supports CSS boxShadow strings natively.
export const shadows = {
  card: '0 4px 16px rgba(0,0,0,0.06)',
  soft: '0 4px 8px rgba(0,0,0,0.06)', // Figma items
  elevated: '0 8px 24px -2px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.04)',
  glow: '0 4px 12px rgba(211,245,61,0.18)', // primary button; softer than Figma's (founder, 2026-10-01)
  nav: '0 -4px 20px -2px rgba(0,0,0,0.16)',
  field: 'inset 0 1px 3px rgba(0,0,0,0.05)',
  // Card depth (Q124): a tight contact shadow plus a soft lift, so cards sit on the page instead of floating in a haze.
  lift: '0 1px 2px rgba(16,24,20,0.05), 0 8px 20px -6px rgba(16,24,20,0.10)',
  focus: '0 0 0 3px rgba(8,115,111,0.16)', // input focus ring (teal)
} as const;

/**
 * The spacing / shape rules every screen follows (Q124).
 * Radii: 12 chips and small controls · 16 inputs · 18 buttons and rows (`rounded-item`) · 28 big cards and sheets.
 * Page gutter 24; 12 between things in a group; 24 between sections (`Section`); pinned actions in `FooterBar`.
 */
