import { addMonths, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, Car, Check, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Item, Rise, Text } from '@/components/ui';
import { POP } from '@/lib/motion';
import { useIsGuest, useVehicle, useProfile } from '@/lib/queries';
import { useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';

type Params = {
  kind?: 'log' | 'vehicle' | 'batch'; // batch = several records from one voice recording (Q67)
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
};

// Screens 43 (log saved) + 44 (vehicle added) — PNGs 43/نجاح حفظ السجل, 44/نجاح إضافة السيارة (Q40, Q41).
export default function Success() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const p = useLocalSearchParams<Params>();
  const guest = useIsGuest();
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
  const isLog = p.kind === 'log' || batch;
  const offline = p.offline === '1';

  // Q40: "Your next date" row, from the interval the log was saved with.
  const km = p.km ? Number(p.km) : null;
  const months = p.months ? Number(p.months) : null;
  const unit = t(`home.${vehicle?.odometer_unit ?? 'km'}`);
  const n = (v: number) => v.toLocaleString('en-US');
  let next: string | null = null;
  if (isLog && !offline && p.date) {
    if (km != null && p.odo) next = t(months != null ? 'feedback.success.nextBoth' : 'feedback.success.nextKm', { km: n(Number(p.odo) + km), unit, m: months });
    else if (months != null)
      next = t('feedback.success.nextDate', { date: format(addMonths(parseISO(p.date), months), 'd MMMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS }) });
  }

  const body = !isLog
    ? t('feedback.success.vehicleBody')
    : batch
      ? t(p.count === '1' ? 'capture.batch.successOne' : 'capture.batch.successMany', { count: Number(p.count) }) +
        (p.review === '1' ? ` ${t('capture.batch.successReview')}` : '')
    : offline
      ? t('feedback.success.offlineBody') + (p.nophoto === '1' ? ` ${t('feedback.success.noPhoto')}` : '')
      : p.review === '1'
        ? t('feedback.success.reviewBody')
        : t(next ? 'feedback.success.logBody' : 'feedback.success.logBodyPlain');

  const another = () => {
    useLogDraft.getState().reset({ vehicleId: p.vehicleId ?? null, source: 'manual' });
    router.replace('/capture');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper px-6" edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View className="flex-1 justify-center gap-6">
        {isLog ? (
          <Animated.View entering={POP} className="h-20 w-20 items-center justify-center self-center rounded-full bg-mint">
            <Check size={36} color={c.teal} />
          </Animated.View>
        ) : (
          <Animated.View entering={POP} className="h-[200px] items-center justify-center self-center">
            <View className="h-[200px] w-[200px] items-center justify-center rounded-full border-[6px] border-line">
              <View className="h-[120px] w-[120px] items-center justify-center rounded-full bg-panel">
                <Car size={56} color={c.lime} />
              </View>
            </View>
            <View className="absolute end-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-lime">
              <Sparkles size={16} color="#222E29" />
            </View>
          </Animated.View>
        )}
        <Rise index={1}>
        <Text variant="title" className="text-center">
          {isLog ? t(first ? 'feedback.success.logTitle' : 'feedback.success.logTitleNoName', { name: first }) : t('feedback.success.vehicleTitle')}
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
        {isLog ? (
          <>
            <Button title={t('feedback.success.home')} onPress={home} />
            <Button title={t('feedback.success.another')} variant="secondary" onPress={another} />
          </>
        ) : guest ? (
          <Button title={t('feedback.success.home')} onPress={home} />
        ) : (
          <>
            <Button title={t('feedback.success.firstService')} onPress={() => router.replace('/capture')} />
            <Button title={t('feedback.success.home')} variant="secondary" onPress={home} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
