import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ReactNode, useCallback } from 'react';
import { I18nManager, View } from 'react-native';

/** Absolute offset from the PHYSICAL left edge. RN mirrors `left` in RTL, but the design keeps hero art in place. */
export const fromLeft = (x: number) => (I18nManager.isRTL ? { right: x } : { left: x });

/** Light status bar while a screen on an ink background is focused (these live in always-light flows). */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );
}

/** White wordmark at the design's top-left spot (Figma box 24,60 — the visible mark sits at 52,70). */
export function Wordmark() {
  return (
    <Image
      source={require('@/assets/images/logo-word-inverse.png')}
      contentFit="contain"
      style={{ position: 'absolute', top: 70, width: 66, height: 14, ...fromLeft(52) }}
      accessibilityLabel="Bestim"
    />
  );
}

/** Figma "Hero": ink panel under the status bar, 28 bottom radius, wordmark top-left, illustration inside. */
export function Hero({ children, height = 320 }: { children?: ReactNode; height?: number }) {
  useLightStatusBar();
  return (
    <View className="overflow-hidden rounded-b-[28px] bg-ink" style={{ height }}>
      <Wordmark />
      {children}
    </View>
  );
}
