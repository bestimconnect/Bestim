import { router, useLocalSearchParams } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, FooterBar, IconTile, Sheen, Text } from '@/components/ui';
import { requestNotifications } from '@/lib/notifications';
import { useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

// Screen 45 — Notification permission (modal), PNG 45/إذن التنبيهات (Q39). Same illustration as the reminders empty state.
export default function NotifyPermission() {
  const { t } = useTranslation();
  const c = useColors();
  const params = useLocalSearchParams<Record<string, string>>();
  useEffect(() => {
    useSettings.getState().set({ notifyAsked: true });
  }, []); // shown once, even if swiped away

  // From a modal: close it, then push (replace would only close it).
  const next = () => {
    useSettings.getState().set({ notifyAsked: true });
    router.back();
    router.push({ pathname: '/success', params });
  };
  const enable = async () => {
    await requestNotifications().catch(() => false);
    next();
  };

  return (
    <SafeAreaView className="flex-1 rounded-t-screen border-t border-line bg-sheet" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center gap-6 px-6">
        {/* a halo and a tile, both centred: nothing is positioned by hand */}
        <View className="h-44 w-44 items-center justify-center self-center overflow-hidden rounded-full">
          <Sheen color={c.teal} opacity={0.14} />
          <IconTile icon={Bell} size={104} />
        </View>
        <Text variant="title" className="text-center">{t('feedback.notify.title')}</Text>
        <Text variant="body" className="text-center text-muted">{t('feedback.notify.body')}</Text>
      </View>
      <FooterBar inset={false}>
        <Button title={t('feedback.notify.enable')} onPress={enable} />
        <Button title={t('feedback.notify.later')} variant="ghost" onPress={next} />
      </FooterBar>
    </SafeAreaView>
  );
}
