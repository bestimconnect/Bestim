import { addMonths, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Item, Rise, Text } from '@/components/ui';
import { POP } from '@/lib/motion';
import { useVehicle, useProfile } from '@/lib/queries';
import { useColors } from '@/lib/theme';

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

// Screen 43 (log saved) — PNG 43/نجاح حفظ السجل (Q40).
export default function Success() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const p = useLocalSearchParams<Params>();
  const { vehicle } = useVehicle(p.vehicleId);
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

  const another = () => {
    router.replace({ pathname: '/capture', params: { vehicleId: p.vehicleId } });
  };

  return (
    <SafeAreaView className="flex-1 bg-paper px-6" edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View className="flex-1 justify-center gap-6">
        <Animated.View entering={POP} className="h-20 w-20 items-center justify-center self-center rounded-full bg-mint">
          <Check size={36} color={c.teal} />
        </Animated.View>
        <Rise index={1}>
        <Text variant="title" className="text-center">
          {t(first ? 'feedback.success.logTitle' : 'feedback.success.logTitleNoName', { name: first })}
        </Text>
        </Rise>
        <Rise index={2}><Text variant="body" className="text-center text-muted">{body}</Text></Rise>
        {next ? (
          <Rise index={3}>
          <Item
            icon={CalendarCheck}
            title={t('feedback.success.nextTitle')}
            subtitle={next}
            onPress={() => p.vehicleId && p.serviceTypeId && router.push({ pathname: '/reminder', params: { vehicleId: p.vehicleId, serviceTypeId: p.serviceTypeId } })}
          />
          </Rise>
        ) : null}
      </View>
      <View className="gap-2 pb-4">
        <Button title={t('feedback.success.home')} onPress={home} />
        <Button title={t('feedback.success.another')} variant="secondary" onPress={another} />
      </View>
    </SafeAreaView>
  );
}
