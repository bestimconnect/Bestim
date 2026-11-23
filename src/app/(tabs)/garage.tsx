import { router } from 'expo-router';
import { Car, Plus } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { CarPhoto } from '@/components/CarPhoto';
import { PlateView } from '@/components/Plate';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Ring } from '@/components/Ring';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import { Backdrop, Button, Card, Rise, Text } from '@/components/ui';
import { TabHeader } from '@/components/TabHeader';
import { openDetails, registerCar } from '@/lib/carFlight';
import { carHealth, STATE_COLOR } from '@/lib/health';
import { blockLimit, useEntitlements } from '@/lib/entitlements';
import { useVehicleParts, useVehicles, vehicleName, type Vehicle } from '@/lib/queries';
import { useColors } from '@/lib/theme';
import { hasReading } from '@/lib/reading';

// Screen 08 — My vehicles, Figma ar-light 08/سياراتي ومعداتي.

function CarCard({ vehicle: v }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const c = useColors();
  const { parts } = useVehicleParts(v);
  const health = carHealth(parts);
  const color = health.score == null ? c.line : health.late ? STATE_COLOR.overdue : health.soon ? STATE_COLOR.soon : STATE_COLOR.ok;
  const unit = t(`vehicles.unit.${v.odometer_unit}`);
  const box = useRef<View>(null); // the card the car page grows out of
  useEffect(() => registerCar(`card:${v.id}`, box), [v.id]);
  return (
    <View ref={box} collapsable={false}>
    <Card flat onPress={() => openDetails(v, 'list')} className="flex-row items-center gap-3 p-4">
      <View className="min-w-0 flex-1 gap-3">
        <View className="gap-0.5">
          <Text variant="heading" numberOfLines={2}>{vehicleName(v)}</Text>
          <Text variant="caption" className="text-muted" numberOfLines={1}>
            {v.year}{hasReading(v) ? ` · ${v.current_odometer.toLocaleString('en-US')} ${unit}` : ''}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          {health.score != null ? <Ring value={health.score / 100} color={color} size={44} label={String(health.score)} /> : null}
          <PlateView plate={v.plate_number} size="sm" />
        </View>
      </View>
      <CarPhoto vehicle={v} width={136} height={76} slot="list" onPress={() => openDetails(v, 'list')} />
    </Card>
    </View>
  );
}

export default function VehiclesScreen() {
  const c = useColors();
  const refresh = useRefresh();
  const space = useTabBarSpace();
  const { t } = useTranslation();
  const { data: vehicles, isError, refetch, isRefetching } = useVehicles();
  const ent = useEntitlements().data;
  const onShowSaved = useShowSavedAction();
  if (isError && !vehicles) return <ErrorState onRetry={refetch} retrying={isRefetching} onShowSaved={onShowSaved} />;
  const add = () => !blockLimit(ent, 'max_cars', vehicles?.length ?? 0) && router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } });
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Backdrop />
      <ScrollView refreshControl={refresh} contentContainerClassName="gap-6 px-6" contentContainerStyle={{ paddingBottom: space }}>
        <TabHeader title={t('vehicles.title')} back />
        {!vehicles ? (
          <LoadingState />
        ) : vehicles.length === 0 ? (
          <EmptyState icon={Car} title={t('vehicles.emptyTitle')} body={t('vehicles.emptyBody')} action={t('vehicles.add')} onAction={add} />
        ) : (
          <>
            <View>
              <Text variant="caption" className="pb-3 text-muted">
                {t('vehicles.summary', { count: vehicles.length, km: vehicles.reduce((s, v) => s + (v.current_odometer ?? 0), 0).toLocaleString('en-US') })}
              </Text>
              <View className="gap-3">
                {vehicles.map((v, i) => (
                  <Rise key={v.id} index={i}>
                    <CarCard vehicle={v} />
                  </Rise>
                ))}
              </View>
            </View>
            <Button title={t('vehicles.add')} variant="secondary" icon={<Plus size={20} color={c.ink} />} onPress={add} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
