import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { I18nManager, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { CarPill } from '@/components/CarPill';
import { BellButton, PressableScale, Text } from '@/components/ui';
import { useProfile } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';

/**
 * The top of Money, My cars and Menu: the car pill and the bell on the page, then a large title.
 * `back`: a pushed page (My cars, Menu are no longer tabs in v2) gets a round back button first.
 */
export function TabHeader({ title, allCars, back }: { title: string; allCars?: boolean; back?: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  return (
    <View className="gap-3 pt-2">
      <View className="flex-row items-center gap-3">
        {back && router.canGoBack() ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white" style={{ boxShadow: shadows.ring }}>
            <Back size={22} color={c.ink} />
          </PressableScale>
        ) : null}
        <CarPill allCars={allCars} />
        <View className="flex-1" />
        <BellButton tone="paper" />
      </View>
      <Text variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{title}</Text>
    </View>
  );
}

/** v2 (Q133): the user's avatar on Home opens the Menu (account and settings). */
export function MenuButton() {
  const { t } = useTranslation();
  const profile = useProfile().data;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={t('tabs.menu')} onPress={() => router.push('/account')} className="h-11 w-11 items-center justify-center overflow-hidden rounded-full">
      <Avatar path={profile?.avatar_url} name={profile?.full_name} size={44} />
    </PressableScale>
  );
}
