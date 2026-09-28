import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { endTour, TourSlide } from '@/components/TourSlide';

// Figma bar heights (167:57244..57256), laid out via flex so RTL mirrors correctly.
const BAR_HEIGHTS = [22, 48, 74, 100, 58, 134, 86, 52, 118, 80, 42, 24];

function VoiceIllustration() {
  return (
    <View className="h-[134px] w-full flex-row items-center justify-between">
      {BAR_HEIGHTS.map((h, i) => (
        <View key={i} className="w-2 rounded bg-lime" style={{ height: h }} />
      ))}
    </View>
  );
}

// Screen 33 — Tour / Voice, Figma 167:57220 (ar-light)
export default function TourVoiceScreen() {
  const { t } = useTranslation();
  return (
    <TourSlide
      step={1}
      title={t('onboarding.tour.voice.title')}
      body={t('onboarding.tour.voice.body')}
      cta={t('onboarding.tour.next')}
      skip={t('onboarding.tour.skip')}
      onNext={() => router.push('/tour-reminders')}
      onSkip={() => endTour()}
      illustration={<VoiceIllustration />}
    />
  );
}
