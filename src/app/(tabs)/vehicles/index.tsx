import { router } from 'expo-router';
import { Bike, Cog, CarFront, Truck } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Item, Text } from '@/components/ui';
import { useVehicles } from '@/lib/queries';

// Screen 08 — My vehicles, Figma ar-light 08/سياراتي ومعداتي.
const icons = { car: CarFront, motorcycle: Bike, pickup: Truck, equipment: Cog } as const;

export default function VehiclesScreen() {
  const { t } = useTranslation();
  const { data: vehicles } = useVehicles();
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="gap-3 px-6 pb-[120px]">
        <Header title={t('vehicles.title')} back={false} />
        <Text variant="title" className="mb-2">{t('vehicles.heading')}</Text>
        {vehicles?.map((v) => (
          <Item
            key={v.id}
            icon={icons[v.vehicle_type as keyof typeof icons] ?? CarFront}
            tone={v.is_primary ? 'mint' : 'paper'}
            title={v.nickname || `${v.make} ${v.model}`}
            subtitle={`${v.make} ${v.year} · ${v.current_odometer.toLocaleString('en-US')} ${t(`vehicles.unit.${v.odometer_unit}`)}`}
            onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: v.id } })}
          />
        ))}
        <Button
          title={t('vehicles.add')}
          onPress={() => router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
