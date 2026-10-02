import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { easeOut } from '@/lib/motion';
import { shadows } from '@/lib/theme';
import { Text } from './ui/Text';

// One short confirmation at the top of the screen ("Vehicle deleted"). It survives navigation because it's
// mounted once in the root layout. Call `toast(text)` from anywhere.
const useToast = create<{ text: string | null }>(() => ({ text: null }));
export const toast = (text: string) => useToast.setState({ text });

// Comes from the top edge and leaves the same way, a little faster.
const ENTER = FadeInUp.duration(220).easing(easeOut);
const EXIT = FadeOutUp.duration(180).easing(easeOut);

export function Toast() {
  const text = useToast((s) => s.text);
  const { top } = useSafeAreaInsets();
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => useToast.setState({ text: null }), 2500);
    return () => clearTimeout(id);
  }, [text]);
  return (
    <View pointerEvents="none" className="absolute inset-x-6 items-center" style={{ top: top + 8 }} accessibilityLiveRegion="polite">
      {text ? (
        <Animated.View key={text} entering={ENTER} exiting={EXIT} className="rounded-field bg-panel px-4 py-3" style={{ boxShadow: shadows.elevated }}>
          <Text variant="caption" className="text-onpanel">{text}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
