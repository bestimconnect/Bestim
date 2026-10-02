import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Bell, CarFront, House, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useIsGuest } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';
import { PressableScale } from './ui/PressableScale';
import { Text } from './ui/Text';

const icons: Record<string, LucideIcon> = { index: House, vehicles: CarFront, reminders: Bell, account: UserRound };
const labels: Record<string, string> = { index: 'home', vehicles: 'vehicles', reminders: 'reminders', account: 'account' };

/**
 * Custom ink nav (spec §10): 68px, 28 radius, floating lime capture button in the centre.
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
      className="absolute inset-x-4 h-[68px] flex-row items-center rounded-nav border border-line bg-panel px-2"
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
          <PressableScale
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            className="flex-1 items-center gap-1">
            <Icon size={22} color={focused ? c.lime : c.muted} />
            <Text variant="caption" className={focused ? 'text-lime' : 'text-muted'}>{label}</Text>
          </PressableScale>
        );
        if (i !== 1) return tab;
        return [
          tab,
          // Floats: larger than the bar's icons and lifted above its top edge, ringed in the bar's colour (decisions Q57).
          <PressableScale key="capture" scale={0.92} onPress={capture} accessibilityRole="button" accessibilityLabel={t('tabs.capture')} className="flex-1 items-center" style={{ marginTop: -30 }}>
            <View className="h-[60px] w-[60px] items-center justify-center rounded-full border-4 border-panel bg-lime" style={{ boxShadow: shadows.glow }}>
              <Plus size={26} color="#222E29" strokeWidth={2.5} />
            </View>
          </PressableScale>,
        ];
      })}
    </View>
  );
}
