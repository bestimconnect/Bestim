import { router, useLocalSearchParams } from 'expo-router';
import { Bell, Wrench } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, FooterBar, PressableScale, Text } from '@/components/ui';
import { requestNotifications } from '@/lib/notifications';
import { shadows, useColors } from '@/lib/theme';
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
    <SafeAreaView className="flex-1 rounded-t-screen bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-14">
        {/* the bell: a white halo, a lime disc */}
        <View className="h-[132px] w-[132px] items-center justify-center self-center rounded-full bg-white" style={{ boxShadow: shadows.ring }}>
          <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-lime">
            <Bell size={38} color="#171B19" strokeWidth={1.8} />
          </View>
        </View>
        {/* a sample alert, as it will look on the lock screen */}
        <View className="mt-[34px] flex-row items-center gap-3 rounded-[24px] bg-white p-3.5" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-mint">
            <Wrench size={20} color={c.teal} strokeWidth={1.7} />
          </View>
          <View className="flex-1">
            <Text variant="label">{t('feedback.notify.sample')}</Text>
            <Text variant="caption" className="text-muted">{t('feedback.notify.sampleSub')}</Text>
          </View>
          <Text variant="caption" className="self-start text-muted">9:41</Text>
        </View>
        <Text variant="title" className="mt-[34px] text-center !text-[28px]">{t('feedback.notify.title')}</Text>
        <Text variant="body" className="mt-2 px-2.5 text-center !leading-[24px] text-muted">{t('feedback.notify.body')}</Text>
      </View>
      <FooterBar inset={false}>
        <Button title={t('feedback.notify.enable')} onPress={enable} />
        <PressableScale accessibilityRole="button" onPress={next} className="min-h-11 items-center justify-center">
          <Text className="!text-[14px] text-muted">{t('feedback.notify.later')}</Text>
        </PressableScale>
      </FooterBar>
    </SafeAreaView>
  );
}
