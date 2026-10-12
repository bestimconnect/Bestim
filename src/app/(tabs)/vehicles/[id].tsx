import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, CircleDot, ClipboardList, Gauge, List, Plus, Wrench, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { FuelCard } from '@/components/FuelCard';
import { PartArt } from '@/components/PartArt';
import { PartRow } from '@/components/PartStatus';
import { useRefresh } from '@/components/Refresh';
import { useLightStatusBar } from '@/components/Hero';
import { Button, Choice, Item, Metric, PressableScale, Rise, Text } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { needsAttention, useExpenses, useRecordCategories, useVehicle, useVehicleParts, vehicleName, type Part } from '@/lib/queries';
import { hasReading, openCapture } from '@/lib/reading';
import { useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';

// Screen 09 — Vehicle detail, Figma ar-light 09/تفاصيل السيارة (segments per decisions Q15, links Q16).
type Tab = 'overview' | 'log' | 'reminders';
const n = (x: number) => x.toLocaleString('en-US');

export default function VehicleDetail() {
  const refresh = useRefresh();
  const space = useTabBarSpace();
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
  if (!vehicle)
    return (
      <View className="flex-1 bg-paper px-6" style={{ paddingTop: insets.top + 8 }}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          {I18nManager.isRTL ? <ChevronRight size={22} color={c.ink} /> : <ChevronLeft size={22} color={c.ink} />}
        </PressableScale>
      </View>
    );

  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const currency = t('vehicles.currency');
  const year = new Date().getFullYear().toString();
  const spent = expenses.filter((e) => e.vehicle_id === vehicle.id && e.expense_date.startsWith(year)).reduce((s, e) => s + e.amount, 0);
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  const partItem = (p: Part) => (
    <PartRow
      key={p.serviceType.id}
      part={p}
      name={i18n.language === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en}
      unit={unit}
      onPress={() => router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: p.serviceType.id } })}
    />
  );

  const attention = needsAttention(parts);
  const overview = attention.length ? attention : parts.slice(0, 3);
  const empty = (Icon: LucideIcon, key: string) => (
    <View className="items-center gap-3 py-8">
      <Icon size={64} color={c.muted} />
      <Text variant="label" className="text-muted">{t(key)}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-paper">
    <ScrollView refreshControl={refresh} className="flex-1" contentContainerStyle={{ paddingBottom: space + 52 + 12 + 24 }}>
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
            value={hasReading(vehicle) ? n(vehicle.current_odometer) : '—'}
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
            {overview.length ? overview.map((p, i) => <Rise key={p.serviceType.id} index={i}>{partItem(p)}</Rise>) : empty(Wrench, 'vehicles.emptyParts')}
            <FuelCard vehicleId={vehicle.id} hint />
          </>
        ) : seg === 'log' ? (
          logs?.length ? (
            logs.slice(0, 10).map((l, i) => (
              <Rise key={l.id} index={i}>
              <Item
                leading={<PartArt nameEn={l.service_types?.name_en} size={28} />}
                title={l.title}
                subtitle={[format(parseISO(l.service_date), 'd MMM', { locale: i18n.language === 'ar' ? ar : enUS }), l.odometer_reading != null ? `${n(l.odometer_reading)} ${unit}` : ''].filter(Boolean).join(' · ')}
                aside={
                  l.cost != null ? (
                    <View className="flex-row items-baseline gap-1">
                      <Text variant="label">{n(l.cost)}</Text>
                      <Text variant="caption" className="text-muted">{currency}</Text>
                    </View>
                  ) : undefined
                }
                onPress={() => router.push({ pathname: '/log/[id]', params: { id: l.id } })}
              />
              </Rise>
            ))
          ) : (
            empty(ClipboardList, 'vehicles.emptyLog')
          )
        ) : parts.length ? (
          parts.map((p, i) => <Rise key={p.serviceType.id} index={i}>{partItem(p)}</Rise>)
        ) : (
          empty(Wrench, 'vehicles.emptyParts')
        )}
        <View className="flex-row gap-3 pt-2">
          {(
            [
              [CircleDot, 'vehicles.tireHistory', { vehicleId: vehicle.id, filter: tyres?.id }],
              [List, 'vehicles.allRecords', { vehicleId: vehicle.id }],
            ] as const
          ).map(([Icon, key, params]) => (
            <PressableScale
              key={key}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/history', params })}
              className="h-11 flex-row items-center gap-2 rounded-full border border-line bg-white px-4">
              <Icon size={18} color={c.teal} />
              <Text variant="caption">{t(key)}</Text>
            </PressableScale>
          ))}
        </View>
      </View>
    </ScrollView>
    {/* A solid footer down to the screen edge, so the list never shows through behind the buttons and the tab bar. */}
    <View className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t border-line bg-paper px-6 pt-3" style={{ paddingBottom: space }}>
      <Button className="flex-1 px-3" icon={<Plus size={20} color="#222E29" />} title={t('vehicles.addRecord')} onPress={() => openCapture({ vehicleId: vehicle.id })} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('vehicles.updateReading')}
        onPress={() => router.push({ pathname: '/update-odometer', params: { vehicleId: vehicle.id } })}
        className="h-[52px] w-[52px] items-center justify-center rounded-field border border-line bg-white">
        <Gauge size={24} color={c.ink} />
      </PressableScale>
    </View>
    </View>
  );
}
