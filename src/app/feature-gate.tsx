import { router, useLocalSearchParams } from 'expo-router';
import { Car, Lock } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Item, Text } from '@/components/ui';
import { useVehicle, vehicleName } from '@/lib/queries';
import { useColors } from '@/lib/theme';

// Screen 37 — Feature gate for guests (decisions Q17); ar-light 37/ميزة تتطلب حساباً.png
export default function FeatureGateScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const { feature, vehicleId } = useLocalSearchParams<{ feature?: string; vehicleId?: string }>();
  const { vehicle } = useVehicle(vehicleId);
  const car = feature === 'car' && vehicle;
  const title = car ? vehicle.model : t(`gate.title.${feature ?? 'account'}`);

  return (
    <SafeAreaView className="flex-1 rounded-t-screen border-t border-line bg-sheet" edges={['top', 'bottom']}>
      <View className="flex-1 gap-4 p-6">
        <Header title={title} />
        {car ? <Item icon={Car} title={vehicleName(vehicle)} subtitle={String(vehicle.year)} chevron={false} disabled /> : null}
        <View className="flex-1 justify-center gap-5">
          <View className="h-[70px] w-[70px] items-center justify-center self-center rounded-full bg-mint">
            <Lock size={30} color={c.teal} />
          </View>
          <Text variant="title">{t('gate.heading')}</Text>
          <Text variant="body" className="text-muted">{t('gate.body')}</Text>
        </View>
        <View className="gap-3">
          <Button title={t('gate.create')} onPress={() => router.replace('/register')} />
          <Button title={t('gate.keep')} variant="secondary" onPress={router.back} />
          <Pressable accessibilityRole="button" onPress={() => router.replace('/delete-account')} className="self-center py-1">
            <Text variant="caption" className="text-muted">{t('gate.deleteGuest')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
