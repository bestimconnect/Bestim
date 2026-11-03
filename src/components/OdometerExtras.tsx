import * as Haptics from 'expo-haptics';
import { useEffect, useId, useRef, useState } from 'react';
import { View } from 'react-native';
import { cancelAnimation, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { useColors } from '@/lib/theme';

/** A small fine-tune button under the ruler: one tap = one step; hold it and the step repeats (for an exact number). */
export function Nudge({ shown, step, max }: { shown: SharedValue<number>; step: number; max: number }) {
  const { t } = useTranslation();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = () => {
    cancelAnimation(shown);
    shown.set(Math.min(max, Math.max(0, Math.round(shown.get()) + step)));
    Haptics.selectionAsync();
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const loop = () => {
    bump();
    timer.current = setTimeout(loop, 70);
  };
  useEffect(() => stop, []);
  const sign = step > 0 ? '+' : '−';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('odometer.nudge', { n: `${sign}${Math.abs(step)}` })}
      onPressIn={() => {
        bump();
        timer.current = setTimeout(loop, 380);
      }}
      onPressOut={stop}
      className="h-10 min-w-[56px] items-center justify-center rounded-full border border-line bg-white px-3">
      <Text variant="caption" className="text-ink" style={{ fontFamily: 'Poppins_700Bold' }}>{sign}{Math.abs(step)}</Text>
    </PressableScale>
  );
}

const H = 84;
const PAD = 10;

/** The last readings as a smooth teal area chart (oldest to newest); the final point is the reading on screen now. */
export function Trend({ values }: { values: number[] }) {
  const c = useColors();
  const id = useId().replace(/\W/g, '');
  const [w, setW] = useState(0);
  const n = values.length;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const xs = (i: number) => PAD + (i * (w - 2 * PAD)) / Math.max(1, n - 1);
  const ys = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - lo) / Math.max(1, hi - lo));
  const line = values.map((v, i) => {
    if (!i) return `M${xs(0)} ${ys(v)}`;
    const mid = (xs(i - 1) + xs(i)) / 2; // smooth S-curve between neighbours
    return `C${mid} ${ys(values[i - 1])} ${mid} ${ys(v)} ${xs(i)} ${ys(v)}`;
  }).join(' ');
  return (
    <View style={{ direction: 'ltr', height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && n > 1 ? (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.teal} stopOpacity={0.28} />
              <Stop offset="1" stopColor={c.teal} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={`${line} L${xs(n - 1)} ${H} L${xs(0)} ${H}Z`} fill={`url(#${id})`} />
          <Path d={line} fill="none" stroke={c.teal} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          {values.slice(0, -1).map((v, i) => <Circle key={i} cx={xs(i)} cy={ys(v)} r={2.5} fill={c.teal} />)}
          <Circle cx={xs(n - 1)} cy={ys(values[n - 1])} r={6} fill="#D3F53D" stroke={c.teal} strokeWidth={2.4} />
        </Svg>
      ) : null}
    </View>
  );
}
