import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useColors, useScheme } from '@/lib/theme';

const tones = { mint: 'bg-mint', sky: 'bg-sky', amber: 'bg-amber', blush: 'bg-blush', lime: 'bg-lime', paper: 'bg-paper' };

/**
 * A soft rounded-square holder for an icon (Q124): the tone's colour flat (v2, Q133).
 * In dark a white sheen over a dark fill turns grey, so there the tile is the tone (or a faint white lift for `paper`,
 * which would otherwise sit darker than its card) with a hairline edge in the icon colour.
 */
export function IconTile({ icon: Icon, tone = 'mint', size = 40, color }: { icon: LucideIcon; tone?: keyof typeof tones; size?: number; color?: string }) {
  const c = useColors();
  const dark = useScheme() === 'dark';
  const calm = dark && tone !== 'lime';
  const ink = color ?? (tone === 'lime' ? '#222E29' : c.teal);
  return (
    <View
      className={`items-center justify-center overflow-hidden ${calm && tone === 'paper' ? '' : tones[tone]}`}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.34),
        ...(calm ? { borderWidth: 1, borderColor: `${ink}2E`, ...(tone === 'paper' ? { backgroundColor: '#FFFFFF0F' } : null) } : null),
      }}>
      <Icon size={Math.round(size * 0.5)} color={ink} />
    </View>
  );
}
