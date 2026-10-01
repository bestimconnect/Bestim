import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { Gauge } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Text } from '@/components/ui';
import { useLog, useVehicle, useVehicleLogs } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

// Screen 20 — Review a flagged reading (decisions Q9).
export default function ReviewReadingScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: log } = useLog(id);
  const { vehicle } = useVehicle(log?.vehicle_id);
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
  });
  if (!log || !vehicle) return <SafeAreaView className="flex-1 bg-paper" />;

  const current = log.odometer_reading ?? 0;
  // Previous = latest other log with a reading on or before this one, else the vehicle's odometer.
  const prevLog = logs?.find((l) => l.id !== log.id && l.odometer_reading != null && l.service_date <= log.service_date);
  const previous = prevLog?.odometer_reading ?? vehicle.current_odometer;
  const prevDate = prevLog?.service_date ?? vehicle.odometer_updated_at;
  const days = Math.max(differenceInCalendarDays(parseISO(log.service_date), parseISO(prevDate)), 1);
  const km = (n: number) => t('log.review.km', { n: n.toLocaleString('en-US') });

  return (
    <SafeAreaView className="flex-1 bg-paper px-6">
      <Header title={t('log.review.header')} />
      <View className="flex-1 gap-4 pt-6">
        <View className="h-16 w-16 items-center justify-center self-center rounded-full bg-amber">
          <Gauge size={28} color={c.ink} />
        </View>
        <Text variant="title">{t('log.review.title')}</Text>
        <Text variant="body" className="text-muted">
          {t(current < previous ? 'log.review.bodyLower' : 'log.review.body', { diff: Math.abs(current - previous).toLocaleString('en-US'), days })}
        </Text>
        {[[t('log.review.previous'), previous], [t('log.review.current'), current]].map(([k, v]) => (
          <View key={k as string} className="h-11 flex-row items-center justify-between">
            <Text variant="caption" className="text-muted">{k}</Text>
            <Text variant="label">{km(v as number)}</Text>
          </View>
        ))}
        <View className="gap-2 rounded-field bg-amber p-4">
          <Text variant="label">{t('log.review.noteTitle')}</Text>
          <Text variant="caption" className="text-muted">{t('log.review.noteBody')}</Text>
        </View>
      </View>
      <View className="gap-3 pb-4">
        <Button title={t('log.review.correct')} onPress={() => router.push({ pathname: '/capture/manual', params: { logId: id } })} />
        <Button variant="secondary" title={t('log.review.ok')} loading={confirm.isPending} onPress={() => confirm.mutate()} />
      </View>
    </SafeAreaView>
  );
}
