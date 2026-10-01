import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PartMetric } from '@/components/PartMetric';

import { Button, Header, Text } from '@/components/ui';
import { useServiceTypes, useVehicle, useVehicleParts } from '@/lib/queries';

// Screen 11 — Part detail, Figma ar-light 11/تفاصيل قطعة/الزيت.
const n = (x: number) => x.toLocaleString('en-US');

export default function PartScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ vehicleId: string; serviceTypeId: string }>();
  const { vehicle } = useVehicle(params.vehicleId);
  const { data: logs, parts } = useVehicleParts(vehicle);
  const st = useServiceTypes().data?.find((s) => s.id === params.serviceTypeId);
  if (!vehicle || !st) return <View className="flex-1 bg-paper" />;

  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const mine = (logs ?? []).filter((l) => l.service_type_id === st.id); // newest first
  const last = mine[0];
  const status = parts.find((p) => p.serviceType.id === st.id)?.status;
  const km = last?.interval_km ?? st.default_interval_km;
  const months = last?.interval_months ?? st.default_interval_months;
  const brand = (last?.parts_replaced as { name?: string }[] | null)?.[0]?.name || '—';
  const spent = mine.reduce((s, l) => s + (l.cost ?? 0), 0);

  const over = status?.state === 'overdue';

  const rows: [string, string][] = [
    [t('parts.brand'), brand],
    [t('parts.installDate'), last ? format(new Date(last.service_date), 'd MMMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS }) : '—'],
    [t('parts.odoThen'), last?.odometer_reading != null ? `${n(last.odometer_reading)} ${unit}` : '—'],
    [t('parts.interval'), [km != null ? `${n(km)} ${unit}` : '', months != null ? t('parts.months', { m: months }) : ''].filter(Boolean).join(' / ') || '—'],
    [t('parts.totalSpent'), `${n(spent)} ${t('vehicles.currency')}`],
  ];

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 gap-4 px-6">
        <Header title={i18n.language === 'ar' ? st.name_ar : st.name_en} />
        {status ? (
          <PartMetric status={status} unit={unit} label={t(over ? 'parts.overdueLabel' : 'parts.untilChange')} />
        ) : null}
        <Text variant="heading">{t('parts.inUse')}</Text>
        {rows.map(([label, v]) => (
          <View key={label} className="min-h-10 flex-row items-center justify-between gap-3">
            <Text variant="body" className="text-muted">{label}</Text>
            <Text variant="label" className="shrink text-end">{v}</Text>
          </View>
        ))}
      </View>
      <View className="px-6 pb-4">
        <Button
          title={t('parts.viewHistory')}
          onPress={() => router.push({ pathname: '/part-history', params: params })}
        />
      </View>
    </SafeAreaView>
  );
}
