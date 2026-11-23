import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { has360 } from '@/lib/car360';
import { registerCar, useFlight, type Slot } from '@/lib/carFlight';
import type { Vehicle } from '@/lib/queries';
import { vehicleArt } from '@/lib/vehicleArt';

/**
 * The car's picture. When its body type has a 360-degree set it shows a small 360° badge that opens the spinning view,
 * and (without `onPress`) tapping the picture opens it too. `slot` lets the picture fly between pages (lib/carFlight).
 */
export function CarPhoto({ vehicle, width, height, slot, onPress }: { vehicle: Pick<Vehicle, 'id' | 'vehicle_type'>; width: number; height: number; slot?: Slot; onPress?: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<View>(null);
  const key = slot ? `${slot}:${vehicle.id}` : '';
  useEffect(() => (key ? registerCar(key, ref) : undefined), [key]);
  const hidden = useFlight((s) => !!key && !!s.flight?.hide.includes(key));
  const open360 = () => router.push({ pathname: '/car-360', params: { vehicleId: vehicle.id } });
  const art = (
    <View ref={ref} collapsable={false}>
      <Image source={vehicleArt(vehicle.vehicle_type)} contentFit="contain" style={{ width, height }} />
    </View>
  );
  const picture = onPress || has360(vehicle.vehicle_type) ? (
    <Pressable accessibilityRole="button" accessibilityLabel={onPress ? undefined : t('car360.open')} onPress={onPress ?? open360}>{art}</Pressable>
  ) : art;
  return (
    <View style={{ opacity: hidden ? 0 : 1 }}>
      {picture}
      {has360(vehicle.vehicle_type) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('car360.open')}
          onPress={open360}
          hitSlop={8}
          className="absolute bottom-0 end-0 rounded-full bg-lime px-2.5 py-0.5">
          <Text variant="caption" className="text-[#222E29]" style={{ fontFamily: 'Poppins_700Bold' }}>360°</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
