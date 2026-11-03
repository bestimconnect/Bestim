import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { Gauge } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Backdrop, Button, Card, FooterBar, Group, Header, IconTile, Text } from '@/components/ui';
import { useLog, useVehicle, useVehicleLogs } from '@/lib/queries';
import { toastError } from '@/components/Toast';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

// Screen 20 — Review a flagged reading (decisions Q9).
export default function ReviewReadingScreen() {
  const { t } = useTranslation();
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
      <SafeAreaView className="flex-1 bg-paper">
        <View className="px-6"><Header title={t('log.review.header')} /></View>
        <LoadingState />
      </SafeAreaView>
    );

  const current = log.odometer_reading ?? 0;
  // Previous = latest other log with a reading on or before this one, else the vehicle's odometer.
  const prevLog = logs?.find((l) => l.id !== log.id && l.odometer_reading != null && l.service_date <= log.service_date);
  const previous = prevLog?.odometer_reading ?? vehicle.current_odometer;
  const prevDate = prevLog?.service_date ?? vehicle.odometer_updated_at ?? log.service_date;
  const days = Math.max(differenceInCalendarDays(parseISO(log.service_date), parseISO(prevDate)), 1);
  const km = (n: number) => t('log.review.km', { n: n.toLocaleString('en-US') });

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Backdrop />
      <View className="px-6"><Header title={t('log.review.header')} /></View>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pb-6 pt-4" showsVerticalScrollIndicator={false}>
        <View className="items-center"><IconTile icon={Gauge} tone="amber" size={64} /></View>
        <Text variant="title">{t('log.review.title')}</Text>
        <Text variant="body" className="text-muted">
          {t(current < previous ? 'log.review.bodyLower' : 'log.review.body', { diff: Math.abs(current - previous).toLocaleString('en-US'), days })}
        </Text>
        <Group>
          {[[t('log.review.previous'), previous], [t('log.review.current'), current]].map(([k, v]) => (
            <View key={k as string} className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-3">
              <Text variant="caption" className="shrink text-muted">{k}</Text>
              <Text variant="label">{km(v as number)}</Text>
            </View>
          ))}
        </Group>
        <Card tone="amber" className="gap-2 p-4">
          <Text variant="label">{t('log.review.noteTitle')}</Text>
          <Text variant="caption" className="text-muted">{t('log.review.noteBody')}</Text>
        </Card>
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('log.review.correct')} onPress={() => router.push({ pathname: '/capture', params: { logId: id } })} />
        <Button variant="ghost" title={t('log.review.ok')} loading={confirm.isPending} onPress={() => confirm.mutate()} />
      </FooterBar>
    </SafeAreaView>
  );
}
