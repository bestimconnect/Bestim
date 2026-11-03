import type { BottomTabBarProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { CarFront, House, Plus, UserRound, Wallet, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { openCapture } from '@/lib/reading';
import { useTourTarget } from '@/lib/tour';
import { shadows, useColors } from '@/lib/theme';
import { PressableScale } from './ui/PressableScale';
import { Sheen } from './ui/Sheen';
import { Text } from './ui/Text';

const icons: Record<string, LucideIcon> = { index: House, vehicles: CarFront, expenses: Wallet, account: UserRound };
const labels: Record<string, string> = { index: 'home', vehicles: 'vehicles', expenses: 'expenses', account: 'account' };

/** Space to leave under scrolling content so the floating bar and its lifted + button never cover it. */
export function useTabBarSpace() {
  return Math.max(useSafeAreaInsets().bottom, 16) + 68 + 36;
}

/**
 * Custom ink nav (spec §10): 68px, 28 radius, floating lime capture button in the centre.
 * The capture button isn't a tab: it opens the say-it / type-it chooser (13).
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const expensesTarget = useTourTarget('expenses');
  const captureTarget = useTourTarget('capture');
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subs = [Keyboard.addListener('keyboardDidShow', () => setTyping(true)), Keyboard.addListener('keyboardDidHide', () => setTyping(false))];
    return () => subs.forEach((x) => x.remove());
  }, []);
  // Sub-pages (car details, export…) sit on a stack inside a tab: the bar belongs to the main pages only.
  if (typing || (state.routes[state.index].state?.index ?? 0) > 0) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      className="absolute inset-x-4 h-[68px] flex-row items-center rounded-nav border border-line bg-panel px-2"
      style={{ bottom: Math.max(bottom, 16), boxShadow: shadows.nav }}>
      {/* its own clip: the lifted + button must not be cut off by the bar's corners */}
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden rounded-nav">
        <Sheen opacity={0.06} />
      </View>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const Icon = icons[route.name];
        const onPress = () => {
          if (!focused) Haptics.selectionAsync();
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        const label = t(`tabs.${labels[route.name]}`);
        const tab = (
          <PressableScale
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            className="flex-1 items-center">
            {focused ? <View className="absolute -top-[12px] h-[3px] w-6 rounded-b-full bg-lime" /> : null}
            <View ref={route.name === 'expenses' ? expensesTarget : undefined} collapsable={false} className="items-center gap-1">
              <View className="h-6 w-6 items-center justify-center">
                <Icon size={22} color={focused ? c.lime : c.muted} />
              </View>
              <Text variant="caption" className={focused ? 'text-lime' : 'text-muted'}>{label}</Text>
            </View>
          </PressableScale>
        );
        if (i !== 1) return tab;
        return [
          tab,
          // Floats: larger than the bar's icons and lifted above its top edge, ringed in the bar's colour (decisions Q57).
          <PressableScale key="capture" scale={0.92} onPress={() => openCapture()} accessibilityRole="button" accessibilityLabel={t('tabs.capture')} className="flex-1 items-center" style={{ marginTop: -30 }}>
            <View ref={captureTarget} collapsable={false} className="h-[60px] w-[60px] items-center justify-center rounded-full border-4 border-panel bg-lime" style={{ boxShadow: shadows.glow }}>
              <Plus size={26} color="#222E29" strokeWidth={2.5} />
            </View>
          </PressableScale>,
        ];
      })}
    </Animated.View>
  );
}
