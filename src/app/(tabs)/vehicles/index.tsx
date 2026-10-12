import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Button, Header, Item, Rise, Text } from '@/components/ui';
import { useVehicles, vehicleName } from '@/lib/queries';
import { hasReading } from '@/lib/reading';
import { vehicleArt } from '@/lib/vehicleArt';

// Screen 08 — My vehicles, Figma ar-light 08/سياراتي ومعداتي.

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
        <Header title={t('vehicles.title')} back={false} />
        <Text variant="title" className="mb-2">{t('vehicles.heading')}</Text>
        {vehicles?.map((v, i) => (
          <Rise key={v.id} index={i}>
          <Item
            image={vehicleArt(v.vehicle_type)}
            tone={v.is_primary ? 'mint' : 'paper'}
            title={vehicleName(v)}
            subtitle={hasReading(v) ? `${v.make} ${v.year} · ${v.current_odometer.toLocaleString('en-US')} ${t(`vehicles.unit.${v.odometer_unit}`)}` : `${v.make} ${v.year}`}
            onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: v.id } })}
          />
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
