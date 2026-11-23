import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { AlarmClock, Droplet, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PartArt } from '@/components/PartArt';
import { useRefresh } from '@/components/Refresh';
import { TabHeader } from '@/components/TabHeader';
import { Num } from '@/components/timeline/Num';
import { Label, Row } from '@/components/timeline/Row';
import { Ticks } from '@/components/timeline/Ticks';
import { Trust, trustOf } from '@/components/timeline/Trust';
import { pace, weeksLeft } from '@/components/timeline/pace';
import { Button, Card, FooterBar, Text } from '@/components/ui';
import { lifeFraction } from '@/lib/parts';
import { openCapture } from '@/lib/reading';
import { snoozePart } from '@/lib/snooze';
import { useOdometerReadings, useServiceTypes, useVehicle, useVehicleParts } from '@/lib/queries';
import { useColors } from '@/lib/theme';

// One screen for a part's status (Part detail + Reminder detail, merged: Q107). v2 design flow 5, screen 4.
// Opened from a notification with ?vehicleId=&serviceTypeId=.
const n = (x: number) => x.toLocaleString('en-US');

export default function PartScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const refresh = useRefresh();
  const params = useLocalSearchParams<{ vehicleId: string; serviceTypeId: string }>();
  const { vehicle, isPending: vehiclesPending, refetch: refetchVehicles, isRefetching } = useVehicle(params.vehicleId);
  const { data: logs, parts } = useVehicleParts(vehicle);
  const readings = useOdometerReadings(params.vehicleId).data ?? [];
  const types = useServiceTypes();
  const st = types.data?.find((s) => s.id === params.serviceTypeId);
  const [busy, setBusy] = useState(false);
  if ((!vehicle && !vehiclesPending) || (!st && !types.isPending)) return <ErrorState onRetry={() => { refetchVehicles(); types.refetch(); }} retrying={isRefetching} />;
  if (!vehicle || !st) return <SafeAreaView className="flex-1 bg-paper"><LoadingState /></SafeAreaView>;

  const arabic = i18n.language === 'ar';
  const locale = arabic ? ar : enUS;
  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const mine = (logs ?? []).filter((l) => l.service_type_id === st.id); // newest first
  const last = mine[0];
  const part = parts.find((p) => p.serviceType.id === st.id);
  const status = part?.status;
  const km = last?.interval_km ?? st.default_interval_km;
  const months = last?.interval_months ?? st.default_interval_months;
  const name = arabic ? st.name_ar : st.name_en;
  const snoozedUntil = part?.snoozedUntil;
  const canSnooze = status != null && status.state !== 'ok' && !snoozedUntil;
  const tone = status?.state === 'overdue' ? 'late' : status?.state === 'soon' ? 'soon' : 'ok';
  const life = status ? (status.state === 'overdue' ? 0 : 1 - lifeFraction(status, km).used) : null; // same math as the part rows: 1 - max(km used, months used), 0..1
  const perDay = pace(readings);
  const weeks = status ? weeksLeft(status, perDay) : null;
  const used = status?.remainingKm != null && km != null ? Math.min(km, Math.max(0, km - status.remainingKm)) : null;
  const word = { ok: t('tl.good'), soon: t('tl.dueSoon'), late: t('tl.overdueWord') }[tone];
  const wordTone = { ok: 'bg-okTint text-ok', soon: 'bg-soonTint text-soon', late: 'bg-lateTint text-late' }[tone];

  const snooze = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    await snoozePart(vehicle.id, st.id, name);
    setBusy(false);
  };
  const done = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openCapture({ vehicleId: vehicle.id, serviceTypeId: st.id });
  };
  const next = status?.dueOdometer;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="px-6"><TabHeader title={name} back /></View>
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-2 px-6 pb-40 pt-3" showsVerticalScrollIndicator={false}>
        {status && life != null ? (
          <Card className="gap-3 p-4">
            <View className="flex-row items-center gap-2">
              <Droplet size={15} color={c.muted} />
              <Text variant="caption" className="text-muted">{t('tl.life', { name })}</Text>
            </View>
            <View className="flex-row items-end justify-between">
              <Num value={String(Math.round(life * 100))} unit="%" size={54} />
              <PartArt nameEn={st.name_en} size={84} state={status.state === 'overdue' ? 'late' : status.state} />
            </View>
            <Ticks n={14} on={Math.round(life * 14)} tone={tone} height={46} />
            <View className="flex-row items-center justify-between">
              <Text variant="label" className="font-normal">
                {status.remainingKm != null ? (status.remainingKm >= 0 ? t('tl.kmLeft', { n: n(status.remainingKm), u: unit }) : t('tl.overBy', { n: n(-status.remainingKm), u: unit }))
                  : status.dueDate ? format(parseISO(status.dueDate), 'd MMM yyyy', { locale }) : ''}
              </Text>
              <View className={`rounded-full px-2.5 py-1 ${wordTone.split(' ')[0]}`}>
                <Text variant="caption" className={wordTone.split(' ')[1]} style={{ fontSize: 11.5 }}>{word}</Text>
              </View>
            </View>
            {weeks != null && weeks > 0 && status.state !== 'overdue' ? (
              <Text variant="caption" className="text-muted" style={{ fontSize: 12.5 }}>
                {perDay ? t('tl.pace', { count: weeks, n: n(Math.round(perDay)), u: unit }) : t('tl.about', { count: weeks })}
              </Text>
            ) : null}
            {snoozedUntil ? <Text variant="caption" className="text-muted">{t('tl.snoozedUntil', { date: format(parseISO(snoozedUntil), 'd MMM', { locale }) })}</Text> : null}
          </Card>
        ) : null}
        {last ? (
          <View className="flex-row gap-2">
            {([[t('tl.lastChange'), last.odometer_reading], [t('tl.nextChange'), next]] as const).map(([label, v]) => (
              <Card key={label} className="flex-1 gap-2 px-4 py-3.5">
                <Text variant="caption" className="text-muted">{label}</Text>
                {v != null ? <Num value={n(v)} unit={unit} size={26} /> : <Text variant="label" className="text-muted">—</Text>}
              </Card>
            ))}
          </View>
        ) : null}
        {used != null && km != null ? (
          <Text variant="caption" className="mx-1 mt-1 text-muted" style={{ fontSize: 12, lineHeight: 19 }}>{t('tl.how', { used: n(used), total: n(km), u: unit })}</Text>
        ) : months != null && km == null ? (
          <Text variant="caption" className="mx-1 mt-1 text-muted">{t('parts.every')}: {t('parts.months', { m: months })}</Text>
        ) : null}
        {mine.length ? (
          <View className="gap-2">
            <Label>{t('tl.history')}</Label>
            {mine.slice(0, 2).map((l) => (
              <Row
                key={l.id}
                leading={<PartArt nameEn={st.name_en} size={44} />}
                title={l.title}
                sub={[format(parseISO(l.service_date), 'd MMM', { locale }), l.odometer_reading != null ? `${n(l.odometer_reading)} ${unit}` : null].filter(Boolean).join(' · ')}
                aside={<Trust kind={trustOf(l)} />}
                onPress={() => router.push({ pathname: '/log/[id]', params: { id: l.id } })}
              />
            ))}
            {mine.length > 2 ? <Button variant="ghost" title={t('parts.viewLogs')} onPress={() => router.push({ pathname: '/part-logs', params: { vehicleId: vehicle.id, serviceTypeId: st.id } })} /> : null}
          </View>
        ) : null}
      </ScrollView>
      <FooterBar inset={false}>
        <Button icon={<Plus size={20} color={c.onbtn} />} title={t('tl.logChange')} onPress={done} />
        {canSnooze ? <Button variant="ghost" icon={<AlarmClock size={20} color={c.teal} />} title={t('reminders.snooze')} loading={busy} onPress={snooze} /> : null}
      </FooterBar>
    </SafeAreaView>
  );
}
