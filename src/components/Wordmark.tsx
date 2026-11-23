import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { PATH_B, PATH_B_LENGTH, PATH_BLADE, PATH_LETTERS } from '@/lib/wordmarkPaths';

// The animated Bestim logo (motion spec: design-v2/motion/SPLASH-AND-ONBOARDING-MOTION.md, docs/SPLASH-MOTION-BUILD-PROMPT.md).
// Everything is driven by ONE clock `t` (ms since the first frame) on the UI thread. The picture is three stacked SVG layers
// (letters / B body + shine / blade) so group moves (scale, slide, pulse) are plain view transforms. Never mirrored in RTL.
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const VB_W = 3600;
const VB_H = 776;
const FLIP = `translate(0,${VB_H}) scale(0.1,-0.1)`; // potrace output: 10x units, y up
const LIME = '#D3F53D';
const B_CX = 683;
const CX = VB_W / 2;

const SOFT = Easing.bezier(0.55, 0, 0.25, 1).factory();
const BLADE = Easing.bezier(0.2, 0.85, 0.25, 1.12).factory();
const SHINE = Easing.bezier(0.4, 0, 0.2, 1).factory();
const PULSE = Easing.bezier(0.3, 0.8, 0.3, 1).factory();
const MOVE = Easing.bezier(0.65, 0, 0.25, 1).factory();
const OUT = Easing.bezier(0.25, 0.1, 0.25, 1).factory(); // CSS "ease"
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1).factory();

/** Progress 0..1 of a step that runs from `start` for `dur` ms, eased. */
function step(t: number, start: number, dur: number, ease: (x: number) => number) {
  'worklet';
  return ease(Math.min(1, Math.max(0, (t - start) / dur)));
}

/** Opacity of the whole splash layer: 1 until 4,500 ms, then 500 ms ease out (step 9). */
export const splashFade = (t: number) => {
  'worklet';
  return 1 - step(t, 4500, 500, OUT);
};

export function Wordmark({ t, ink, width }: { t: SharedValue<number>; ink: string; width: number }) {
  const k = width / VB_W; // viewBox unit -> pt
  const height = k * VB_H;

  // 6: whole logo 1.9 -> 1 about the centre (the view centre is the viewBox centre, so a plain scale does it)
  const all = useAnimatedStyle(() => ({ transform: [{ scale: 1.9 - 0.9 * step(t.get(), 2450, 850, MOVE) }] }));
  // 7 + 5: B group slides from +1117 to 0, and pulses 1 -> 1.04 -> 1 about the B centre (683, 388)
  const bGroup = useAnimatedStyle(() => {
    const v = t.get();
    const x = 1117 * (1 - step(v, 2450, 850, MOVE));
    const pulse = 1 + 0.04 * Math.sin(Math.PI * step(v, 1950, 550, PULSE));
    const ox = (B_CX - CX) * k; // B centre relative to the view centre (same height)
    return { transform: [{ translateX: x * k + ox }, { scale: pulse }, { translateX: -ox }] };
  });
  // 3: blade slides in from -900 with a small overshoot, fading in over the first 25%
  const blade = useAnimatedStyle(() => {
    const p = step(t.get(), 1450, 650, BLADE);
    const lin = Math.min(1, Math.max(0, (t.get() - 1450) / 650));
    return { opacity: interpolate(lin, [0, 0.25], [0, 1], 'clamp'), transform: [{ translateX: -900 * (1 - p) * k }] };
  });
  // 1 + 2: B outline draws, then fills while the outline fades
  const outline = useAnimatedProps(() => {
    const v = t.get();
    const fill = step(v, 950, 600, EASE_OUT);
    return { strokeDashoffset: PATH_B_LENGTH * (1 - step(v, 150, 1150, SOFT)), fillOpacity: fill, strokeOpacity: 1 - fill };
  });
  // 4: one lime shine band crosses the B (x in 10x path units: -300 -> 1500 viewBox units), opacity .7
  const shine = useAnimatedProps(() => {
    const v = t.get();
    const p = step(v, 2000, 750, SHINE);
    return { x: (-300 + 1800 * p) * 10, opacity: v >= 2000 && v <= 2750 ? 0.7 : 0 };
  });
  // 8: name wipe, a clip rect over the letters growing from its left edge (x 1000)
  const wipe = useAnimatedProps(() => ({ width: 2700 * step(t.get(), 3000, 900, MOVE) }));

  const layer = { position: 'absolute', width, height } as const;
  return (
    <Animated.View style={[{ width, height }, all]}>
      <View style={layer}>
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Defs>
            <ClipPath id="wipe">
              <AnimatedRect x={1000} y={0} height={VB_H} animatedProps={wipe} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#wipe)">
            <G transform={FLIP}>
              <Path d={PATH_LETTERS} fill={ink} />
            </G>
          </G>
        </Svg>
      </View>
      <Animated.View style={[layer, bGroup]}>
        <View style={StyleSheet.absoluteFill}>
          <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Defs>
              <ClipPath id="bclip">
                <G transform={FLIP}>
                  <Path d={PATH_B} />
                </G>
              </ClipPath>
            </Defs>
            <G transform={FLIP}>
              <AnimatedPath d={PATH_B} fill={ink} stroke={ink} strokeWidth={300} strokeLinejoin="round" strokeDasharray={[PATH_B_LENGTH, PATH_B_LENGTH]} animatedProps={outline} />
            </G>
            <G clipPath="url(#bclip)">
              <G transform={FLIP}>
                <AnimatedRect y={0} width={1900} height={VB_H * 10} fill={LIME} transform="skewX(24)" animatedProps={shine} />
              </G>
            </G>
          </Svg>
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, blade]}>
          <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <G transform={FLIP}>
              <Path d={PATH_BLADE} fill={LIME} />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** Finished logo (Reduce Motion). */
export function WordmarkStill({ ink, width }: { ink: string; width: number }) {
  const height = (width * VB_H) / VB_W;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <G transform={FLIP}>
        <Path d={PATH_LETTERS} fill={ink} />
        <Path d={PATH_B} fill={ink} />
        <Path d={PATH_BLADE} fill={LIME} />
      </G>
    </Svg>
  );
}
