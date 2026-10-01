import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Bell, CarFront, House, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useIsGuest } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';
import { Text } from './ui/Text';

const icons: Record<string, LucideIcon> = { index: House, vehicles: CarFront, reminders: Bell, account: UserRound };
const labels: Record<string, string> = { index: 'home', vehicles: 'vehicles', reminders: 'reminders', account: 'account' };

/**
 * Custom ink nav (spec §10): 68px, 28 radius, raised lime capture button in the centre.
 * The capture button isn't a tab: it opens the "new record" sheet (13). Guests get the feature gate (Q17).
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const guest = useIsGuest();
  const capture = () => router.push(guest ? { pathname: '/feature-gate', params: { feature: 'capture' } } : '/capture');
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      className="absolute inset-x-4 h-[68px] flex-row items-center rounded-nav bg-ink px-2"
      style={{ bottom: Math.max(bottom, 16), boxShadow: shadows.nav }}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const Icon = icons[route.name];
        const onPress = () => {
          if (guest && route.name !== 'index')
            return router.push({ pathname: '/feature-gate', params: { feature: route.name } });
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        const label = t(`tabs.${labels[route.name]}`);
        const tab = (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            className="flex-1 items-center gap-1">
            <Icon size={22} color={focused ? c.lime : c.muted} />
            <Text variant="caption" className={focused ? 'text-lime' : 'text-muted'}>{label}</Text>
          </Pressable>
        );
        if (i !== 1) return tab;
        return [
          tab,
          <Pressable key="capture" onPress={capture} accessibilityRole="button" accessibilityLabel={t('tabs.capture')} className="flex-1 items-center">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-lime" style={{ boxShadow: shadows.glow }}>
              <Plus size={24} color="#222E29" />
            </View>
          </Pressable>,
        ];
      })}
    </View>
  );
}
