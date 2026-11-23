import { router } from 'expo-router';

import i18n from './i18n';
import { queryClient } from './queryClient';
import type { Vehicle } from './queries';
import { sheet } from './sheet';
import { useLogDraft } from '@/stores/logDraft';
import { useSettings } from '@/stores/settingsStore';

/** Q105: a car added without its first reading has `odometer_updated_at` null (current_odometer stays 0, so a real 0 is still possible). */
export const hasReading = (v: Pick<Vehicle, 'odometer_updated_at'>) => v.odometer_updated_at != null;

type CaptureParams = { vehicleId?: string; serviceTypeId?: string };

/** Runs `go` for the car, or first asks for its opening reading (Q105). */
function withReading(params: CaptureParams | undefined, go: (carId?: string) => void) {
  const cars = queryClient.getQueryData<Vehicle[]>(['vehicles']) ?? [];
  const id = params?.vehicleId ?? useSettings.getState().currentVehicleId;
  const car = cars.find((v) => v.id === id) ?? cars[0];
  if (!car || hasReading(car)) return go(car?.id);
  const t = i18n.t.bind(i18n);
  sheet(t('reading.prompt.title'), undefined, [
    { text: t('reading.prompt.add'), onPress: () => router.push({ pathname: '/update-odometer', params: { vehicleId: car.id } }) },
    { text: t('reading.prompt.later'), style: 'cancel' },
  ]);
}

/** Every way into a new record: the voice sheet, idle until tapped, with a type-instead link (straight to quick-add when a part is already chosen). */
export function openCapture(params?: CaptureParams) {
  withReading(params, (carId) => {
    if (params?.serviceTypeId) return router.push({ pathname: '/add-record', params });
    useLogDraft.getState().reset({ vehicleId: params?.vehicleId ?? carId ?? null });
    router.push('/capture/voice');
  });
}

/** The by-hand ladder (the fan's pencil): find a job, quick form, details, more jobs (flow 14). Fuel and other running costs stay on /capture. */
export function openManual(params?: CaptureParams) {
  withReading(params, () => router.push({ pathname: '/add-record', params }));
}
