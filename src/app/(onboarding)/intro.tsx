import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Check, Mic, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, interpolateColor, type SharedValue, runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { splashClock } from '@/lib/splashClock';
import { vehicleArt } from '@/lib/vehicleArt';
import { useSettings } from '@/stores/settingsStore';

// Three welcome slides (v2): Voice on lime, Reminders on dark green, Selling on teal. Big words, dots, Next / Skip.
// Slide copy and the little scenes are the design's (design-v2 `wsl`). Skip and Get started go to Sign in.
const LIME = '#D3F53D';
const INK = '#222E29';
const TEAL = '#08736F';
const DARK_TEXT = '#171B19';
const LIGHT_TEXT = '#F5F7F5';
const SLIDES = [
  { bg: LIME, fg: DARK_TEXT, sub: 'rgba(23,27,25,0.68)', dots: [DARK_TEXT, 'rgba(23,27,25,0.22)'], btn: INK, onBtn: LIME, mark: require('@/assets/images/logo-mark.png') },
  { bg: INK, fg: LIGHT_TEXT, sub: 'rgba(245,247,245,0.72)', dots: [LIME, 'rgba(255,255,255,0.28)'], btn: LIME, onBtn: DARK_TEXT, mark: require('@/assets/images/logo-mark-inverse.png') },
  { bg: TEAL, fg: LIGHT_TEXT, sub: 'rgba(245,247,245,0.72)', dots: [LIME, 'rgba(255,255,255,0.28)'], btn: LIME, onBtn: DARK_TEXT, mark: require('@/assets/images/logo-mark-inverse.png') },
] as const;
const SOFT = '0 12px 26px rgba(0,0,0,0.18)';

/** A row of small bars, `on` of them filled (the design's ticks). Always left to right. */
function Ticks({ on, total = 12, height, color }: { on: number; total?: number; height: number; color: string }) {
  return (
    <View className="flex-row items-end gap-1" style={{ direction: 'ltr', height }}>
      {Array.from({ length: total }, (_, k) => (
        <View key={k} className="flex-1 rounded-[2px]" style={{ height, backgroundColor: k < on ? color : '#E3E6E3' }} />
      ))}
    </View>
  );
}

// A fixed 9x9 pattern standing in for the QR code (decoration only).
const QR = ['111111101', '100000101', '101110101', '101110100', '101110111', '100000010', '111111101', '000100110', '110101011'];

function Scene({ n }: { n: number }) {
  const { t } = useTranslation();
  const w = (k: string) => t(`onboarding.welcome.${k}`);
  const rtl = I18nManager.isRTL;
  if (n === 0)
    return (
      <>
        <Image source={vehicleArt('sedan')} contentFit="contain" style={{ position: 'absolute', top: 50, start: '-8%', width: '116%', aspectRatio: 2 }} />
        <View className="absolute end-1.5 top-2 flex-row items-center gap-[9px] rounded-[22px] rounded-es-[6px] bg-white px-4 py-3" style={{ boxShadow: '0 10px 26px rgba(0,0,0,0.12)' }}>
          <View className="h-[30px] w-[30px] items-center justify-center rounded-full" style={{ backgroundColor: INK }}>
            <Mic size={15} color={LIME} strokeWidth={2} />
          </View>
          <Text className="!text-[14.5px] text-[#171B19]">{w('say')}</Text>
        </View>
        <View className="absolute bottom-[26px] start-0.5 flex-row items-center gap-[7px] rounded-full px-3.5 py-[9px]" style={{ backgroundColor: INK }}>
          <Check size={15} color={LIME} strokeWidth={2} />
          <Text className="!text-[13px] text-[#D3F53D]">{w('saved')}</Text>
        </View>
      </>
    );
  if (n === 1) {
    const rows = [
      { name: w('oil'), when: w('in480'), on: 3, color: '#E0A23A', shift: 0 },
      { name: w('brakes'), when: w('in2100'), on: 8, color: '#4C9A4A', shift: -14 },
      { name: w('tires'), when: w('in6m'), on: 10, color: '#4C9A4A', shift: 10 },
    ];
    return (
      <View className="gap-[11px] pt-3.5">
        {rows.map((r) => (
          <View key={r.name} className="rounded-[24px] bg-white px-4 py-3.5" style={{ boxShadow: SOFT, transform: [{ translateX: r.shift * (rtl ? -1 : 1) }] }}>
            <View className="flex-row items-center justify-between">
              <Text className="!text-[14.5px] text-[#171B19]">{r.name}</Text>
              <Text className="!text-[13px] text-[#6A746E]">{r.when}</Text>
            </View>
            <View className="mt-[9px]"><Ticks on={r.on} height={22} color={r.color} /></View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <>
      <View className="mx-2.5 mt-1.5 rounded-[30px] bg-white p-[18px]" style={{ boxShadow: '0 16px 34px rgba(0,0,0,0.22)' }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <ShieldCheck size={16} color="#4C9A4A" strokeWidth={2} />
            <Text className="!text-[13px] text-[#4C9A4A]">{w('verified')}</Text>
          </View>
          <Text className="!text-[13px] text-[#6A746E]">{w('ready')}</Text>
        </View>
        <View className="mt-3 flex-row items-center gap-3.5">
          <View className="flex-1">
            <Text variant="number" className="!text-[54px] !leading-[60px] text-[#171B19]">{'86'}<Text variant="number" className="!text-[20px] text-[#171B19]">%</Text></Text>
            <View className="mt-2.5"><Ticks on={10} height={24} color="#4C9A4A" /></View>
          </View>
          <View className="h-[92px] w-[92px] justify-between rounded-[10px] border border-[#E3E6E3] p-1.5" style={{ direction: 'ltr' }}>
            {QR.map((row, y) => (
              <View key={y} className="flex-1 flex-row">
                {[...row].map((d, x) => <View key={x} className="flex-1" style={{ backgroundColor: d === '1' ? '#171B19' : 'transparent' }} />)}
              </View>
            ))}
          </View>
        </View>
      </View>
      <Image source={vehicleArt('sedan')} contentFit="contain" style={{ width: '92%', aspectRatio: 2, marginTop: 18, marginHorizontal: '4%' }} />
    </>
  );
}

// Slide change = style A "Drift" (design-v2/motion): cross-fade plus a small drift in the reading direction (mirrored in Arabic).
// Four values follow the same page position (0..2): fade 650 ms, picture 900 ms, text 900 ms after a 90 ms delay, dots 450 ms.
// A swipe moves all of them with the finger, then they settle on the target with those durations. Only opacity and translateX move
// (the dots also change width, as designed). Reduce Motion: 250 ms cross-fade, no drift, dots jump.
const DRIFT = Easing.bezier(0.2, 0.7, 0.2, 1);
const clamp1 = (x: number) => {
  'worklet';
  return Math.min(1, Math.max(-1, x));
};
const near = (pos: number, i: number) => {
  'worklet';
  return Math.max(0, 1 - Math.abs(pos - i)); // 1 on its own slide, 0 a slide away
};
type Pos = { fade: SharedValue<number>; pic: SharedValue<number>; txt: SharedValue<number>; tfade: SharedValue<number>; dot: SharedValue<number> };

function Slide({ n, pos, dir, still, top, height, text }: { n: number; pos: Pos; dir: number; still: boolean; top: number; height: number; text: { title: string; body: string } }) {
  const s = SLIDES[n];
  const pic = useAnimatedStyle(() => ({ opacity: near(pos.fade.get(), n), transform: [{ translateX: still ? 0 : dir * 60 * clamp1(n - pos.pic.get()) }] }));
  const txt = useAnimatedStyle(() => ({ opacity: near(pos.tfade.get(), n), transform: [{ translateX: still ? 0 : dir * 22 * clamp1(n - pos.txt.get()) }] }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{ paddingTop: top }, pic]}>
        <View className="px-[22px] pt-3.5" style={{ height: 34 + 14 }}>
          <Image source={s.mark} contentFit="contain" style={{ width: 45, height: 34 }} />
        </View>
        <View className="mx-[22px] mt-4" style={{ height: Math.min(400, Math.max(330, height * 0.4)) }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Scene n={n} />
        </View>
      </Animated.View>
      <Animated.View className="px-6" style={[{ marginTop: 16 }, txt]}>
        <Text variant="title" className="!text-[29px] !leading-[36px]" style={{ color: s.fg }}>{text.title}</Text>
        <Text className="mt-2.5 !text-[15px] !leading-[24px]" style={{ color: s.sub }}>{text.body}</Text>
      </Animated.View>
    </View>
  );
}

function Dot({ i, pos }: { i: number; pos: Pos }) {
  const style = useAnimatedStyle(() => {
    const a = near(pos.dot.get(), i);
    const p = pos.fade.get();
    const on = interpolateColor(p, [0, 1, 2], SLIDES.map((s) => s.dots[0]));
    const off = interpolateColor(p, [0, 1, 2], SLIDES.map((s) => s.dots[1]));
    return { width: 7 + 17 * a, backgroundColor: a > 0.5 ? on : off };
  });
  return <Animated.View className="h-2 rounded-full" style={style} />;
}

/** One label of the button ("Next" / "Get started" with its arrow), shown while its slide is the current one. */
function Label({ n, pos, label, Arrow }: { n: number; pos: Pos; label: string; Arrow: typeof ArrowRight }) {
  const s = SLIDES[n];
  const style = useAnimatedStyle(() => ({ opacity: near(pos.fade.get(), n) }));
  return (
    <Animated.View className="absolute flex-row items-center gap-2" style={style}>
      <Text variant="label" className="!text-[15px]" style={{ color: s.onBtn }}>{label}</Text>
      <Arrow size={17} color={s.onBtn} strokeWidth={2} />
    </Animated.View>
  );
}

function SkipLabel({ n, pos, label }: { n: number; pos: Pos; label: string }) {
  const style = useAnimatedStyle(() => ({ opacity: near(pos.fade.get(), n) }));
  return (
    <Animated.View className="absolute" style={style}>
      <Text className="!text-[14px]" style={{ color: SLIDES[n].sub }}>{label}</Text>
    </Animated.View>
  );
}

export default function IntroScreen() {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const langPicked = useSettings((s) => s.langPicked);
  const still = useReducedMotion();
  const [index, setIndex] = useState(0);
  const dir = I18nManager.isRTL ? -1 : 1;
  const Arrow = I18nManager.isRTL ? ArrowLeft : ArrowRight;

  // Page position, one value per property (they all start one slide "before" the first, so slide 1 enters).
  const pos: Pos = { fade: useSharedValue(-1), pic: useSharedValue(-1), txt: useSharedValue(-1), tfade: useSharedValue(-1), dot: useSharedValue(-1) };
  const target = useSharedValue(0);
  const started = useSharedValue(false);
  const base = useSharedValue(0);

  const goto = (n: number) => {
    'worklet';
    const ms = (full: number) => (still ? 250 : full);
    target.set(n);
    pos.fade.set(withTiming(n, { duration: ms(650), easing: Easing.out(Easing.cubic) }));
    pos.tfade.set(withDelay(still ? 0 : 90, withTiming(n, { duration: ms(650), easing: Easing.out(Easing.cubic) })));
    pos.pic.set(withTiming(n, { duration: ms(900), easing: DRIFT }));
    pos.txt.set(withDelay(still ? 0 : 90, withTiming(n, { duration: ms(900), easing: DRIFT })));
    pos.dot.set(withTiming(n, { duration: still ? 1 : 450, easing: DRIFT }));
  };

  // The first slide enters at 4,750 ms of the splash (250 ms into its fade), or at once when there is no splash.
  useAnimatedReaction(
    () => splashClock.get() >= 4750,
    (go) => {
      if (go && !started.get()) {
        started.set(true);
        goto(0);
      }
    },
  );
  useAnimatedReaction(
    () => Math.min(2, Math.max(0, Math.round(pos.fade.get()))),
    (i, prev) => i !== prev && runOnJS(setIndex)(i),
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-24, 24])
    .onStart(() => {
      for (const v of Object.values(pos)) cancelAnimation(v);
      base.set(target.get());
    })
    .onUpdate((e) => {
      const p = Math.min(2, Math.max(0, base.get() - (dir * e.translationX) / width));
      for (const v of Object.values(pos)) v.set(p);
    })
    .onEnd((e) => {
      const moved = -(dir * (e.translationX + e.velocityX * 0.15)) / width;
      goto(Math.min(2, Math.max(0, Math.min(base.get() + 1, Math.max(base.get() - 1, Math.round(base.get() + moved))))));
    });

  const ground = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pos.fade.get(), [0, 1, 2], SLIDES.map((s) => s.bg)) }));
  const button = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pos.fade.get(), [0, 1, 2], SLIDES.map((s) => s.btn)) }));

  if (!langPicked) return <Redirect href="/language" />;
  const open = () => router.push('/login');
  const next = t('onboarding.next');
  const start = t('onboarding.start');

  return (
    <Animated.View className="flex-1" style={ground}>
      <StatusBar style={index === 0 ? 'dark' : 'light'} />
      <GestureDetector gesture={pan}>
        <View className="flex-1">
          {[0, 1, 2].map((n) => (
            <Slide key={n} n={n} pos={pos} dir={dir} still={still} top={top} height={height} text={{ title: t(`onboarding.welcome.slides.${n}.title`), body: t(`onboarding.welcome.slides.${n}.body`) }} />
          ))}
        </View>
      </GestureDetector>
      {/* Stays still while the slides move; only the label and colours cross-fade. */}
      <PressableScale accessibilityRole="button" onPress={open} className="absolute min-h-11 items-end justify-center" style={{ top: top + 9, end: 22, minWidth: 60 }}>
        {[0, 1, 2].map((n) => <SkipLabel key={n} n={n} pos={pos} label={t('onboarding.skip')} />)}
        <Text className="!text-[14px] opacity-0">{t('onboarding.skip')}</Text>
      </PressableScale>
      <View className="absolute inset-x-6 flex-row items-center justify-between" style={{ bottom: bottom + 34 }}>
        <View className="flex-row gap-[7px]">{[0, 1, 2].map((i) => <Dot key={i} i={i} pos={pos} />)}</View>
        <PressableScale accessibilityRole="button" onPress={() => (target.get() >= 2 ? open() : goto(target.get() + 1))}>
          <Animated.View className="h-14 items-center justify-center rounded-full px-[26px]" style={button}>
            <View className="flex-row items-center gap-2 opacity-0">
              <Text variant="label" className="!text-[15px]">{start.length > next.length ? start : next}</Text>
              <Arrow size={17} color="transparent" />
            </View>
            {[0, 1, 2].map((n) => <Label key={n} n={n} pos={pos} label={n === 2 ? start : next} Arrow={Arrow} />)}
          </Animated.View>
        </PressableScale>
      </View>
    </Animated.View>
  );
}
