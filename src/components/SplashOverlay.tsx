import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { easeOut } from '@/lib/motion';
import { useSettings } from '@/stores/settingsStore';

const SHIFT = 40; // how far the mark settles upward
const TOTAL = 3200;

/** The logo builds itself (decisions Q104), ~3 s: the build takes 2 s, then the finished logo holds before the fade. Frame one is the native splash (ink, full mark 140pt, dead centre).
 *  0.2s the lime slash whips out and sweeps back in; the B dips and settles; the mark rises; wordmark and tagline follow; fade out.
 *  Only opacity and transform move. */
export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const still = useReducedMotion();
  // Language change reloads the app (i18n.ts sets this flag): that restart should not replay the intro.
  const [skip] = useState(() => useSettings.getState().skipSplash);
  const slash = useSharedValue(1);
  const b = useSharedValue(1);
  const mark = useSharedValue(0);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);
  const fade = useSharedValue(1);

  // Hide the native splash only now, with the overlay already drawn beneath it.
  const shown = () => {
    requestAnimationFrame(() => SplashScreen.hideAsync());
    if (skip) {
      useSettings.getState().set({ skipSplash: false });
      onDone();
    }
  };

  useEffect(() => {
    if (skip) return;
    const safety = setTimeout(() => SplashScreen.hideAsync(), 600); // in case the picture never reports
    const to = (v: typeof mark, delay: number, ms: number, end = 1) => {
      v.set(withDelay(delay, withTiming(end, { duration: ms, easing: easeOut })));
    };
    if (!still) {
      slash.set(withDelay(200, withSequence(withTiming(0, { duration: 220, easing: easeOut }), withTiming(1, { duration: 550, easing: easeOut }))));
      b.set(withDelay(800, withSequence(withTiming(0.95, { duration: 180, easing: easeOut }), withTiming(1, { duration: 300, easing: easeOut }))));
      to(mark, 1050, 500);
      to(word, 1350, 500);
      to(tag, 1550, 500);
    }
    fade.set(withDelay(still ? 400 : 2800, withTiming(0, { duration: still ? 300 : 400, easing: easeOut })));
    const id = setTimeout(onDone, still ? 750 : TOTAL + 50);
    return () => {
      clearTimeout(id);
      clearTimeout(safety);
    };
  }, [skip, still, onDone, slash, b, mark, word, tag, fade]);

  const root = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -SHIFT * mark.get() }] }));
  const slashStyle = useAnimatedStyle(() => ({ opacity: slash.get(), transform: [{ translateX: -90 * (1 - slash.get()) }] }));
  const bStyle = useAnimatedStyle(() => ({ transform: [{ scale: b.get() }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.get(), transform: [{ translateY: 14 * (1 - word.get()) }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.get(), transform: [{ translateY: 14 * (1 - tag.get()) }] }));

  if (skip) return <View onLayout={shown} />;
  const layer = { position: 'absolute', width: 140, height: 140 } as const;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#222E29', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }, root]}>
      {/* The splash picture split in two (same 512 square, same place), so together they equal the native splash. */}
      <Animated.View style={[{ width: 140, height: 140 }, markStyle]}>
        <Animated.View style={[layer, bStyle]}>
          <Image source={require('@/assets/images/splash-b.png')} style={{ width: 140, height: 140 }} onDisplay={shown} />
        </Animated.View>
        <Animated.View style={[layer, slashStyle]}>
          <Image source={require('@/assets/images/splash-slash.png')} style={{ width: 140, height: 140 }} />
        </Animated.View>
      </Animated.View>
      {still ? null : (
        // Sits under the mark's settled position: centre + half the mark - the shift + a gap.
        <View style={{ position: 'absolute', top: '50%', marginTop: 70 - SHIFT + 6, alignItems: 'center', gap: 10 }}>
          <Animated.View style={wordStyle}>
            <Image source={require('@/assets/images/logo-word-inverse.png')} contentFit="contain" style={{ width: 120, height: 26 }} />
          </Animated.View>
          <Animated.View style={tagStyle}>
            <Text variant="body" className="text-[#D3F53D]">{t('splash.tagline')}</Text>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}
