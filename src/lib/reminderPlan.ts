import { addDays } from 'date-fns';

import { SOON_DISTANCE, type PartStatus, type Unit } from './parts.ts';

// Which on-device notifications to schedule (screen 28). Pure, so `npm run check` covers it; the RN side
// (src/lib/notifications.ts) only translates and schedules what this returns.
//
// Rule from the design: "we alert when the state changes, no daily repeat for the same reminder".
// `sent` remembers one alert per part + state (key → ISO fire time) so re-syncing never re-fires it.
// ponytail: distance-based due dates can only be detected when the app is open (the phone can't know the
// odometer). Server push (Phase 6) removes that limit.

export type Prefs = { due_soon: boolean; overdue: boolean; odometer: boolean; weekly: boolean; quiet_from: number | null; quiet_to: number | null };
export const DEFAULT_PREFS: Prefs = { due_soon: true, overdue: true, odometer: true, weekly: false, quiet_from: 22, quiet_to: 8 };
export const ODOMETER_NUDGE_DAYS = 14;
export const NOTIFY_BEFORE_DAYS = 3;

export type PlanPart = { vehicleId: string; serviceTypeId: string; name: string; vehicleName: string; unit: Unit; status: PartStatus; snoozedUntil: string | null };
export type PlanVehicle = { id: string; name: string; odometerUpdatedAt: string };

export type Planned =
  | { key: string; kind: 'soon' | 'overdue'; at: Date; part: PlanPart }
  | { key: string; kind: 'odometer'; at: Date; vehicle: PlanVehicle }
  | { key: 'weekly'; kind: 'weekly'; hour: number; attention: number };

/** 9:00, or the end of quiet hours when 9:00 is inside them. Null (or equal) hours mean quiet hours are off (Q38). */
export function alertHour(p: Prefs) {
  const { quiet_from: from, quiet_to: to } = p;
  if (from == null || to == null || from === to) return 9; // quiet hours off (Q38)
  const quiet = (h: number) => (from > to ? h >= from || h < to : h >= from && h < to);
  return quiet(9) ? to : 9;
}

const atHour = (d: Date, hour: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0);
const nextAt = (now: Date, hour: number) => (atHour(now, hour) > now ? atHour(now, hour) : atHour(addDays(now, 1), hour));

export function planNotifications(parts: PlanPart[], vehicles: PlanVehicle[], prefs: Prefs, sent: Record<string, string>, now = new Date()) {
  const hour = alertHour(prefs);
  const planned: Planned[] = [];
  const nextSent: Record<string, string> = {};

  // One alert per key: reuse a pending time, skip a delivered one, otherwise use `fresh`.
  const once = (key: string, fresh: Date): Date | null => {
    const at = sent[key] ? new Date(sent[key]) : fresh;
    nextSent[key] = at.toISOString();
    return at > now ? at : null;
  };

  for (const part of parts) {
    if (part.snoozedUntil) continue;
    const { dueDate, dueOdometer, remainingKm } = part.status;
    const base = `${part.vehicleId}:${part.serviceTypeId}`;
    const add = (kind: 'soon' | 'overdue', key: string, at: Date | null) => {
      if (at && (kind === 'soon' ? prefs.due_soon : prefs.overdue)) planned.push({ key, kind, at, part });
    };

    // Calendar: fully predictable, so always derived from the due date (decisions Q37).
    if (dueDate) {
      const due = atHour(new Date(`${dueDate}T00:00:00`), hour);
      const soon = addDays(due, -NOTIFY_BEFORE_DAYS);
      const late = addDays(due, 1);
      add('soon', `${base}:${dueDate}:soon`, soon > now ? soon : null);
      add('overdue', `${base}:${dueDate}:overdue`, late > now ? late : null);
    }
    // Distance: only known when the app is open, so alert the next morning, once per due reading.
    if (remainingKm != null) {
      if (remainingKm <= 0) add('overdue', `${base}:${dueOdometer}:overdue`, once(`${base}:${dueOdometer}:overdue`, nextAt(now, hour)));
      else if (remainingKm <= SOON_DISTANCE[part.unit]) add('soon', `${base}:${dueOdometer}:soon`, once(`${base}:${dueOdometer}:soon`, nextAt(now, hour)));
    }
  }

  if (prefs.odometer)
    for (const vehicle of vehicles) {
      const key = `odo:${vehicle.id}:${vehicle.odometerUpdatedAt}`;
      const at = once(key, atHour(addDays(new Date(vehicle.odometerUpdatedAt), ODOMETER_NUDGE_DAYS), hour));
      if (at) planned.push({ key, kind: 'odometer', at, vehicle });
    }

  if (prefs.weekly)
    planned.push({ key: 'weekly', kind: 'weekly', hour, attention: parts.filter((p) => p.status.state !== 'ok' && !p.snoozedUntil).length });

  return { planned, sent: nextSent };
}
