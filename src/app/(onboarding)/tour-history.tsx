import { router } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TourSlide } from '@/components/TourSlide';
import { Text } from '@/components/ui';
import { useColors } from '@/lib/theme';

// Screen 35 — Tour / History, Figma 167:57316 (ar-light) / 167:64962 (en-light).
// Text pulled from docs/figma-metadata.xml layer names; body copy was truncated in the source
// layer name and completed here — verify the tail against the live design when convenient.
// This screen has no "skip" text node in the source (only screens 33/34 do), so none is rendered.
function HistoryIllustration() {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <View className="h-full w-full">
      <View
        className="absolute gap-2 rounded-2xl p-4"
        style={{ left: 71, top: 56, width: 200, height: 88, backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <View className="flex-row items-center gap-2">
          <BadgeCheck size={20} color={c.lime} />
          <Text variant="caption" className="text-paper">{t('onboarding.tour.history.cardLabel')}</Text>
        </View>
        <Text variant="caption" className="text-muted">{t('onboarding.tour.history.cardSubLabel')}</Text>
        <View className="h-1 w-[120px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
      </View>
    </View>
  );
}

export default function TourHistoryScreen() {
  const { t } = useTranslation();
  return (
    <TourSlide
      step={3}
      title={t('onboarding.tour.history.title')}
      body={t('onboarding.tour.history.body')}
      cta={t('onboarding.tour.done')}
      onNext={() => router.replace('/add-vehicle')}
      illustration={<HistoryIllustration />}
    />
  );
}
