import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as Notifications from 'expo-notifications';

import i18n from './i18n';
import { latestPerType, partStatus, type Unit } from './parts';
import { DEFAULT_PREFS, planNotifications, type PlanPart, type PlanVehicle, type Prefs } from './reminderPlan.ts';
import { supabase } from './supabase';

// On-device reminders (decisions Q37–Q39). What to schedule is decided by the pure planner in
// reminderPlan.ts; this file loads the data, asks the OS, and schedules. Server push comes in Phase 6.

const SENT_KEY = 'notifySent';
const MAX_PENDING = 60; // iOS keeps 64 pending notifications

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function notificationsAllowed() {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Q39: show screen 45 once, after a saved log, to full accounts the OS hasn't asked yet. */
export async function shouldAskNotifications() {
  const { useSettings } = await import('@/stores/settingsStore');
  const { data } = await supabase.auth.getSession();
  if (useSettings.getState().notifyAsked || !data.session || data.session.user.is_anonymous) return false;
  return (await Notifications.getPermissionsAsync()).status === 'undetermined';
}

/** Ask the OS (screen 45 / the banner on 28). Returns whether notifications are allowed now. */
export async function requestNotifications() {
  const granted = (await Notifications.requestPermissionsAsync()).granted;
  if (granted) await syncNotifications();
  return granted;
}

/** Cancel everything and reschedule from the current data. Safe to call often; never throws. */
export async function syncNotifications() {
  try {
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!user || user.is_anonymous || !(await notificationsAllowed())) return;

    const today = new Date().toLocaleDateString('en-CA');
    const [profile, vehicles, logs, snoozes] = await Promise.all([
      supabase.from('profiles').select('notification_prefs').eq('id', user.id).single(),
      supabase.from('vehicles').select('*'),
      supabase.from('maintenance_logs').select('*, service_types(*)').order('service_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('reminders').select('vehicle_id, service_type_id, due_date').eq('status', 'dismissed').gt('due_date', today),
    ]);
    if (profile.error || vehicles.error || logs.error || snoozes.error) return;

    const prefs = { ...DEFAULT_PREFS, ...(profile.data.notification_prefs as Partial<Prefs> | null) };
    const arabic = i18n.language === 'ar';
    const nameOf = (v: (typeof vehicles.data)[number]) => v.nickname || `${v.make} ${v.model}`;

    const parts: PlanPart[] = [];
    const planVehicles: PlanVehicle[] = [];
    for (const v of vehicles.data) {
      const mine = latestPerType(logs.data.filter((l) => l.vehicle_id === v.id));
      for (const log of mine) {
        const st = log.service_types;
        if (!st) continue;
        const status = partStatus({
          odometer: v.current_odometer,
          unit: v.odometer_unit as Unit,
          lastReading: log.odometer_reading,
          lastDate: log.service_date,
          intervalKm: log.interval_km ?? st.default_interval_km,
          intervalMonths: log.interval_months ?? st.default_interval_months,
        });
        if (!status) continue;
        parts.push({
          vehicleId: v.id,
          serviceTypeId: st.id,
          name: arabic ? st.name_ar : st.name_en,
          vehicleName: nameOf(v),
          unit: v.odometer_unit as Unit,
          status,
          snoozedUntil: snoozes.data.find((s) => s.vehicle_id === v.id && s.service_type_id === st.id)?.due_date ?? null,
        });
      }
      // Q23: only nudge for the odometer when the vehicle has parts that depend on it.
      if (parts.some((p) => p.vehicleId === v.id)) planVehicles.push({ id: v.id, name: nameOf(v), odometerUpdatedAt: v.odometer_updated_at });
    }

    const sent = JSON.parse((await AsyncStorage.getItem(SENT_KEY)) ?? '{}');
    const plan = planNotifications(parts, planVehicles, prefs, sent);
    await AsyncStorage.setItem(SENT_KEY, JSON.stringify(plan.sent));

    const t = i18n.t.bind(i18n);
    const dated = plan.planned.filter((p) => p.kind !== 'weekly').sort((a, b) => +a.at - +b.at).slice(0, MAX_PENDING);
    for (const p of dated) {
      const trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at } as const;
      if (p.kind === 'odometer') {
        const n = differenceInCalendarDays(p.at, parseISO(p.vehicle.odometerUpdatedAt));
        await Notifications.scheduleNotificationAsync({
          identifier: p.key,
          content: { title: t('notify.odometerTitle'), body: t('notify.odometerBody', { vehicle: p.vehicle.name, n }), data: { url: '/update-odometer' } },
          trigger,
        });
        continue;
      }
      const { status, name, unit, vehicleId, serviceTypeId } = p.part;
      const body =
        p.kind === 'overdue'
          ? t('notify.overdueBody')
          : status.dueDate
            ? t('notify.soonDate', { date: format(parseISO(status.dueDate), 'd MMMM', { locale: arabic ? ar : enUS }) })
            : t('notify.soonKm', { km: Math.max(status.remainingKm ?? 0, 0).toLocaleString('en-US'), unit: t(`home.${unit}`) });
      await Notifications.scheduleNotificationAsync({
        identifier: p.key,
        content: {
          title: t(p.kind === 'overdue' ? 'notify.overdueTitle' : 'notify.soonTitle', { part: name }),
          body,
          data: { url: `/reminder?vehicleId=${vehicleId}&serviceTypeId=${serviceTypeId}` },
        },
        trigger,
      });
    }

    const weekly = plan.planned.find((p) => p.kind === 'weekly');
    if (weekly)
      await Notifications.scheduleNotificationAsync({
        identifier: 'weekly',
        content: { title: t('notify.weeklyTitle'), body: t('notify.weeklyBody'), data: { url: '/' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 6, hour: weekly.hour, minute: 0 }, // 6 = Friday
      });
  } catch (e) {
    // A reminder that fails to schedule must never break the app; the next sync retries.
    if (__DEV__) console.warn('syncNotifications', e);
  }
}
