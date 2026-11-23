import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { Wordmark, WordmarkStill, splashFade } from '@/components/Wordmark';
import { splashClock } from '@/lib/splashClock';
import { palette } from '@/lib/palette';
import { useSettings } from '@/stores/settingsStore';

// Animated splash (founder-approved motion, design-v2/motion): one logo on the app ground, 4,500 ms build + 500 ms fade.
// Frame one is the native splash (flat ground colour, no picture), so nothing jumps when this mounts.
// Tap after 1.5 s fast-forwards to the end. Reduce Motion: finished logo fades in 250, holds 1,200, fades out 250.
// A language-change restart (skipSplash) shows nothing.
const TOTAL = 5000;
const WIDTH = 196;
const LIFT = 30; // optical centre sits this far above the middle
const SKIP_AFTER = 1500;
 // when the overlay ends (a tap shortens it)

export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const still = useReducedMotion();
  const theme = useSettings((s) => s.theme); // not useScheme(): that is forced light inside the onboarding screens
  const colors = palette[theme];
  const [skip] = useState(() => useSettings.getState().skipSplash);
  const fade = useSharedValue(1);
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    if (!skipped) return;
    const id = setTimeout(onDone, 900); // a tap ran the build fast: end with its fade
    return () => clearTimeout(id);
  }, [skipped, onDone]);

  // Hide the native splash only now, with the overlay already drawn beneath it.
  const shown = () => {
    requestAnimationFrame(() => SplashScreen.hideAsync());
    if (skip) {
      useSettings.getState().set({ skipSplash: false });
      splashClock.set(TOTAL);
      onDone();
    }
  };

  useEffect(() => {
    if (skip) return;
    const safety = setTimeout(() => SplashScreen.hideAsync(), 600);
    if (still) {
      fade.set(0);
      fade.set(withSequence(withTiming(1, { duration: 250 }), withDelay(1200, withTiming(0, { duration: 250 }))));
      splashClock.set(withDelay(1700, withTiming(TOTAL, { duration: 1 }))); // the intro may start as the fade begins
    } else {
      splashClock.set(0);
      splashClock.set(withTiming(TOTAL, { duration: TOTAL, easing: Easing.linear }));
    }
    const id = setTimeout(onDone, still ? 1750 : TOTAL + 50);
    return () => {
      clearTimeout(id);
      clearTimeout(safety);
      cancelAnimation(splashClock);
    };
  }, [skip, still, onDone, fade]);

  // After 1.5 s a tap runs the rest of the build quickly, then the normal fade.
  const finishSoon = () => {
    setSkipped(true);
  };
  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    if (still || splashClock.get() < SKIP_AFTER || splashClock.get() >= 4500) return;
    splashClock.set(withSequence(withTiming(4500, { duration: 350, easing: Easing.out(Easing.quad) }), withTiming(TOTAL, { duration: 500, easing: Easing.linear })));
    runOnJS(finishSoon)();
  });

  const root = useAnimatedStyle(() => ({ opacity: still ? fade.get() : splashFade(splashClock.get()) }));

  if (skip) return <View onLayout={shown} />;
  return (
    <GestureDetector gesture={tap}>
      <Animated.View onLayout={shown} style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', paddingBottom: LIFT * 2 }, root]}>
        <View style={{ direction: 'ltr' }} accessibilityLabel="Bestim" accessible>
          {still ? <WordmarkStill ink={colors.ink} width={WIDTH} /> : <Wordmark t={splashClock} ink={colors.ink} width={WIDTH} />}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
