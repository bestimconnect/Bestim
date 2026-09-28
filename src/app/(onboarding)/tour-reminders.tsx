import { router } from 'expo-router';
import { Bell, CalendarCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { endTour, TourSlide } from '@/components/TourSlide';
import { Text } from '@/components/ui';
import { useColors } from '@/lib/theme';

// Screen 34 — Tour / Schedule (per docs/figma-screens.md #34), Figma 167:57268 (ar-light) / 167:64914 (en-light).
// Text pulled from docs/figma-metadata.xml layer names; body copy was truncated in the source
// layer name and completed here — verify the tail against the live design when convenient.
function ReminderIllustration() {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <View className="h-full w-full">
      <View
        className="absolute justify-center rounded-2xl p-4"
        style={{ left: 81, top: 26, width: 180, height: 108, backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <Text variant="caption" className="text-paper">{t('onboarding.tour.reminders.cardLabel')}</Text>
        <View className="absolute items-center justify-center" style={{ left: 70, top: 50, width: 40, height: 40 }}>
          <CalendarCheck size={22} color={c.lime} />
        </View>
      </View>
      <View
        className="absolute items-center justify-center rounded-full"
        style={{ left: 225, top: 114, width: 44, height: 44, backgroundColor: 'rgba(211,245,61,0.15)' }}>
        <Bell size={20} color={c.lime} />
      </View>
    </View>
  );
}

export default function TourRemindersScreen() {
  const { t } = useTranslation();
  return (
    <TourSlide
      step={2}
      title={t('onboarding.tour.reminders.title')}
      body={t('onboarding.tour.reminders.body')}
      cta={t('onboarding.tour.next')}
      skip={t('onboarding.tour.skip')}
      onNext={() => router.push('/tour-history')}
      onSkip={() => endTour()}
      illustration={<ReminderIllustration />}
    />
  );
}
