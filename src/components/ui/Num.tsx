import { Text as RNText, type TextStyle } from 'react-native';

import { useColors } from '@/lib/theme';

/**
 * The big thin numeral (v2 `.num`, Figma Number/*): Poppins Light, tabular, -0.04em tracking, always left-to-right so digits
 * never reorder; the unit sits beside it at 0.42 of the size in muted. Shrinks to fit instead of wrapping.
 */
export function Num({ value, unit, size = 28, color }: { value: string; unit?: string; size?: number; color?: string }) {
  const c = useColors();
  const base: TextStyle = { fontFamily: 'Poppins_300Light', fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: 'left' };
  return (
    <RNText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ ...base, fontSize: size, lineHeight: Math.round(size * 1.15), letterSpacing: -size * 0.04, color: color ?? c.ink }}>
      {value}
      {unit ? <RNText style={{ ...base, fontFamily: 'Poppins_400Regular', fontSize: Math.max(11, size * 0.42), letterSpacing: 0, color: c.muted }}>{` ${unit}`}</RNText> : null}
    </RNText>
  );
}
