import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Figma "Hero": ink panel under the status bar, 28 bottom radius, wordmark top-left, illustration inside. */
export function Hero({ children, height = 320 }: { children?: ReactNode; height?: number }) {
  return (
    <View className="overflow-hidden rounded-b-[28px] bg-ink" style={{ height }}>
      <Image
        source={require('@/assets/images/logo-word-inverse.png')}
        contentFit="contain"
        style={{ position: 'absolute', left: 24, top: 60, width: 120, height: 34 }}
        accessibilityLabel="Bestim"
      />
      {children}
    </View>
  );
}
