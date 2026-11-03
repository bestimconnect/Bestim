import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

type Corner = 'tl' | 'tr' | 'bl' | 'br';
const centre = { tl: [0, 0], tr: [1, 0], bl: [0, 1], br: [1, 1] } as const;

/**
 * A one-colour gradient laid over a surface (same hue at two opacities, never a second colour).
 * Without `glow` it fades top to bottom (`flip`: bottom to top); with `glow` it is a soft pool of light spilling from that corner.
 * Draws with react-native-svg (already installed), so no native module. Put it first inside an overflow-hidden parent.
 */
export function Sheen({ color = '#FFFFFF', opacity = 0.1, glow, radius = 1, flip }: { color?: string; opacity?: number; glow?: Corner; radius?: number; flip?: boolean }) {
  const id = useId().replace(/\W/g, '');
  const [cx, cy] = glow ? centre[glow] : [0, 0];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
      <Defs>
        {glow ? (
          <RadialGradient id={id} cx={cx} cy={cy} r={radius}>
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        ) : (
          <LinearGradient id={id} x1="0" y1={flip ? '1' : '0'} x2="0" y2={flip ? '0' : '1'}>
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        )}
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
