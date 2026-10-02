import { useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PartMetric } from '@/components/PartMetric';

import { Button, Header, Text } from '@/components/ui';
import { useIsGuest, useVehicle, useVehicleParts } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import { useLogDraft } from '@/stores/logDraft';

// Screen 22 — Reminder detail (Q24); ar-light 22/تفاصيل موعد الصيانة.png
const n = (x: number) => x.toLocaleString('en-US');

export default function ReminderScreen() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const guest = useIsGuest();
  const { vehicleId, serviceTypeId } = useLocalSearchParams<{ vehicleId: string; serviceTypeId: string }>();
  const { vehicle } = useVehicle(vehicleId);
  const part = useVehicleParts(vehicle).parts.find((p) => p.serviceType.id === serviceTypeId);
  const [busy, setBusy] = useState(false);
  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'reminders' } }} />;
  if (!vehicle || !part) return <View className="flex-1 bg-paper" />;

  const { serviceType: st, log, status } = part;
  const ar_ = i18n.language === 'ar';
  const name = ar_ ? st.name_ar : st.name_en;
  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const date = (d: string) => format(new Date(d), 'd MMMM yyyy', { locale: ar_ ? ar : enUS });
  const km = log.interval_km ?? st.default_interval_km;
  const months = log.interval_months ?? st.default_interval_months;
  const own = log.interval_km != null || log.interval_months != null;

  const over = status.state === 'overdue';

  const rows: [string, string][] = [
    [t('reminders.lastService'), date(log.service_date)],
    [t('parts.odoThen'), log.odometer_reading != null ? `${n(log.odometer_reading)} ${unit}` : '—'],
    [t('parts.interval'), [km != null ? `${n(km)} ${unit}` : '', months != null ? t('parts.months', { m: months }) : ''].filter(Boolean).join(' / ') || '—'],
    [
      t('reminders.nextDue'),
      [status.dueOdometer != null ? `${n(status.dueOdometer)} ${unit}` : '', status.dueDate ? date(status.dueDate) : ''].filter(Boolean).join(' · ') || '—',
    ],
  ];
  const how = km != null && months != null ? 'both' : km != null ? 'km' : 'months';

  const done = () => {
    useLogDraft.getState().reset({ vehicleId: vehicle.id, serviceTypeId: st.id, title: name, source: 'manual' });
    router.push('/capture/manual');
  };
  const snooze = async () => {
    setBusy(true);
    const until = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    const { error: e1 } = await supabase.from('reminders').delete().eq('vehicle_id', vehicle.id).eq('service_type_id', st.id).eq('status', 'dismissed');
    const { error } = e1
      ? { error: e1 }
      : await supabase.from('reminders').insert({ vehicle_id: vehicle.id, service_type_id: st.id, title: name, status: 'dismissed', due_date: until });
    setBusy(false);
    if (error) return toast(t('reminders.snoozeFailed'));
    qc.invalidateQueries({ queryKey: ['snoozes'] });
    router.back(); // ponytail: no shared toast component yet; Q24 "Snoozed until" toast skipped
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6">
        <Header title={name} />
        {status ? (
          <PartMetric status={status} unit={unit} label={t(over ? 'home.overdueTitle' : 'home.soonTitle', { part: name })} />
        ) : null}
        {rows.map(([label, v]) => (
          <View key={label} className="min-h-10 flex-row items-center justify-between gap-3">
            <Text variant="body" className="text-muted">{label}</Text>
            <Text variant="label" className="shrink text-end">{v}</Text>
          </View>
        ))}
        <Text variant="heading" className="mt-4">{t('reminders.howTitle')}</Text>
        <Text variant="body" className="text-muted">
          {t(`reminders.how.${how}`, { odo: n(vehicle.current_odometer), unit, km: km != null ? n(km) : '', m: months, schedule: t(own ? 'reminders.yourSchedule' : 'reminders.standardSchedule') })}
        </Text>
      </ScrollView>
      <View className="gap-3 px-6 pb-4">
        <Button title={t('reminders.done')} onPress={done} />
        {status.state !== 'ok' ? <Button title={t('reminders.snooze')} variant="secondary" loading={busy} onPress={snooze} /> : null}
      </View>
    </SafeAreaView>
  );
}
