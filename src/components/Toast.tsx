import { Check, TriangleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { easeOut } from '@/lib/motion';
import { shadows } from '@/lib/theme';
import { Text } from './ui/Text';

// One short confirmation just above the nav / footer button (v2 Figma Toast) ("Vehicle deleted"). It survives navigation because it's
// mounted once in the root layout. Call `toast(text)` from anywhere.
// An optional action ("Undo") shows as a tappable word and keeps the toast up longer.
type Action = { label: string; onPress: () => void };
const useToast = create<{ text: string | null; action?: Action; failed?: boolean }>(() => ({ text: null }));
export const toast = (text: string, action?: Action) => useToast.setState({ text, action, failed: false });
/** A failure: same toast with a warning icon instead of the check. */
export const toastError = (text: string) => useToast.setState({ text, action: undefined, failed: true });

// Rises from below and sinks back, a little faster.
const ENTER = FadeInDown.duration(220).easing(easeOut);
const EXIT = FadeOutDown.duration(180).easing(easeOut);
// Fixed brand colours (Figma Toast): the same dark pill in both themes.
const INK = '#222E29', ON = '#F5F7F5', LIME = '#D3F53D', ON_LIME = '#171B19', BAD = '#FF6B86';

export function Toast() {
  const { text, action, failed } = useToast();
  const { bottom } = useSafeAreaInsets();
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => useToast.setState({ text: null }), action ? 5000 : 2500);
    return () => clearTimeout(id);
  }, [text, action]);
  return (
    <View pointerEvents="box-none" className="absolute inset-x-5 items-center" style={{ bottom: Math.max(bottom, 16) + 76 }} accessibilityLiveRegion="polite">
      {text ? (
        <Animated.View key={text} entering={ENTER} exiting={EXIT} className="w-full flex-row items-center gap-[11px] rounded-[20px] px-3.5 py-3" style={{ backgroundColor: INK, boxShadow: shadows.float }}>
          <View className="h-[30px] w-[30px] items-center justify-center rounded-full" style={{ backgroundColor: failed ? BAD : LIME }}>
            {failed ? <TriangleAlert size={16} color={ON_LIME} /> : <Check size={16} color={ON_LIME} strokeWidth={2.2} />}
          </View>
          <Text variant="body" className="flex-1 !text-[14px] !leading-[20px]" style={{ color: ON }} numberOfLines={3}>{text}</Text>
          {action ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => {
                useToast.setState({ text: null });
                action.onPress();
              }}>
              <Text variant="body" className="!text-[14px] font-medium" style={{ color: LIME }}>{action.label}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
