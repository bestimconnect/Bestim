import { Check, TriangleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { easeOut } from '@/lib/motion';
import { shadows } from '@/lib/theme';
import { IconTile } from './ui/IconTile';
import { Sheen } from './ui/Sheen';
import { Text } from './ui/Text';

// One short confirmation at the top of the screen ("Vehicle deleted"). It survives navigation because it's
// mounted once in the root layout. Call `toast(text)` from anywhere.
// An optional action ("Undo") shows as a tappable word and keeps the toast up longer.
type Action = { label: string; onPress: () => void };
const useToast = create<{ text: string | null; action?: Action; failed?: boolean }>(() => ({ text: null }));
export const toast = (text: string, action?: Action) => useToast.setState({ text, action, failed: false });
/** A failure: same toast with a warning icon instead of the check. */
export const toastError = (text: string) => useToast.setState({ text, action: undefined, failed: true });

// Comes from the top edge and leaves the same way, a little faster.
const ENTER = FadeInUp.duration(220).easing(easeOut);
const EXIT = FadeOutUp.duration(180).easing(easeOut);

export function Toast() {
  const { text, action, failed } = useToast();
  const { top } = useSafeAreaInsets();
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => useToast.setState({ text: null }), action ? 5000 : 2500);
    return () => clearTimeout(id);
  }, [text, action]);
  return (
    <View pointerEvents="box-none" className="absolute inset-x-6 items-center" style={{ top: top + 8 }} accessibilityLiveRegion="polite">
      {text ? (
        <Animated.View key={text} entering={ENTER} exiting={EXIT} className="flex-row items-center gap-3 overflow-hidden rounded-item border border-[#FFFFFF1A] bg-panel py-2.5 pe-4 ps-2.5" style={{ boxShadow: shadows.elevated }}>
          <Sheen opacity={0.08} />
          <IconTile icon={failed ? TriangleAlert : Check} tone={failed ? 'blush' : 'lime'} size={32} />
          <Text variant="caption" className="shrink text-onpanel" numberOfLines={3}>{text}</Text>
          {action ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => {
                useToast.setState({ text: null });
                action.onPress();
              }}>
              <Text variant="label" className="text-lime">{action.label}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
