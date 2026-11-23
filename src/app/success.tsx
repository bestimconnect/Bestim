import { addMonths, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PartArt } from '@/components/PartArt';
import { Button, Card, FooterBar, Rise, Text } from '@/components/ui';
import { openCapture } from '@/lib/reading';
import { POP } from '@/lib/motion';
import { useProfile, useServiceTypes, useVehicle } from '@/lib/queries';

type Params = {
  kind?: 'log' | 'batch'; // batch = several records from one voice recording (Q67)
  count?: string; // batch: how many were saved
  vehicleId?: string;
  serviceTypeId?: string;
  odo?: string; // odometer of the saved log
  km?: string; // its interval in km
  months?: string; // its interval in months
  date?: string; // its service date (YYYY-MM-DD)
  offline?: string;
  review?: string;
  nophoto?: string;
  queued?: string; // a voice recording kept for later (Q93)
};

// Log saved, v2 (design-v2 flow 4 #5): a lime check, the title, and the next date card with the part picture.
export default function Success() {
  const { t, i18n } = useTranslation();
  const p = useLocalSearchParams<Params>();
  const { vehicle } = useVehicle(p.vehicleId);
  const service = (useServiceTypes().data ?? []).find((x) => x.id === p.serviceTypeId);
  const first = useProfile().data?.full_name?.trim().split(/\s+/)[0];

  // The one place with a celebration (decisions Q57): the badge pops, the lines rise, one success vibration.
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const home = () => {
    router.dismissAll();
    router.replace('/');
  };
  const batch = p.kind === 'batch';
  const offline = p.offline === '1';

  // Q40: "Your next date" row, from the interval the log was saved with.
  const km = p.km ? Number(p.km) : null;
  const months = p.months ? Number(p.months) : null;
  const unit = t(`home.${vehicle?.odometer_unit ?? 'km'}`);
  const n = (v: number) => v.toLocaleString('en-US');
  let next: string | null = null;
  if (!offline && p.date) {
    if (km != null && p.odo) next = t(months != null ? 'feedback.success.nextBoth' : 'feedback.success.nextKm', { km: n(Number(p.odo) + km), unit, m: months });
    else if (months != null)
      next = t('feedback.success.nextDate', { date: format(addMonths(parseISO(p.date), months), 'd MMMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS }) });
  }

  const body = batch
      ? t(p.count === '1' ? 'capture.batch.successOne' : 'capture.batch.successMany', { count: Number(p.count) }) +
        (p.review === '1' ? ` ${t('capture.batch.successReview')}` : '')
    : p.queued === '1'
      ? t('voiceQueue.savedBody')
    : offline
      ? t('feedback.success.offlineBody') + (p.nophoto === '1' ? ` ${t('feedback.success.noPhoto')}` : '')
      : p.review === '1'
        ? t('feedback.success.reviewBody')
        : t(next ? 'feedback.success.logBody' : 'feedback.success.logBodyPlain');

  const another = () => openCapture({ vehicleId: p.vehicleId });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View className="flex-1 justify-center gap-4 px-5">
        <Animated.View entering={POP} className="h-24 w-24 items-center justify-center self-center rounded-full bg-lime">
          <Check size={44} color="#171B19" strokeWidth={2.4} />
        </Animated.View>
        <Rise index={1}>
          <Text variant="title" className="text-center">
            {t(first ? 'feedback.success.logTitle' : 'feedback.success.logTitleNoName', { name: first })}
          </Text>
        </Rise>
        <Rise index={2}><Text variant="caption" className="text-center text-muted">{body}</Text></Rise>
        {next ? (
          <Rise index={3}>
            <Card
              className="flex-row items-center gap-3 p-4"
              onPress={() => p.vehicleId && p.serviceTypeId && router.push({ pathname: '/part', params: { vehicleId: p.vehicleId, serviceTypeId: p.serviceTypeId } })}>
              <View className="flex-1 gap-1">
                <Text variant="label" className="text-[15px]">{t('feedback.success.nextTitle')}</Text>
                <Text variant="caption" className="text-muted">{next}</Text>
              </View>
              <PartArt nameEn={service?.name_en} size={46} />
            </Card>
          </Rise>
        ) : null}
      </View>
      <FooterBar inset={false}>
        <Button title={t('logv2.done')} onPress={home} />
        <Button title={t('feedback.success.another')} variant="ghost" onPress={another} />
      </FooterBar>
    </SafeAreaView>
  );
}
