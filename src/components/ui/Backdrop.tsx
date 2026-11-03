import { View } from 'react-native';

import { useScheme } from '@/lib/theme';
import { Sheen } from './Sheen';

/**
 * The page's depth layer (Q124): a faint tint falling from the top and a soft pool of light in one corner, so the page
 * is never a flat slab. First child of a screen root (which keeps its own `bg-paper` underneath). Light: green tint + lime
 * glow; dark: a lift of white + a teal glow. Same hue family only.
 */
export function Backdrop() {
  const dark = useScheme() === 'dark';
  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-0 h-[62%]">
      <Sheen color={dark ? '#FFFFFF' : '#08736F'} opacity={dark ? 0.035 : 0.07} />
      <Sheen color={dark ? '#3ECFC0' : '#D3F53D'} opacity={dark ? 0.08 : 0.11} glow="tr" radius={0.9} />
    </View>
  );
}
