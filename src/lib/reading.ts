import { router } from 'expo-router';

import i18n from './i18n';
import { queryClient } from './queryClient';
import type { Vehicle } from './queries';
import { sheet } from './sheet';
import { useSettings } from '@/stores/settingsStore';

/** Q105: a car added without its first reading has `odometer_updated_at` null (current_odometer stays 0, so a real 0 is still possible). */
export const hasReading = (v: Pick<Vehicle, 'odometer_updated_at'>) => v.odometer_updated_at != null;

/** Every way into the quick-add sheet for a new record: a car without a reading gets a prompt instead (Q105). */
export function openCapture(params?: { vehicleId?: string; serviceTypeId?: string }) {
  const cars = queryClient.getQueryData<Vehicle[]>(['vehicles']) ?? [];
  const id = params?.vehicleId ?? useSettings.getState().currentVehicleId;
  const car = cars.find((v) => v.id === id) ?? cars[0];
  if (!car || hasReading(car)) return router.push({ pathname: '/capture', params });
  const t = i18n.t.bind(i18n);
  sheet(t('reading.prompt.title'), undefined, [
    { text: t('reading.prompt.add'), onPress: () => router.push({ pathname: '/update-odometer', params: { vehicleId: car.id } }) },
    { text: t('reading.prompt.later'), style: 'cancel' },
  ]);
}
