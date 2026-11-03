import { hasReading } from './reading';
import { useCurrentVehicle, useVehicleLogs } from './queries';

/** Q125: where the current car is on its first run: no reading yet, a reading but no records, or under way (`started`). Both flags are false until the records have loaded. */
export function useFirstRun() {
  const { vehicle } = useCurrentVehicle();
  const logs = useVehicleLogs(vehicle?.id).data;
  const reading = !!vehicle && hasReading(vehicle);
  return { vehicle, reading, empty: !!vehicle && logs != null && logs.length === 0, started: logs != null && logs.length > 0 };
}
