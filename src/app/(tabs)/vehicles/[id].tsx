import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Icons from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { FuelCard } from '@/components/FuelCard';
import { useRefresh } from '@/components/Refresh';
import { useLightStatusBar } from '@/components/Hero';
import { Choice, Item, Metric, PressableScale, Rise, Text } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { needsAttention, useExpenses, useRecordCategories, useVehicle, useVehicleParts, vehicleName, type Part } from '@/lib/queries';
import { useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';

// Screen 09 — Vehicle detail, Figma ar-light 09/تفاصيل السيارة (segments per decisions Q15, links Q16).
type Tab = 'overview' | 'log' | 'reminders';
const n = (x: number) => x.toLocaleString('en-US');
const icon = (name?: string) => (Icons as any)[name ?? ''] ?? Icons.Wrench;

export default function VehicleDetail() {
  const refresh = useRefresh();
  useLightStatusBar();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const [seg, setSeg] = useState<Tab>(tab ?? 'overview');
  const { vehicle, isError, data: all, refetch, isRefetching } = useVehicle(id);
  const { data: logs, parts } = useVehicleParts(vehicle);
  const expenses = useExpenses().data ?? [];
  const tyres = useRecordCategories().data?.find((c) => !c.parent_id && c.name_en === 'Tyres & wheels');
  if (isError && !all) return <ErrorState onRetry={refetch} retrying={isRefetching} />;
  if (!vehicle) return <View className="flex-1 bg-paper" />;

  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const currency = t('vehicles.currency');
  const year = new Date().getFullYear().toString();
  const spent = expenses.filter((e) => e.vehicle_id === vehicle.id && e.expense_date.startsWith(year)).reduce((s, e) => s + e.amount, 0);
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  const partItem = (p: Part) => {
    const { state, remainingKm: km, remainingDays: d } = p.status;
    const tKey = state === 'overdue' ? (km != null && km <= 0 ? 'overdueKm' : 'overdueDays') : km != null && d != null ? 'both' : km != null ? 'km' : 'days';
    return (
      <Item
        key={p.serviceType.id}
        icon={icon(p.serviceType.icon)}
        tone={state === 'overdue' ? 'blush' : state === 'soon' ? 'amber' : 'mint'}
        title={i18n.language === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en}
        subtitle={t(`vehicles.status.${tKey}`, { km: n(Math.abs(km ?? 0)), d: n(Math.abs(d ?? 0)), u: unit })}
        onPress={() => router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: p.serviceType.id } })}
      />
    );
  };

  const attention = needsAttention(parts);
  const overview = attention.length ? attention : parts.slice(0, 3);
  const empty = <Text variant="body" className="text-muted">{t('vehicles.emptyParts')}</Text>;

  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerClassName="pb-[120px]">
      <View className="gap-4 rounded-b-[28px] bg-panel px-6 pb-6" style={{ paddingTop: insets.top + 8 }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={router.back}
          className="h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF26]">
          <Back size={22} color={c.onpanel} />
        </PressableScale>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Text variant="title" className="text-onpanel">{vehicleName(vehicle)}</Text>
            <Text variant="caption" className="text-onpanel" style={{ opacity: 0.6 }}>
              {vehicle.year} · {t(`vehicles.type.${vehicle.vehicle_type}`)}
            </Text>
          </View>
          <Image source={vehicleArt(vehicle.vehicle_type)} contentFit="contain" style={{ width: 128, height: 64 }} />
        </View>
        <View className="flex-row gap-3">
          <Metric
            className="flex-1"
            size="small"
            tone="glass"
            label={t('vehicles.odometer', { unit })}
            value={n(vehicle.current_odometer)}
          />
          <PressableScale accessibilityRole="button" onPress={() => router.push('/account/expenses')} className="flex-1">
            <Metric size="small" label={t('vehicles.yearExpenses')} value={n(spent)} caption={currency} />
          </PressableScale>
        </View>
      </View>

      <View className="gap-3 px-6 pt-6">
        <Choice
          className="bg-line"
          value={seg}
          onChange={setSeg}
          options={(['overview', 'log', 'reminders'] as const).map((v) => ({ value: v, label: t(`vehicles.seg.${v}`) }))}
        />
        {seg === 'overview' ? (
          <>
            <Text variant="heading">{t(attention.length ? 'vehicles.attention' : 'vehicles.yourParts')}</Text>
            {overview.length ? overview.map((p, i) => <Rise key={p.serviceType.id} index={i}>{partItem(p)}</Rise>) : empty}
            <FuelCard vehicleId={vehicle.id} hint />
          </>
        ) : seg === 'log' ? (
          logs?.length ? (
            logs.slice(0, 10).map((l, i) => (
              <Rise key={l.id} index={i}>
              <Item
                icon={icon(l.service_types?.icon)}
                title={l.title}
                subtitle={`${l.odometer_reading != null ? `${n(l.odometer_reading)} ${unit}` : '—'}${l.cost != null ? ` · ${n(l.cost)} ${currency}` : ''}`}
                onPress={() => router.push({ pathname: '/log/[id]', params: { id: l.id } })}
              />
              </Rise>
            ))
          ) : (
            <Text variant="body" className="text-muted">{t('vehicles.emptyLog')}</Text>
          )
        ) : parts.length ? (
          parts.map((p, i) => <Rise key={p.serviceType.id} index={i}>{partItem(p)}</Rise>)
        ) : (
          empty
        )}
        <View className="flex-row justify-between pt-2">
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/history', params: { vehicleId: vehicle.id, filter: tyres?.id } })}>
            <Text variant="label" className="text-teal">{t('vehicles.tireHistory')}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/history', params: { vehicleId: vehicle.id } })}>
            <Text variant="label" className="text-teal">{t('vehicles.allRecords')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
