import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { easeOut } from '@/lib/motion';
import { useSettings } from '@/stores/settingsStore';

const SHIFT = 40; // how far the mark settles upward
const TOTAL = 1400;

/** Animated tail of the native splash (decisions Q87). Frame one is the native splash (ink, mark 140pt, dead centre);
 *  then the mark rises, the wordmark and tagline follow, and the whole thing fades out. Only opacity and translateY move. */
export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const still = useReducedMotion();
  // Language change reloads the app (i18n.ts sets this flag): that restart should not replay the intro.
  const [skip] = useState(() => useSettings.getState().skipSplash);
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
    const go = (v: typeof mark, delay: number, ms: number) => {
      v.set(withDelay(delay, withTiming(1, { duration: ms, easing: easeOut })));
    };
    if (!still) {
      go(mark, 150, 500);
      go(word, 350, 450);
      go(tag, 500, 450);
    }
    fade.set(withDelay(still ? 400 : 1000, withTiming(0, { duration: still ? 300 : 400, easing: easeOut })));
    const id = setTimeout(onDone, still ? 750 : TOTAL + 50);
    return () => {
      clearTimeout(id);
      clearTimeout(safety);
    };
  }, [skip, still, onDone, mark, word, tag, fade]);

  const root = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -SHIFT * mark.get() }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.get(), transform: [{ translateY: 14 * (1 - word.get()) }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.get(), transform: [{ translateY: 14 * (1 - tag.get()) }] }));

  if (skip) return <View onLayout={shown} />;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#222E29', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }, root]}>
      <Animated.View style={markStyle}>
        <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 140, height: 140 }} onDisplay={shown} />
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
