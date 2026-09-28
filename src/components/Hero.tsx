import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ReactNode, useCallback } from 'react';
import { I18nManager, View } from 'react-native';

/** Absolute offset from the PHYSICAL left edge. RN mirrors `left` in RTL, but the design keeps hero art in place. */
export const fromLeft = (x: number) => (I18nManager.isRTL ? { right: x } : { left: x });

/** Figma "Hero": ink panel under the status bar, 28 bottom radius, wordmark top-left, illustration inside. */
export function Hero({ children, height = 320 }: { children?: ReactNode; height?: number }) {
  // Light status bar while a hero screen is focused (hero screens live in always-light flows).
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );
  return (
    <View className="overflow-hidden rounded-b-[28px] bg-ink" style={{ height }}>
      <Image
        source={require('@/assets/images/logo-word-inverse.png')}
        contentFit="contain"
        style={{ position: 'absolute', top: 70, width: 66, height: 14, ...fromLeft(52) }}
        accessibilityLabel="Bestim"
      />
      {children}
    </View>
  );
}
