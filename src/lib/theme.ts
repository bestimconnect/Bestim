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
  // v2 (Q133): flat tiles carry only a 1px ring; the floating nav pill and the voice button lift a little.
  // Q141 (founder, 2026-11-23): the flat ring became soft depth: a hairline, a tight contact shadow and a soft lift.
  ring: '0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(16,24,20,0.06), 0 10px 22px -8px rgba(16,24,20,0.16)',
  pill: '0 8px 24px rgba(0,0,0,0.08)',
  // Founder (2026-11-23): the nav's edge must stay visible over white cards.
  navPill: '0 0 0 1px rgba(0,0,0,0.07), 0 0 16px rgba(16,24,20,0.16), 0 6px 20px rgba(16,24,20,0.12)',
  fab: '0 8px 24px rgba(0,0,0,0.18)',
  // Figma effect styles (Elevation/*) by their design-system names, plus the selected segment's lift (`.sg span.on`).
  hair: '0 0 0 1px rgba(0,0,0,0.03)',
  float: '0 8px 24px rgba(0,0,0,0.08)',
  button: '0 8px 24px rgba(0,0,0,0.18)',
  dialog: '0 24px 60px rgba(0,0,0,0.28)',
  segment: '0 1px 4px rgba(0,0,0,0.08)',
} as const;

/** Figma `Bestim layout` variables: radii (Radius/*) and the spacing steps (Space/*). Tailwind: rounded-input/row/tile/sheet. */
export const radius = { input: 18, row: 22, tile: 24, sheet: 36, pill: 999 } as const;
export const space = [4, 8, 12, 16, 20, 24, 32] as const;

/**
 * The spacing / shape rules every screen follows (Q124).
 * Radii: 12 chips and small controls · 16 inputs · 18 buttons and rows (`rounded-item`) · 28 big cards and sheets.
 * Page gutter 24; 12 between things in a group; 24 between sections (`Section`); pinned actions in `FooterBar`.
 */
