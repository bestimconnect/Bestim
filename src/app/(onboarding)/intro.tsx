import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { I18nManager, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, type SharedValue, runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { palette } from '@/lib/palette';
import { splashClock } from '@/lib/splashClock';
import { useSettings } from '@/stores/settingsStore';

// The three welcome slides, content and layout from the approved design (design-v2/motion, Bestim Splash):
// the app ground, one picture and one text block per slide, centred dots, a wide button, "I have an account".
// Slide change = style A "Drift": cross-fade plus a small drift in the reading direction (mirrored in Arabic).
// Separate page positions (0..2): fade 650 ms, picture 900 ms, text 900 ms after 90 ms, dots 450 ms.
// A swipe moves them with the finger, then they settle. Reduce Motion: 250 ms cross-fade, no drift, dots jump.
const DRIFT = Easing.bezier(0.2, 0.7, 0.2, 1);
const WAVE = [14, 26, 40, 22, 54, 34, 18, 46, 60, 30, 16, 42, 28, 12];
const CARD_SHADOW = { boxShadow: '0 1px 0 rgba(0,0,0,0.06)' };
type Colors = (typeof palette)['light'];
type Pos = { fade: SharedValue<number>; pic: SharedValue<number>; txt: SharedValue<number>; tfade: SharedValue<number>; dot: SharedValue<number> };

const clamp1 = (x: number) => {
  'worklet';
  return Math.min(1, Math.max(-1, x));
};
const near = (pos: number, i: number) => {
  'worklet';
  return Math.max(0, 1 - Math.abs(pos - i)); // 1 on its own slide, 0 a slide away
};

function Saved({ label, c }: { label: string; c: Colors }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: c.ok }}>
        <Text className="!text-[13px]" style={{ color: c.paper }}>✓</Text>
      </View>
      <Text variant="label" className="!text-[15px]" style={{ color: c.ok }}>{label}</Text>
    </View>
  );
}

function Picture({ n, c }: { n: number; c: Colors }) {
  const { t } = useTranslation();
  const w = (k: string) => t(`onboarding.welcome.${k}`);
  if (n === 0)
    return (
      <View className="w-full items-center gap-4">
        <View className="rounded-[20px] px-[18px] py-3.5" style={[{ backgroundColor: c.white }, CARD_SHADOW]}>
          <Text className="!text-[16px]" style={{ color: c.ink }}>{w('say')}</Text>
        </View>
        <View className="h-[84px] flex-row items-center gap-[5px]" style={{ direction: 'ltr' }}>
          {WAVE.map((h, j) => <View key={j} className="w-[7px] rounded-full" style={{ height: h * 1.3, backgroundColor: j % 5 === 0 ? c.lime : c.ink }} />)}
        </View>
        <Saved label={w('saved')} c={c} />
      </View>
    );
  if (n === 1) {
    const rows = [{ name: w('oil'), when: w('in480'), on: 2 }, { name: w('brakes'), when: w('in2100'), on: 6 }, { name: w('tires'), when: w('in6m'), on: 9 }];
    return (
      <View className="w-full gap-3.5">
        {rows.map((r) => (
          <View key={r.name} className="rounded-[20px] px-[18px] py-4" style={[{ backgroundColor: c.white }, CARD_SHADOW]}>
            <View className="mb-2.5 flex-row justify-between">
              <Text variant="label" className="!text-[15px]" style={{ color: c.ink }}>{r.name}</Text>
              <Text className="!text-[14px]" style={{ color: c.muted }}>{r.when}</Text>
            </View>
            <View className="flex-row gap-1" style={{ direction: 'ltr' }}>
              {Array.from({ length: 12 }, (_, q) => <View key={q} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: q < r.on ? (r.on < 4 ? c.soon : c.ink) : c.tick }} />)}
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View className="w-full gap-4 rounded-[26px] p-5" style={[{ backgroundColor: c.white }, CARD_SHADOW]}>
      <View className="flex-row items-center justify-between">
        <Text className="!text-[15px]" style={{ color: c.muted }}>{w('passport')}</Text>
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: c.lime }}>
          <Text variant="label" className="!text-[13px]" style={{ color: c.onlime }}>{w('ready')}</Text>
        </View>
      </View>
      <View className="flex-row items-baseline" style={{ direction: 'ltr', alignSelf: 'flex-start' }}>
        <Text variant="number" className="!text-[56px] !leading-[62px]" style={{ color: c.ink }}>92</Text>
        <Text className="!text-[18px]" style={{ color: c.muted }}>/100</Text>
      </View>
      <View className="h-2 rounded-full" style={{ width: '86%', backgroundColor: c.tick }} />
      <View className="h-2 rounded-full" style={{ width: '62%', backgroundColor: c.tick }} />
      <Saved label={w('verified')} c={c} />
    </View>
  );
}

function Slide({ n, pos, dir, still, c, current }: { n: number; pos: Pos; dir: number; still: boolean; c: Colors; current: boolean }) {
  const { t } = useTranslation();
  const pic = useAnimatedStyle(() => ({ opacity: near(pos.fade.get(), n), transform: [{ translateX: still ? 0 : dir * 60 * clamp1(n - pos.pic.get()) }] }));
  const txt = useAnimatedStyle(() => ({ opacity: near(pos.tfade.get(), n), transform: [{ translateX: still ? 0 : dir * 22 * clamp1(n - pos.txt.get()) }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { paddingHorizontal: 24, pointerEvents: 'none' }]} accessibilityElementsHidden={!current} importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}>
      <Animated.View className="flex-1 items-center justify-center" style={pic} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Picture n={n} c={c} />
      </Animated.View>
      <Animated.View className="pb-1 pt-2" style={txt}>
        <Text variant="title" className="!text-[26px] !leading-[36px]" style={{ color: c.ink }}>{t(`onboarding.welcome.slides.${n}.title`)}</Text>
        <Text className="mt-1.5 !text-[16px] !leading-[25px]" style={{ color: c.muted }}>{t(`onboarding.welcome.slides.${n}.body`)}</Text>
      </Animated.View>
    </View>
  );
}

function Dot({ i, pos, c }: { i: number; pos: Pos; c: Colors }) {
  const style = useAnimatedStyle(() => {
    const a = near(pos.dot.get(), i);
    return { width: 7 + 17 * a, backgroundColor: a > 0.5 ? c.ink : c.tick };
  });
  return <Animated.View className="h-[7px] rounded-full" style={style} />;
}

export default function IntroScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const langPicked = useSettings((s) => s.langPicked);
  const theme = useSettings((s) => s.theme);
  const c = palette[theme];
  const still = useReducedMotion();
  const [index, setIndex] = useState(0);
  const dir = I18nManager.isRTL ? -1 : 1;

  // They all start one slide "before" the first, so slide 1 enters.
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
    (i, prev) => {
      if (i !== prev) runOnJS(setIndex)(i);
    },
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

  const nextLabel = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.max(0, pos.fade.get() - 1)) }));
  const startLabel = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, pos.fade.get() - 1)) }));
  const chrome = useAnimatedStyle(() => ({ opacity: Math.min(1, pos.fade.get() + 1) }));

  if (!langPicked) return <Redirect href="/language" />;
  const open = () => router.push('/login');
  const safe = Math.max(bottom, 18);

  return (
    <View className="flex-1" style={{ backgroundColor: c.paper }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <GestureDetector gesture={pan}>
        <View className="flex-1" style={{ paddingTop: top + 52, paddingBottom: safe + 146 }}>
          <View className="flex-1">
            {[0, 1, 2].map((n) => <Slide key={n} n={n} pos={pos} dir={dir} still={still} c={c} current={n === index} />)}
          </View>
        </View>
      </GestureDetector>
      {/* Stays still while the slides move; only the button label cross-fades. */}
      <Animated.View className="absolute" style={[{ top: top + 6, end: 14 }, chrome]}>
        <PressableScale accessibilityRole="button" onPress={open} className="min-h-11 justify-center px-2.5">
          <Text className="!text-[15px]" style={{ color: c.muted }}>{t('onboarding.skip')}</Text>
        </PressableScale>
      </Animated.View>
      <Animated.View className="absolute inset-x-6 items-center" style={[{ bottom: safe }, chrome]}>
        <View className="mb-6 flex-row justify-center gap-[7px]" style={{ direction: 'ltr' }}>
          {[0, 1, 2].map((i) => <Dot key={i} i={i} pos={pos} c={c} />)}
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t(index === 2 ? 'onboarding.start' : 'onboarding.next')}
          onPress={() => (target.get() >= 2 ? open() : goto(target.get() + 1))}
          className="h-14 w-full items-center justify-center rounded-full"
          style={{ backgroundColor: c.btn }}>
          <Animated.View className="absolute" style={nextLabel}>
            <Text variant="label" className="!text-[16px]" style={{ color: c.onbtn }}>{t('onboarding.next')}</Text>
          </Animated.View>
          <Animated.View className="absolute" style={startLabel}>
            <Text variant="label" className="!text-[16px]" style={{ color: c.onbtn }}>{t('onboarding.start')}</Text>
          </Animated.View>
        </PressableScale>
        <PressableScale accessibilityRole="button" onPress={open} className="mt-1 min-h-11 justify-center px-3">
          <Text className="!text-[15px]" style={{ color: c.muted }}>{t('onboarding.welcome.have')}</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}
