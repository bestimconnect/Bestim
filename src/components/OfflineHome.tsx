import { router } from 'expo-router';
import { Car } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { Num } from '@/components/home/Num';
import { Backdrop, Button, Card, Item, Text } from '@/components/ui';
import { hasReading, openCapture } from '@/lib/reading';
import { vehicleName, type Vehicle } from '@/lib/queries';

// Screen 47 — Home offline, PNG 47/الرئيسية/دون اتصال (Q45). Rendered from the persisted cache.
export function OfflineHome({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const write = () => {
    openCapture({ vehicleId: vehicle.id });
  };
  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="gap-6 px-6" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: space }}>
      <Backdrop />
      <Card tone="sky" className="gap-1 p-4">
        <Text variant="label">{t('feedback.offline.bannerTitle')}</Text>
        <Text variant="caption" className="text-muted">{t('feedback.offline.bannerBody')}</Text>
      </Card>
      <Text variant="title">{t('feedback.offline.title')}</Text>
      <Item
        icon={Car}
        title={vehicleName(vehicle)}
        subtitle={t('feedback.offline.vehicleSub')}
        onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
      />
      <Card className="gap-1 p-5">
        <Text variant="caption" className="text-muted">{t('feedback.offline.cardLabel')}</Text>
        <Num value={hasReading(vehicle) ? vehicle.current_odometer.toLocaleString('en-US') : '—'} unit={t(`home.${vehicle.odometer_unit}`)} size={40} />
        <Text variant="caption" className="text-muted">{t('feedback.offline.cardNote', { unit: t(`home.${vehicle.odometer_unit}`) })}</Text>
      </Card>
      <Button title={t('feedback.offline.write')} onPress={write} />
      <Text variant="caption" className="px-1 text-center text-muted">{t('feedback.offline.voice')}</Text>
    </ScrollView>
  );
}
