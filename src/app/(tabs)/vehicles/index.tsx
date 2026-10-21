import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { CarPhoto } from '@/components/CarPhoto';
import { PlateView } from '@/components/Plate';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Ring } from '@/components/Ring';
import { Button, Header, PressableScale, Rise, Text } from '@/components/ui';
import { openDetails } from '@/lib/carFlight';
import { carHealth, STATE_COLOR } from '@/lib/health';
import { useVehicleParts, useVehicles, vehicleName, type Vehicle } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';
import { hasReading } from '@/lib/reading';

// Screen 08 — My vehicles, Figma ar-light 08/سياراتي ومعداتي.

function CarCard({ vehicle: v }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const c = useColors();
  const { parts } = useVehicleParts(v);
  const health = carHealth(parts);
  const color = health.score == null ? c.line : health.late ? STATE_COLOR.overdue : health.soon ? STATE_COLOR.soon : STATE_COLOR.ok;
  const unit = t(`vehicles.unit.${v.odometer_unit}`);
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={() => openDetails(v, 'list')}
      className="gap-3 rounded-item bg-white p-4"
      style={{ boxShadow: shadows.soft }}>
      <View className="flex-row items-center gap-3">
        <CarPhoto vehicle={v} width={96} height={56} slot="list" onPress={() => openDetails(v, 'list')} />
        <View className="flex-1 gap-1">
          <Text variant="label" numberOfLines={1}>{vehicleName(v)}</Text>
          <Text variant="caption" className="text-muted" numberOfLines={1}>
            {v.year}{hasReading(v) ? ` · ${v.current_odometer.toLocaleString('en-US')} ${unit}` : ''}
          </Text>
          <PlateView plate={v.plate_number} size="sm" />
        </View>
        {health.score != null ? <Ring value={health.score / 100} color={color} size={52} label={String(health.score)} /> : null}
      </View>
    </PressableScale>
  );
}

export default function VehiclesScreen() {
  const refresh = useRefresh();
  const space = useTabBarSpace();
  const { t } = useTranslation();
  const { data: vehicles, isError, refetch, isRefetching } = useVehicles();
  const onShowSaved = useShowSavedAction();
  if (isError && !vehicles) return <ErrorState onRetry={refetch} retrying={isRefetching} onShowSaved={onShowSaved} />;
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView refreshControl={refresh} contentContainerClassName="gap-3 px-6" contentContainerStyle={{ paddingBottom: space }}>
        <Header
          title={t('vehicles.title')}
          back={false}
          sub={t('vehicles.summary', { count: vehicles?.length ?? 0, km: (vehicles ?? []).reduce((s, v) => s + (v.current_odometer ?? 0), 0).toLocaleString('en-US') })}
        />
        <Text variant="title" className="mb-2">{t('vehicles.heading')}</Text>
        {vehicles?.map((v, i) => (
          <Rise key={v.id} index={i}>
            <CarCard vehicle={v} />
          </Rise>
        ))}
        <Button
          title={t('vehicles.add')}
          onPress={() => router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
