import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Redirect, router } from 'expo-router';
import * as Icons from 'lucide-react-native';
import { Bell, CalendarCheck, ChevronDown, Gauge, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { pickVehicle } from '@/lib/sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Button, Choice, Item, Text, Rise } from '@/components/ui';
import { needsAttention, useCurrentVehicle, useIsGuest, useVehicleParts, useVehicles, type Part } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

const STALE_ODOMETER_DAYS = 30; // Q23 (not yet exported from src/lib/parts.ts)
const num = (n: number) => Math.abs(Math.round(n)).toLocaleString('en-US');
const iconOf = (name?: string | null): LucideIcon => (name && (Icons as any)[name]) || Icons.Wrench;
const tones = { overdue: 'blush', soon: 'amber', ok: 'mint' } as const;

// Q10 subtitles (same keys as Home), Q22 snoozed, Q25 ok.
function subtitle(t: TFunction, lang: string, p: Part, unit: string) {
  const u = t(`home.${unit}`);
  const loc = { locale: lang === 'ar' ? ar : enUS };
  const { state, remainingKm: km, remainingDays: d, dueOdometer, dueDate } = p.status;
  if (p.snoozedUntil) return t('reminders.snoozedUntil', { date: format(parseISO(p.snoozedUntil), 'd MMM yyyy', loc) });
  if (state === 'overdue') return km != null && km <= 0 ? t('home.overdueDist', { km: num(km), unit: u }) : t('home.overdueDays', { d: num(d!) });
  if (state === 'soon') {
    if (km != null && d != null) return t('home.soonBoth', { km: num(km), unit: u, d: num(d) });
    return km != null ? t('home.soonDist', { km: num(km), unit: u }) : t('home.soonDays', { d: num(d!) });
  }
  return dueDate
    ? t('reminders.okDate', { date: format(parseISO(dueDate), 'd MMM yyyy', loc) })
    : t('reminders.okOdo', { odo: num(dueOdometer!), unit: u });
}

// Screen 38 — Reminders / empty; ar-light 38/المواعيد/فارغة.png
function Empty() {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <View className="gap-6">
      <View className="h-[200px] items-center justify-center">
        <View className="h-[108px] w-[180px] items-center rounded-item bg-white p-4" style={{ boxShadow: shadows.soft }}>
          <Text variant="label">{t('reminders.empty.card')}</Text>
          <CalendarCheck size={40} color={c.teal} style={{ marginTop: 10 }} />
        </View>
        <View className="absolute h-11 w-11 items-center justify-center rounded-full bg-panel" style={{ marginTop: 108, marginStart: 130 }}>
          <Bell size={22} color={c.lime} />
        </View>
      </View>
      <Text variant="title">{t('reminders.empty.title')}</Text>
      <Text variant="body" className="text-muted">{t('reminders.empty.body')}</Text>
      <Button title={t('reminders.empty.cta')} onPress={() => router.push('/capture')} />
    </View>
  );
}

// Screen 21 — Reminders; ar-light 21/مواعيد الصيانة.png
export default function RemindersScreen() {
  const refresh = useRefresh();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const guest = useIsGuest();
  const { vehicle } = useCurrentVehicle();
  const vehicles = useVehicles().data ?? [];
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const { parts, isError, data, refetch, isRefetching } = useVehicleParts(vehicle);
  const onShowSaved = useShowSavedAction();
  const [seg, setSeg] = useState<'attention' | 'all'>('attention');
  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'reminders' } }} />;

  if (isError && !data) return <ErrorState onRetry={refetch} retrying={isRefetching} onShowSaved={onShowSaved} />;
  const unit = vehicle?.odometer_unit ?? 'km';
  const name = vehicle ? `${vehicle.make} ${vehicle.model}` : '';
  const staleDays = vehicle ? differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at)) : 0;
  const stale = parts.length > 0 && staleDays >= STALE_ODOMETER_DAYS;
  const list =
    seg === 'attention'
      ? needsAttention(parts)
      : [...parts].sort((a, b) => {
          const o = (p: Part) => (p.status.state === 'overdue' ? 0 : 1);
          return o(a) - o(b) || (a.status.dueDate ?? '9999').localeCompare(b.status.dueDate ?? '9999') || a.status.urgency - b.status.urgency;
        });
  const showStale = seg === 'attention' && stale;

  const pick = () =>
    pickVehicle(vehicle?.id ?? null, setCurrent);

  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}>
      <View className="gap-4 px-6">
        <Text variant="heading" className="h-11 text-center leading-[44px]">{t('tabs.reminders')}</Text>
        {!vehicle || !parts.length ? (
          <Empty />
        ) : (
          <>
            <Text variant="title">{t('reminders.title')}</Text>
            <Pressable onPress={pick} disabled={vehicles.length < 2} className="flex-row items-center gap-2">
              <Text variant="label" className="text-muted">{name}</Text>
              {vehicles.length > 1 ? <ChevronDown size={18} color={c.teal} /> : null}
            </Pressable>
            <Choice
              className="bg-line"
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'attention', label: t('reminders.attention') },
                { value: 'all', label: t('reminders.all') },
              ]}
            />
            {showStale ? (
              <Item
                icon={Gauge}
                tone="sky"
                title={t('reminders.staleTitle', { vehicle: name })}
                subtitle={t('reminders.staleBody', { n: staleDays })}
                onPress={() => router.push('/update-odometer')}
              />
            ) : null}
            {list.map((p, i) => (
              <Rise key={p.serviceType.id} index={i}>
              <Item
                icon={iconOf(p.serviceType.icon)}
                tone={tones[p.status.state]}
                title={i18n.language === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en}
                subtitle={subtitle(t, i18n.language, p, unit)}
                onPress={() => router.push({ pathname: '/reminder', params: { vehicleId: vehicle.id, serviceTypeId: p.serviceType.id } })}
              />
              </Rise>
            ))}
            {!list.length && !showStale ? <Text variant="body" className="text-muted">{t('reminders.calm')}</Text> : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
