import { router, useLocalSearchParams } from 'expo-router';
import { Bell, CalendarCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { requestNotifications } from '@/lib/notifications';
import { shadows, useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

// Screen 45 — Notification permission (modal), PNG 45/إذن التنبيهات (Q39). Same illustration as the reminders empty state.
export default function NotifyPermission() {
  const { t } = useTranslation();
  const c = useColors();
  const params = useLocalSearchParams<Record<string, string>>();
  useEffect(() => useSettings.getState().set({ notifyAsked: true }), []); // shown once, even if swiped away

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
    <SafeAreaView className="flex-1 rounded-t-screen border-t border-line bg-sheet px-6" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center gap-6">
        <View className="h-[200px] items-center justify-center">
          <View className="h-[108px] w-[180px] items-center rounded-item bg-white p-4" style={{ boxShadow: shadows.soft }}>
            <Text variant="label">{t('reminders.empty.card')}</Text>
            <CalendarCheck size={40} color={c.teal} style={{ marginTop: 10 }} />
          </View>
          <View className="absolute h-11 w-11 items-center justify-center rounded-full bg-panel" style={{ marginTop: 108, marginStart: 130 }}>
            <Bell size={22} color={c.lime} />
          </View>
        </View>
        <Text variant="title">{t('feedback.notify.title')}</Text>
        <Text variant="body" className="text-muted">{t('feedback.notify.body')}</Text>
      </View>
      <View className="gap-2 pb-4">
        <Button title={t('feedback.notify.enable')} onPress={enable} />
        <Button title={t('feedback.notify.later')} variant="secondary" onPress={next} />
      </View>
    </SafeAreaView>
  );
}
