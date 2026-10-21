import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { fmt, type Point } from '@/lib/expensePeriods';
import { easeOut } from '@/lib/motion';

const H = 132; // chart height
const PB = 18; // room for the x labels
const PT = 10;
const PX = 8; // keeps the end dots inside the box
const LIME = '#D3F53D';
const SOFT = '#9FB0A7';

/**
 * The dark block of the Expenses tab: period navigator, selected amount + period total, and a smooth area chart.
 * Time runs left to right in Arabic too (founder): swipe right = earlier period, left = later. Tap or hold-and-drag moves the dot.
 * ponytail: the dot redraws the whole (<= 31 points) SVG per touch move; fine at this size, move it to a shared value if it ever stutters.
 */
export function ExpenseChart({
  periodKey,
  title,
  points,
  total,
  pointName,
  onStep,
  canOlder,
  canNewer,
}: {
  periodKey: string;
  title: string;
  points: Point[];
  total: number;
  pointName: (n: number) => string;
  /** -1 = earlier period, 1 = later. */
  onStep: (by: -1 | 1) => void;
  canOlder: boolean;
  canNewer: boolean;
}) {
  const { t } = useTranslation();
  const [w, setW] = useState(0);
  const [picked, setPicked] = useState<{ key: string; i: number } | null>(null);
  const still = useReducedMotion();
  const tx = useSharedValue(0);
  const op = useSharedValue(1);
  const prev = useRef(periodKey);

  // New period: the content slides in 44pt from the side it came from (earlier = from the left) and fades up.
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = periodKey;
    if (before === periodKey || still) return;
    const sameKind = before.length === periodKey.length; // month <-> year switch just fades
    tx.set(sameKind ? (periodKey < before ? -44 : 44) : 0);
    op.set(0);
    tx.set(withTiming(0, { duration: 280, easing: easeOut }));
    op.set(withTiming(1, { duration: 280, easing: easeOut }));
  }, [periodKey, still, tx, op]);
  const slide = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateX: tx.value }] }));

  const n = points.length;
  const last = Math.max(0, points.map((p) => !p.future).lastIndexOf(true));
  const live = points.slice(0, last + 1);
  const max = Math.max(1, ...live.map((p) => p.total));
  const unit = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / unit) * unit;
  const base = H - PB;
  const xs = (i: number) => PX + (n > 1 ? i / (n - 1) : 0) * Math.max(0, w - 2 * PX);
  const ys = (v: number) => base - (v / top) * (base - PT);
  let line = live.length ? `M${xs(0)} ${ys(live[0].total)}` : '';
  for (let i = 1; i < live.length; i++) {
    const mid = (xs(i - 1) + xs(i)) / 2; // flat tangents at each point: never dips below the baseline
    line += ` C${mid} ${ys(live[i - 1].total)} ${mid} ${ys(live[i].total)} ${xs(i)} ${ys(live[i].total)}`;
  }
  const si = picked?.key === periodKey ? Math.min(picked.i, last) : last;
  const sel = points[si];

  const at = (x: number) => Math.max(0, Math.min(last, Math.round(((x - PX) / Math.max(1, w - 2 * PX)) * (n - 1))));
  const step = (by: -1 | 1) => {
    if (by < 0 ? !canOlder : !canNewer) return;
    Haptics.selectionAsync();
    onStep(by);
  };
  const pick = (x: number) => setPicked({ key: periodKey, i: at(x) });
  const gesture = Gesture.Race(
    Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-12, 12]) // a vertical drag still scrolls the page
      .failOffsetY([-14, 14])
      .onEnd((e) => {
        if (Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 700) step(e.translationX > 0 ? -1 : 1);
      }),
    Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(250)
      .onStart((e) => pick(e.x))
      .onUpdate((e) => pick(e.x)),
    Gesture.Tap().runOnJS(true).onEnd((e) => pick(e.x)),
  );

  return (
    <View className="gap-3 rounded-metric bg-panel p-4">
      {/* direction ltr: older on the left, newer on the right, in Arabic too. */}
      <View className="flex-row items-center justify-between" style={{ direction: 'ltr' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('expenses.earlier')}
          accessibilityState={{ disabled: !canOlder }}
          disabled={!canOlder}
          onPress={() => step(-1)}
          className={`h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF24] ${canOlder ? '' : 'opacity-30'}`}>
          <ChevronLeft size={20} color="#F5F7F5" />
        </Pressable>
        <Text variant="label" className="text-onpanel">{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('expenses.later')}
          accessibilityState={{ disabled: !canNewer }}
          disabled={!canNewer}
          onPress={() => step(1)}
          className={`h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF24] ${canNewer ? '' : 'opacity-30'}`}>
          <ChevronRight size={20} color="#F5F7F5" />
        </Pressable>
      </View>
      <GestureDetector gesture={gesture}>
        <Animated.View className="gap-2" style={slide}>
          <View className="flex-row items-end justify-between gap-3">
            <View className="flex-1">
              <Text variant="caption" className="text-[#9FB0A7]">{sel ? pointName(sel.n) : ''}</Text>
              <Text variant="number" className="text-onpanel" numberOfLines={1} style={{ fontSize: 26, lineHeight: 34 }}>
                {fmt(sel?.total ?? 0)} <Text variant="caption" className="text-[#9FB0A7]">{t('expenses.currency')}</Text>
              </Text>
            </View>
            <View className="items-end">
              <Text variant="caption" className="text-[#9FB0A7]">{t('expenses.periodTotal')}</Text>
              <Text variant="label" className="text-onpanel" numberOfLines={1}>{fmt(total)} {t('expenses.currency')}</Text>
            </View>
          </View>
          <View style={{ direction: 'ltr', height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
            {w > 0 && live.length > 0 ? (
              <Svg width={w} height={H}>
                <Defs>
                  <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={LIME} stopOpacity={0.35} />
                    <Stop offset="1" stopColor={LIME} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {[0, 0.5, 1].map((k) => (
                  <Line key={k} x1={0} x2={w} y1={PT + (base - PT) * k} y2={PT + (base - PT) * k} stroke="#FFFFFF" strokeOpacity={0.12} />
                ))}
                <Path d={`${line} L${xs(last)} ${base} L${xs(0)} ${base}Z`} fill="url(#area)" />
                <Path d={line} fill="none" stroke={LIME} strokeWidth={2.2} strokeLinecap="round" />
                <Line x1={xs(si)} x2={xs(si)} y1={PT} y2={base} stroke="#FFFFFF" strokeOpacity={0.5} strokeDasharray="3 3" />
                <Circle cx={xs(si)} cy={ys(sel.total)} r={5} fill={LIME} stroke="#222E29" strokeWidth={2} />
                {points.map((p, i) =>
                  p.n === 1 || p.n % 5 === 0 || n === 12 ? (
                    <SvgText key={p.n} x={xs(i)} y={H - 4} textAnchor="middle" fontSize={9} fill={SOFT} fontFamily="Poppins_400Regular">{p.n}</SvgText>
                  ) : null,
                )}
              </Svg>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
