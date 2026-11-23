import type { BottomTabBarProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { Banknote, Car, Clock, House, Mic, PencilLine, Plus, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { I18nManager, Keyboard, Modal, Platform, Pressable, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { openCapture, openManual } from '@/lib/reading';
import { useTourTarget } from '@/lib/tour';
import { shadows, useColors } from '@/lib/theme';
import { PressableScale } from './ui/PressableScale';
import { Text } from './ui/Text';

const icons: Record<string, LucideIcon> = { index: House, timeline: Clock, expenses: Banknote, garage: Car };
const labels: Record<string, string> = { index: 'home', timeline: 'timeline', expenses: 'money', garage: 'garage' };
const ON_LIME = '#171B19';
const CALM = Easing.out(Easing.cubic); // founder: nav motion stays small and quiet, no bounce

/** Space to leave under scrolling content so the floating nav never covers it. */
export function useTabBarSpace() {
  return Math.max(useSafeAreaInsets().bottom, 16) + 64 + 24;
}

/**
 * v2 nav (Q133): a floating pill with the tabs (active = lime pill with its label, others icon only) and the round lime
 * voice button beside it, on every tab. In RTL the row flips, so the pill sits at the start and the voice button at the end.
 * The voice button isn't a tab: it opens the capture flow (say it / type it) like the old centre "+".
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const expensesTarget = useTourTarget('expenses');
  const captureTarget = useTourTarget('capture');
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subs = [Keyboard.addListener('keyboardDidShow', () => setTyping(true)), Keyboard.addListener('keyboardDidHide', () => setTyping(false))];
    return () => subs.forEach((x) => x.remove());
  }, []);
  // A stack inside a tab (none today) shows its sub-pages without the bar.
  if (typing || (state.routes[state.index].state?.index ?? 0) > 0) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      className="absolute flex-row items-center gap-2.5"
      style={{ bottom: Math.max(bottom, 16), start: 18, end: 18 }}>
      <View className="h-16 flex-1 flex-row items-center gap-1 rounded-full bg-nav p-1.5" style={{ boxShadow: shadows.navPill }}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const Icon = icons[route.name];
          if (!Icon) return null;
          const label = t(`tabs.${labels[route.name]}`);
          const onPress = () => {
            if (!focused) Haptics.selectionAsync();
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Animated.View
              key={route.key}
              ref={route.name === 'expenses' ? expensesTarget : undefined}
              collapsable={false}
              layout={LinearTransition.duration(220).easing(CALM)}
              style={{ flex: focused ? 2.3 : 1 }}>
              <PressableScale
                scale={0.98}
                onPress={onPress}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: focused }}
                className="h-[50px] w-full flex-row items-center justify-center gap-1.5 overflow-hidden rounded-full">
                {focused ? <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(100)} className="absolute inset-0 rounded-full bg-lime" /> : null}
                <Icon size={21} color={focused ? ON_LIME : c.ink} strokeWidth={focused ? 2.2 : 1.6} fill={focused && route.name === 'index' ? ON_LIME : 'none'} />
                {focused ? (
                  <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(80)} className="shrink">
                    <Text variant="label" className="!text-[13px] text-[#171B19]" numberOfLines={1}>{label}</Text>
                  </Animated.View>
                ) : null}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
      <View ref={captureTarget} collapsable={false}>
      <PressableScale
        scale={0.97}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('tabs.capture')}
        className="h-16 w-16 items-center justify-center rounded-full bg-lime"
        style={{ boxShadow: shadows.fab }}>
        <Plus size={28} color={ON_LIME} strokeWidth={2} />
      </PressableScale>
      </View>
      <Fan open={open} onClose={() => setOpen(false)} bottom={Math.max(bottom, 16)} />
    </Animated.View>
  );
}

const R = 96; // fan radius
const ARC = [30, 78]; // degrees above the horizontal, bending toward the screen centre

/** One fan action: fades in at its slot on the arc with a small drift outward. */
function FanItem({ Icon, label, onPress, lime, deg, i, rtl, go }: { Icon: LucideIcon; label: string; onPress: () => void; lime: boolean; deg: number; i: number; rtl: boolean; go: SharedValue<number> }) {
  const dx = Math.cos((deg * Math.PI) / 180) * R * (rtl ? 1 : -1); // the + sits at the screen's start in RTL (left), end in LTR (right)
  const dy = -Math.sin((deg * Math.PI) / 180) * R;
  const style = useAnimatedStyle(() => {
    const p = go.value;
    const reach = 0.9 + 0.1 * p;
    return { opacity: p, transform: [{ translateX: dx * reach }, { translateY: dy * reach }, { scale: 0.97 + 0.03 * p }] };
  });
  return (
    <Animated.View className="absolute items-center" style={[{ width: 76, bottom: 2, start: -6 }, style]}>
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className={`h-[60px] w-[60px] items-center justify-center rounded-full ${lime ? 'bg-lime' : 'bg-white'}`} style={{ boxShadow: shadows.fab }}>
        <Icon size={25} color={ON_LIME} strokeWidth={1.9} />
      </PressableScale>
      <View className="mt-1.5 rounded-full bg-white px-2.5 py-1" pointerEvents="none">
        <Text variant="caption" numberOfLines={1} className="text-[#171B19]">{label}</Text>
      </View>
    </Animated.View>
  );
}

/** The + fan: a dimmed layer; the two ways to log fade in on a quarter circle around the button. In a Modal so taps anywhere outside close it. */
function Fan({ open, onClose, bottom }: { open: boolean; onClose: () => void; bottom: number }) {
  const { t } = useTranslation();
  const rtl = I18nManager.isRTL;
  const go = useSharedValue(0);
  useEffect(() => {
    go.value = withTiming(open ? 1 : 0, { duration: open ? 200 : 120, easing: CALM });
  }, [open, go]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${go.value * 45}deg` }] }));
  const pick = (f: () => void) => () => {
    onClose();
    setTimeout(f, 60); // let the layer go before the next screen opens
  };
  const items = [
    { Icon: PencilLine, label: t('tabs.manual'), onPress: pick(() => openManual()), lime: false, deg: ARC[0] },
    { Icon: Mic, label: t('tabs.voice'), onPress: pick(() => openCapture()), lime: true, deg: ARC[1] },
  ];
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.38)' }} onPress={onClose} accessibilityLabel={t('capture.quick.close')} />
      <View className="absolute flex-row" style={{ bottom, start: 18, end: 18 }} pointerEvents="box-none">
        <View className="flex-1" pointerEvents="none" />
        <View className="h-16 w-16" pointerEvents="box-none">
          {items.map((it, i) => <FanItem key={it.label} {...it} i={i} rtl={rtl} go={go} />)}
          <PressableScale scale={0.97} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} className="h-16 w-16 items-center justify-center rounded-full bg-lime" style={{ boxShadow: shadows.fab }}>
            <Animated.View style={turn}><Plus size={28} color={ON_LIME} strokeWidth={2} /></Animated.View>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}
