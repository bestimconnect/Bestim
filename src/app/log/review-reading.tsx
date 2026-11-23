import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Num } from '@/components/timeline/Num';
import { Button, Card, FooterBar, Text } from '@/components/ui';
import { useLog, useVehicle, useVehicleLogs } from '@/lib/queries';
import { toastError } from '@/components/Toast';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

// Screen 20 — Review a flagged reading (decisions Q9).
export default function ReviewReadingScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const logQuery = useLog(id);
  const log = logQuery.data;
  const { vehicle, isPending: vehiclesPending, refetch: refetchVehicles } = useVehicle(log?.vehicle_id);
  const logs = useVehicleLogs(log?.vehicle_id).data;

  const confirm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('vehicles')
        .update({ current_odometer: Math.max(vehicle!.current_odometer, log!.odometer_reading ?? 0) })
        .eq('id', log!.vehicle_id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['vehicles'] });
      router.back();
    },
    onError: (e) => toastError(errorText(e)),
  });
  if ((!log && !logQuery.isPending) || (log && !vehicle && !vehiclesPending))
    return <ErrorState onRetry={() => { logQuery.refetch(); refetchVehicles(); }} retrying={logQuery.isRefetching} />;
  if (!log || !vehicle)
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <PageHeader title={t('log.review.header')} />
        <LoadingState />
      </SafeAreaView>
    );

  const current = log.odometer_reading ?? 0;
  // Previous = latest other log with a reading on or before this one, else the vehicle's odometer.
  const prevLog = logs?.find((l) => l.id !== log.id && l.odometer_reading != null && l.service_date <= log.service_date);
  const previous = prevLog?.odometer_reading ?? vehicle.current_odometer;
  const prevDate = prevLog?.service_date ?? vehicle.odometer_updated_at ?? log.service_date;
  const days = Math.max(differenceInCalendarDays(parseISO(log.service_date), parseISO(prevDate)), 1);

  const diff = Math.abs(current - previous).toLocaleString('en-US');
  // Design flow 11 #7: the reading on a dark tile, the doubt in an amber-edged card, three ways out.
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('log.review.header')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-4" showsVerticalScrollIndicator={false}>
        <View className="items-center rounded-[24px] bg-panel p-4">
          <View className="w-full items-center rounded-[16px] py-6" style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: c.lime }}>
            <Text style={{ fontFamily: 'Poppins_300Light', fontSize: 52, lineHeight: 60, letterSpacing: 6, color: c.lime, writingDirection: 'ltr', fontVariant: ['tabular-nums'] }}>{String(current).padStart(6, '0')}</Text>
          </View>
        </View>
        <Card className="gap-1.5 p-4">
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0, borderRadius: 24, boxShadow: `0 0 0 1.5px ${c.soon}` }} />
          <Text variant="caption" className="text-muted">{t('log.review.odd.read')}</Text>
          <Num value={current.toLocaleString('en-US')} unit={t('log.review.odd.unit')} size={40} />
          <View className="flex-row items-center gap-1.5">
            <TriangleAlert size={14} color={c.soon} />
            <Text variant="caption" className="shrink text-soon">{t(current < previous ? 'log.review.odd.lower' : 'log.review.odd.jump', { diff, days })}</Text>
          </View>
          <Text variant="caption" className="text-muted">{t('log.review.odd.last', { n: previous.toLocaleString('en-US') })}</Text>
        </Card>
        <Text variant="caption" className="px-1 text-muted">{t('log.review.noteBody')}</Text>
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('log.review.odd.right')} loading={confirm.isPending} onPress={() => confirm.mutate()} />
        <View className="flex-row gap-3">
          <Button className="flex-1" variant="secondary" title={t('log.review.odd.mine')} onPress={() => router.push({ pathname: '/capture', params: { logId: id } })} />
          <Button className="flex-1" variant="secondary" title={t('log.review.odd.again')} onPress={() => router.push({ pathname: '/update-odometer', params: { vehicleId: log.vehicle_id } })} />
        </View>
      </FooterBar>
    </SafeAreaView>
  );
}
