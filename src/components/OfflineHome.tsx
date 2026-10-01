import { router } from 'expo-router';
import { Car } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Item, Text } from '@/components/ui';
import type { Vehicle } from '@/lib/queries';
import { shadows } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';

// Screen 47 — Home offline, PNG 47/الرئيسية/دون اتصال (Q45). Rendered from the persisted cache.
export function OfflineHome({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const write = () => {
    useLogDraft.getState().reset({ vehicleId: vehicle.id, source: 'manual' });
    router.push('/capture/manual');
  };
  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="gap-4 px-6" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 120 }}>
      <View className="gap-2 rounded-field bg-sky p-4">
        <Text variant="label">{t('feedback.offline.bannerTitle')}</Text>
        <Text variant="caption" className="text-muted">{t('feedback.offline.bannerBody')}</Text>
      </View>
      <Text variant="title">{t('feedback.offline.title')}</Text>
      <Item
        icon={Car}
        title={`${vehicle.make} ${vehicle.model}`}
        subtitle={t('feedback.offline.vehicleSub')}
        onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id } })}
      />
      <View className="gap-1 rounded-metric bg-panel p-5" style={{ boxShadow: shadows.soft }}>
        <Text variant="caption" className="text-onpanel">{t('feedback.offline.cardLabel')}</Text>
        <Text variant="number" className="text-onpanel" numberOfLines={1}>{vehicle.current_odometer.toLocaleString('en-US')}</Text>
        <Text variant="caption" className="text-onpanel">
          {t('feedback.offline.cardNote', { unit: t(`home.${vehicle.odometer_unit}`) })}
        </Text>
      </View>
      <Button title={t('feedback.offline.write')} onPress={write} />
      <Text variant="caption" className="text-muted">{t('feedback.offline.voice')}</Text>
    </ScrollView>
  );
}
