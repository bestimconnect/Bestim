import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Line, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Num } from '@/components/money/Num';
import { Text } from '@/components/ui';
import { fmt, type Point } from '@/lib/expensePeriods';
import { easeOut } from '@/lib/motion';
import { shadows, useColors } from '@/lib/theme';

const H = 128; // v2 `.chartbox`

/**
 * Money tab, v2: period navigator + big total, then a flat bar chart in a white tile. The selected bar is hatched (ok green) with an
 * ink cap and a tip pill with its amount; the rest are paper columns with a hairline top. Time runs left to right in Arabic too:
 * swipe right = earlier period, left = later. Tap or hold-and-drag picks a bar.
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
  change,
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
  /** Change against the previous period, already formatted ('+12%'), or null. */
  change?: { text: string; up: boolean } | null;
}) {
  const { t } = useTranslation();
  const c = useColors();
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
  const max = Math.max(1, ...points.map((p) => (p.future ? 0 : p.total)));
  const spent = points.map((p) => !p.future && p.total > 0).lastIndexOf(true); // default: the latest bar with spending
  const si = picked?.key === periodKey ? Math.min(picked.i, last) : spent >= 0 ? spent : last;
  const sel = points[si];
  const bw = w / Math.max(1, n);
  const bh = (p: Point) => (p.future ? 0 : Math.max(p.total > 0 ? 4 : 0, (p.total / max) * (H - 44)));

  const at = (x: number) => Math.max(0, Math.min(last, Math.floor(x / Math.max(1, bw))));
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

  // The tip sits above the picked bar, kept inside the tile.
  const tipW = 112;
  const tipLeft = Math.max(8, Math.min(w - tipW - 8, si * bw + bw / 2 - tipW / 2));
  const tipTop = Math.max(8, H - bh(sel ?? points[0]) - 44);

  return (
    <View className="gap-3">
      {/* direction ltr: older on the left, newer on the right, in Arabic too. */}
      <View className="flex-row items-center justify-between" style={{ direction: 'ltr' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('expenses.earlier')}
          accessibilityState={{ disabled: !canOlder }}
          disabled={!canOlder}
          onPress={() => step(-1)}
          className={`h-11 w-11 items-center justify-center rounded-full bg-white ${canOlder ? '' : 'opacity-30'}`}
          style={{ boxShadow: shadows.ring }}>
          <ChevronLeft size={20} color={c.ink} />
        </Pressable>
        <Text variant="label" numberOfLines={1}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('expenses.later')}
          accessibilityState={{ disabled: !canNewer }}
          disabled={!canNewer}
          onPress={() => step(1)}
          className={`h-11 w-11 items-center justify-center rounded-full bg-white ${canNewer ? '' : 'opacity-30'}`}
          style={{ boxShadow: shadows.ring }}>
          <ChevronRight size={20} color={c.ink} />
        </Pressable>
      </View>
      <GestureDetector gesture={gesture}>
        <Animated.View className="gap-3" style={slide}>
          <View className="flex-row items-end justify-between gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="caption" className="text-muted" numberOfLines={1}>{t('expenses.periodTotal')}</Text>
              <Num value={fmt(total)} unit={t('expenses.currency')} size={44} />
            </View>
            {change ? (
              <View className={`rounded-full px-3 py-1 ${change.up ? 'bg-lateTint' : 'bg-okTint'}`}>
                <Text variant="caption" className={change.up ? 'text-late' : 'text-ok'} style={{ fontVariant: ['tabular-nums'], writingDirection: 'ltr' }}>{change.text}</Text>
              </View>
            ) : null}
          </View>
          <View className="overflow-hidden rounded-[24px] bg-white" style={{ direction: 'ltr', height: H, boxShadow: shadows.ring }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
            {w > 0 ? (
              <Svg width={w} height={H}>
                <Defs>
                  {sel ? (
                    <ClipPath id="sel">
                      <Rect x={si * bw} y={H - bh(sel)} width={bw} height={bh(sel)} />
                    </ClipPath>
                  ) : null}
                </Defs>
                {points.map((p, i) => (i === si ? null : <Rect key={p.n} x={i * bw} y={H - bh(p)} width={bw} height={bh(p)} fill={c.paper} />))}
                {/* the picked bar: green with light diagonal stripes (drawn, since SVG patterns render as triangles on iOS) */}
                {sel && bh(sel) > 0 ? (
                  <>
                    <Rect x={si * bw} y={H - bh(sel)} width={bw} height={bh(sel)} fill={c.ok} />
                    {Array.from({ length: Math.ceil((bw + H) / 14) + 1 }, (_, k) => (
                      <Line key={k} clipPath="url(#sel)" x1={si * bw + k * 14} y1={H - bh(sel)} x2={si * bw + k * 14 - H} y2={H} stroke={c.paper} strokeOpacity={0.4} strokeWidth={7} />
                    ))}
                  </>
                ) : null}
                {points.map((p, i) => (i === si || p.future || bh(p) === 0 ? null : <Line key={`t${p.n}`} x1={i * bw} x2={(i + 1) * bw} y1={H - bh(p) + 0.5} y2={H - bh(p) + 0.5} stroke={c.tick} />))}
                {sel && bh(sel) > 0 ? <Rect x={si * bw} y={H - bh(sel)} width={bw} height={2} fill={c.ink} /> : null}
              </Svg>
            ) : null}
            {sel ? (
              <View className="absolute items-center rounded-full bg-ink px-3 py-1.5" style={{ left: tipLeft, top: tipTop, width: tipW }} pointerEvents="none">
                <Text variant="caption" className="text-paper" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{`${fmt(sel.total)} ${t('expenses.currency')}`}</Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" className="text-center text-muted" numberOfLines={1}>{sel ? pointName(sel.n) : ''}</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
