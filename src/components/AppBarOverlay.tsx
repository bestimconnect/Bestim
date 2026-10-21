import { router, usePathname } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { I18nManager, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { BAR_GAP, type BarEntry, useAppBar } from '@/lib/appBar';
import { easeOut } from '@/lib/motion';
import { useColors } from '@/lib/theme';

const GLIDE = 300;
// Sheets and pop-ups sit over a page without a bar of their own: the page's bar stays put underneath.
const OVER = ['/capture', '/sheet', '/switch-vehicle', '/pick', '/notify-permission'];

/**
 * The one green top bar (root layout, above every screen). A screen with a Header gets the compact bar; a screen with its
 * own green block (Home, car details) shows that block instead, and the bar only appears to stretch to / shrink from it
 * when you move between the two, so the green area grows and shrinks smoothly.
 */
export function AppBarOverlay() {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const top = useAppBar((s) => s.stack[s.stack.length - 1]);
  const path = usePathname();
  const overSheet = OVER.some((p) => path === p || path.startsWith(p + '/'));
  const h = useSharedValue(0);
  const shell = useSharedValue(0); // the green shell
  const words = useSharedValue(0); // title / back / right
  const prev = useRef<{ kind: BarEntry['kind']; bottom: number } | null>(null);
  const [shown, setShown] = useState<BarEntry | null>(null); // the last compact bar, kept while the bar fades out
  if (top?.kind === 'bar' && top !== shown) setShown(top);

  const target = top ? top.bottom || (top.kind === 'bar' ? insets.top + 56 : 360) : 0;
  useEffect(() => {
    const before = prev.current;
    prev.current = top ? { kind: top.kind, bottom: target } : null;
    const glide = { duration: GLIDE, easing: easeOut };
    if (!top && overSheet) return; // a sheet opened over the page: keep its bar
    if (!top) {
      shell.set(withTiming(0, { duration: 150 }));
      words.set(withTiming(0, { duration: 150 }));
    } else if (top.kind === 'bar') {
      if (before?.kind === 'hero') h.set(before.bottom); // start where the tall block was
      else if (shell.get() === 0) h.set(target);
      shell.set(1);
      h.set(withTiming(target, glide));
      words.set(withTiming(1, { duration: 200 }));
    } else if (shell.get() === 1) {
      // bar → tall block: stretch, then step aside so the real block (underneath) shows
      words.set(withTiming(0, { duration: 120 }));
      h.set(withTiming(target, glide, (done) => {
        if (done) shell.set(withTiming(0, { duration: 160 }));
      }));
    } else {
      shell.set(0);
    }
  }, [top?.id, top?.kind, target]); // eslint-disable-line react-hooks/exhaustive-deps

  const shellStyle = useAnimatedStyle(() => ({ height: h.get(), opacity: shell.get() }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.get() }));
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  return (
    <Animated.View
      pointerEvents={top?.kind === 'bar' ? 'auto' : 'none'}
      className="absolute inset-x-0 top-0 overflow-hidden rounded-b-[28px] bg-panel"
      style={shellStyle}>
      <Animated.View className="absolute inset-x-0 bottom-0 px-6 pb-4" style={[wordsStyle, { gap: BAR_GAP }]}>
        {shown?.back || shown?.right ? (
          <View className="h-11 flex-row items-center justify-between">
            {shown?.back ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('back')}
                onPress={router.back}
                className="h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF26]">
                <Back size={22} color={c.onpanel} />
              </PressableScale>
            ) : <View />}
            {shown?.right}
          </View>
        ) : null}
        {/* keyed: a new page's title fades in instead of snapping */}
        <Animated.View key={shown?.id} entering={FadeIn.duration(180)} style={{ minHeight: 32 + (shown?.sub ? 20 : 0) }} className="justify-center">
          <Text variant="title" className="text-onpanel" numberOfLines={1}>{shown?.title}</Text>
          {shown?.sub ? <Text variant="caption" className="text-onpanel" style={{ opacity: 0.7 }} numberOfLines={1}>{shown.sub}</Text> : null}
        </Animated.View>
        {shown?.below ? <View style={{ minHeight: shown.belowH ?? 44 }}>{shown.below}</View> : null}
      </Animated.View>
    </Animated.View>
  );
}
