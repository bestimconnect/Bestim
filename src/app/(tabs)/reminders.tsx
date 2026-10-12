import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { Bell, CalendarCheck, ChevronDown, Gauge } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useTabBarSpace } from '@/components/TabBar';
import { openCapture } from '@/lib/reading';
import { pickVehicle } from '@/lib/sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PartRow } from '@/components/PartStatus';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Button, Choice, Item, Text, Rise } from '@/components/ui';
import { needsAttention, useCurrentVehicle, useVehicleParts, useVehicles, vehicleName, type Part } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

const STALE_ODOMETER_DAYS = 30; // Q23

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
      <Button title={t('reminders.empty.cta')} onPress={() => openCapture()} />
    </View>
  );
}

// Screen 21 — Reminders; ar-light 21/مواعيد الصيانة.png
export default function RemindersScreen() {
  const refresh = useRefresh();
  const space = useTabBarSpace();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { vehicle, isPending: vehiclesLoading } = useCurrentVehicle();
  const vehicles = useVehicles().data ?? [];
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const { parts, isError, data, refetch, isRefetching, isPending: partsLoading } = useVehicleParts(vehicle);
  const onShowSaved = useShowSavedAction();
  const [seg, setSeg] = useState<'attention' | 'all'>('attention');

  if (isError && !data) return <ErrorState onRetry={refetch} retrying={isRefetching} onShowSaved={onShowSaved} />;
  const unit = vehicle?.odometer_unit ?? 'km';
  const name = vehicle ? vehicleName(vehicle) : '';
  const staleDays = vehicle?.odometer_updated_at ? differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at)) : 0;
  const stale = parts.length > 0 && staleDays >= STALE_ODOMETER_DAYS;
  const list =
    seg === 'attention'
      ? needsAttention(parts)
      : [...parts].sort((a, b) => {
          const o = (p: Part) => (p.status.state === 'overdue' ? 0 : 1);
          return o(a) - o(b) || (a.status.dueDate ?? '9999').localeCompare(b.status.dueDate ?? '9999') || a.status.urgency - b.status.urgency;
        });
  const groups = [
    ['reminders.group.attention', list.filter((p) => !p.snoozedUntil && p.status.state !== 'ok')],
    ['reminders.group.onTime', list.filter((p) => !p.snoozedUntil && p.status.state === 'ok')],
    ['partStatus.snoozed', list.filter((p) => p.snoozedUntil)],
  ] as const;
  const showStale = seg === 'attention' && stale;

  const pick = () =>
    pickVehicle(vehicle?.id ?? null, setCurrent);

  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: space }}>
      <View className="gap-4 px-6">
        <Text variant="heading" className="h-11 text-center leading-[44px]">{t('tabs.reminders')}</Text>
        {vehiclesLoading || (vehicle && partsLoading) ? null : !vehicle || !parts.length ? (
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
            {groups.map(([key, items], g) =>
              items.length ? (
                <Rise key={key} index={g}>
                  <View className="gap-2.5">
                    <Text variant="caption" className="px-1 font-bold text-muted">{t(key)}</Text>
                    {items.map((p) => (
                      <PartRow
                        key={p.serviceType.id}
                        part={p}
                        name={i18n.language === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en}
                        unit={t(`vehicles.unit.${unit}`)}
                        onPress={() => router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: p.serviceType.id } })}
                      />
                    ))}
                  </View>
                </Rise>
              ) : null,
            )}
            {!list.length && !showStale ? (
              <View className="gap-4">
                <Text variant="body" className="text-muted">{t('reminders.onSchedule')}</Text>
                <Button title={t('vehicles.addRecord')} onPress={() => openCapture({ vehicleId: vehicle.id })} />
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
