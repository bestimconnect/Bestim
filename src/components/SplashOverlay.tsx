import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { easeOut } from '@/lib/motion';
import { useSettings } from '@/stores/settingsStore';

// Geometry, measured from the PNGs (alpha > 16): the mark's ink inside the 512 splash square, and the slash+B glyph
// inside the 900x198 wordmark ("estim" starts after the gap at x=283). The wordmark's B is a slightly wider cut than
// the mark's, so the mark is scaled per axis onto it; the 100 ms hand-over hides the remaining shape difference.
const MARK = 140;
const K = MARK / 512;
const MB = { l: 1, r: 511, t: 58, b: 453 };
const W = 230; // finished wordmark width on screen
const k = W / 900;
const H = 198 * k;
const GB = { l: 1, r: 279, t: 1, b: 191 };
const COVER_X = 281 * k; // where "estim" begins
const COVER_W = W - COVER_X + 2;
const GAP = 10;
const TAG_H = 24;
const WORD_TOP = -(H + GAP + TAG_H) / 2; // relative to screen centre: the word + tagline group is centred
export const MARK_FROM = { x: ((MB.l + MB.r) / 2 - 256) * K, y: ((MB.t + MB.b) / 2 - 256) * K };
export const MARK_TO = { x: ((GB.l + GB.r) / 2) * k - W / 2, y: WORD_TOP + ((GB.t + GB.b) / 2) * k };
const DX = MARK_TO.x - MARK_FROM.x;
const DY = MARK_TO.y - MARK_FROM.y;
const SX = ((GB.r - GB.l) * k) / ((MB.r - MB.l) * K);
const SY = ((GB.b - GB.t) * k) / ((MB.b - MB.t) * K);
const TOTAL = 3550;

/** The logo builds itself, ~3.5 s. Frame one is the native splash (ink, full mark 140pt, dead centre).
 *  0.2s the lime slash whips out and sweeps back in; 0.8s the B dips and settles;
 *  1.05s (500 ms) the mark shrinks and glides onto the place of the wordmark's first letter;
 *  1.5s (600 ms) the rest of the word grows out of the B to the right (an ink cover slides away; no width animation);
 *  1.55s (100 ms) the mark hands over to the wordmark's own B; 1.95s (450 ms) the tagline rises in under the word;
 *  hold ~700 ms; 3.1s fade out (400 ms). The word group is forced left-to-right (Latin wordmark, no RTL mirror).
 *  Reduce Motion: the mark crossfades to the finished wordmark and tagline (200 ms), hold, fade.
 *  Only opacity and transform move. */
export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const still = useReducedMotion();
  // Language change reloads the app (i18n.ts sets this flag): that restart should not replay the intro.
  const [skip] = useState(() => useSettings.getState().skipSplash);
  const slash = useSharedValue(1);
  const b = useSharedValue(1);
  const glide = useSharedValue(0);
  const swap = useSharedValue(0); // 0 = separate mark layers, 1 = the wordmark's own B
  const reveal = useSharedValue(0);
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
    const to = (v: typeof glide, delay: number, ms: number, end = 1) => {
      v.set(withDelay(delay, withTiming(end, { duration: ms, easing: easeOut })));
    };
    if (still) {
      to(swap, 0, 200);
      to(tag, 0, 200);
    } else {
      slash.set(withDelay(200, withSequence(withTiming(0, { duration: 220, easing: easeOut }), withTiming(1, { duration: 550, easing: easeOut }))));
      b.set(withDelay(800, withSequence(withTiming(0.95, { duration: 180, easing: easeOut }), withTiming(1, { duration: 300, easing: easeOut }))));
      to(glide, 1050, 500);
      to(reveal, 1500, 600);
      to(swap, 1550, 100);
      to(tag, 1950, 450);
    }
    fade.set(withDelay(still ? 600 : 3100, withTiming(0, { duration: still ? 300 : 400, easing: easeOut })));
    const id = setTimeout(onDone, still ? 950 : TOTAL + 50);
    return () => {
      clearTimeout(id);
      clearTimeout(safety);
    };
  }, [skip, still, onDone, slash, b, glide, swap, reveal, tag, fade]);

  const root = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const markStyle = useAnimatedStyle(() => {
    const g = glide.get();
    return {
      opacity: 1 - swap.get(),
      transform: [{ translateX: DX * g }, { translateY: DY * g }, { scaleX: 1 + (SX - 1) * g }, { scaleY: 1 + (SY - 1) * g }],
    };
  });
  const slashStyle = useAnimatedStyle(() => ({ opacity: slash.get(), transform: [{ translateX: -90 * (1 - slash.get()) }] }));
  const bStyle = useAnimatedStyle(() => ({ transform: [{ scale: b.get() }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: swap.get() }));
  const coverStyle = useAnimatedStyle(() => ({ transform: [{ translateX: COVER_X + COVER_W * reveal.get() }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.get(), transform: [{ translateY: 14 * (1 - tag.get()) }] }));

  if (skip) return <View onLayout={shown} />;
  const layer = { position: 'absolute', width: MARK, height: MARK } as const;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#222E29', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }, root]}>
      {/* The word group: always left-to-right, centred as a whole (word + tagline). */}
      <View style={{ position: 'absolute', direction: 'ltr', width: W, alignItems: 'center', gap: GAP }}>
        <Animated.View style={[{ width: W, height: H }, wordStyle]}>
          <Image source={require('@/assets/images/logo-word-inverse.png')} contentFit="fill" style={{ width: W, height: H }} />
          {/* Ink cover over "estim"; slides right to uncover the word out of the B. */}
          {still ? null : <Animated.View style={[{ position: 'absolute', left: 0, top: -1, width: COVER_W, height: H + 2, backgroundColor: '#222E29' }, coverStyle]} />}
        </Animated.View>
        <Animated.View style={[{ height: TAG_H, justifyContent: 'center' }, tagStyle]}>
          <Text variant="body" className="text-[#D3F53D]">{t('splash.tagline')}</Text>
        </Animated.View>
      </View>
      {/* The splash picture split in two (same 512 square, same place), so together they equal the native splash. */}
      <Animated.View style={[{ width: MARK, height: MARK }, markStyle]}>
        <Animated.View style={[layer, bStyle]}>
          <Image source={require('@/assets/images/splash-b.png')} style={{ width: MARK, height: MARK }} onDisplay={shown} />
        </Animated.View>
        <Animated.View style={[layer, slashStyle]}>
          <Image source={require('@/assets/images/splash-slash.png')} style={{ width: MARK, height: MARK }} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
