import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop, Line } from 'react-native-svg';

import { easeOut } from '@/lib/motion';

const SWEEP = 120; // the needle sweeps -120deg..+120deg (7 o'clock to 5 o'clock)
const RANGE = 1500; // km driven since the last saved reading that fills the arc

/** Needle angle for the distance driven since the last saved reading. Pure, so it is easy to check. */
export const needleAngle = (delta: number) => {
  'worklet'; // called on the UI thread by the needle animation
  return -SWEEP + (Math.min(RANGE, Math.max(0, delta)) / RANGE) * SWEEP * 2;
};

// The dial's face. Drawn in code for now (white glossy bezel, dark rim, graphite face, lime major ticks, hub, glass).
// To use the 3D render later: replace this component's body with
//   <Image source={require('@/assets/odometer-dial.webp')} style={{ width: size, height: size }} />
// (no needle and no digits in the picture; the needle below stays an overlay).
function Base({ size }: { size: number }) {
  const ticks = Array.from({ length: 26 }, (_, i) => ({ a: -SWEEP + i * 9.6, major: i % 5 === 0 }));
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="odoBez" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.5" stopColor="#E7ECE9" />
          <Stop offset="1" stopColor="#B9C3BE" />
        </LinearGradient>
        <LinearGradient id="odoRim" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#0B0F0D" />
          <Stop offset="1" stopColor="#3A4741" />
        </LinearGradient>
        <RadialGradient id="odoFace" cx="0.35" cy="0.3" r="1">
          <Stop offset="0" stopColor="#3A4741" />
          <Stop offset="0.6" stopColor="#171E1B" />
          <Stop offset="1" stopColor="#0B0F0D" />
        </RadialGradient>
        <RadialGradient id="odoHub" cx="0.35" cy="0.3" r="0.9">
          <Stop offset="0" stopColor="#F4F7F5" />
          <Stop offset="0.55" stopColor="#AEB8B3" />
          <Stop offset="1" stopColor="#69746F" />
        </RadialGradient>
        <LinearGradient id="odoGloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.38} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Circle cx={100} cy={100} r={97} fill="url(#odoBez)" stroke="#FFFFFF" strokeWidth={1} />
      <Circle cx={100} cy={100} r={88} fill="url(#odoRim)" />
      <Circle cx={100} cy={100} r={82} fill="url(#odoFace)" />
      {ticks.map(({ a, major }) => (
        <Line
          key={a}
          x1={100} y1={30} x2={100} y2={major ? 42 : 38}
          stroke={major ? '#D3F53D' : '#7C8A83'} strokeWidth={major ? 3 : 1.6} strokeLinecap="round"
          rotation={a} originX={100} originY={100}
        />
      ))}
      <Circle cx={100} cy={100} r={11} fill="url(#odoHub)" />
      <Path d="M30 78 A74 74 0 0 1 170 78 A92 70 0 0 0 30 78Z" fill="url(#odoGloss)" />
    </Svg>
  );
}

/**
 * Screen 25's dashboard dial. `from` = the last saved reading: the needle shows how far `shown` is past it, over
 * 0..1500 (no `from` = the first reading, needle at rest). `children` sit inside the dial's lower part (the digits).
 */
export function OdometerDial({ shown, from, size = 236, children }: { shown: SharedValue<number>; from?: number; size?: number; children?: ReactNode }) {
  const still = useReducedMotion();
  const angle = useSharedValue(-SWEEP);
  useAnimatedReaction(
    () => (from == null ? -SWEEP : needleAngle(shown.value - from)),
    (a) => angle.set(withTiming(a, { duration: still ? 0 : 250, easing: easeOut })),
    [from, still],
  );
  const needle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] })); // rotates about the centre = the hub
  return (
    <View style={{ width: size, height: size }}>
      <Base size={size} />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, needle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M96 104 L100 34 L104 104 Z" fill="#D3F53D" />
          <Path d="M100 34 L104 104 L100 104 Z" fill="#9BB92A" />
          <Circle cx={100} cy={100} r={3.5} fill="#222E29" />
        </Svg>
      </Animated.View>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: size * 0.7, alignItems: 'center' }}>{children}</View>
    </View>
  );
}
