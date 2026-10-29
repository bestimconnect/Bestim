import { format } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';

import { carHealth } from './health';
import { latestPerType, partStatus, SOON_DISTANCE, type Unit } from './parts';
import type { Expense, Log, Part, Vehicle } from './queries';

// The small JSON that the home-screen widgets read (iOS: expo-widgets props; Android: a file the widget task reads).
// Widgets never hold a login: the app builds this from its own query data and pushes it (src/widgets/sync.ts) on every
// data change, on foreground and after every save. What a widget may do by itself (raise the km, mark a service
// done, snooze) goes through `api` with a limited widget key (supabase/migrations/20261023120000_widget_keys.sql).
// All text is already in the app language. Distances stay numbers so a widget can update "km left" after a km change.
// Pure (no RN imports).

export type WidgetLang = 'ar' | 'en';
export type WidgetPart = {
  id: string; // service type id
  name: string;
  state: 'ok' | 'soon' | 'overdue';
  kmLeft: number | null; // negative = overdue by that much
  daysLeft: number | null;
  by: 'km' | 'days'; // which of the two is closer to due (the one the label shows)
  art: string; // English service name (partArt key), resolved to a file by sync.ts
  remote: string | null; // catalog picture path for this state, when the catalog has one
  img: string | null; // file:// path in the shared widget folder (filled by sync.ts)
};
export type WidgetSpend = { label: string; total: string; currency: string; fuel: number; maintenance: number; other: number }; // shares 0..1
export type WidgetCar = {
  id: string;
  name: string;
  type: string; // vehicle_type, resolved to a car picture by sync.ts
  img: string | null; // file:// path (filled by sync.ts)
  km: number;
  unit: string; // "km" / "كم"
  ageLabel: string; // "تأكيد منذ 3 أيام"
  health: number | null;
  parts: WidgetPart[]; // up to 5, most urgent first, snoozed ones left out
  spend: WidgetSpend;
};
export type WidgetApi = { url: string; anon: string; key: string };
export type WidgetSnapshot = {
  v: 2;
  updated: number;
  lang: WidgetLang;
  cars: WidgetCar[]; // empty = nothing to show (signed out or no car yet)
  sel: number; // which car the widgets show; the owner flips it on the widget
  api: WidgetApi | null; // null until the app has a widget key
  soonKm: number; // a part is "soon" at or below this many km left (parts.ts)
  s: Record<keyof typeof STRINGS.en, string>; // labels
};

// Own dictionary (widgets run outside i18next; the locale files are shared with the app).
const STRINGS = {
  ar: { next: 'الصيانة القادمة', health: 'صحة السيارة', odometer: 'عداد', edit: 'تعديل', voice: 'سجّل بصوتك', scan: 'صوّر العداد', fuel: 'بنزين', expense: 'مصروف', quick: 'اختصارات سريعة', fuelOther: 'بنزين', maint: 'صيانة', other: 'أخرى', allOk: 'كل شيء على ما يرام', open: 'افتح بستيم', done: 'تمّت', snooze: 'بعد أسبوع', save: 'حفظ', saving: 'جارٍ الحفظ…', saved: 'تم الحفظ ✓', retry: 'أعد المحاولة', offline: 'تعذّر الاتصال', late: 'متأخر', left: 'باقي', days: 'يوم', km: 'كم', mi: 'ميل' },
  en: { next: 'Next service', health: 'Car health', odometer: 'Odometer', edit: 'Edit', voice: 'Log by voice', scan: 'Scan odometer', fuel: 'Fuel', expense: 'Expense', quick: 'Quick actions', fuelOther: 'Fuel', maint: 'Service', other: 'Other', allOk: 'All on schedule', open: 'Open Bestim', done: 'Done', snooze: 'Snooze 1 week', save: 'Save', saving: 'Saving…', saved: 'Saved ✓', retry: 'Retry', offline: 'No connection', late: 'late', left: 'left', days: 'd', km: 'km', mi: 'mi' },
} as const;

const n = (x: number) => Math.round(x).toLocaleString('en-US');
const CURRENCY = { EGP: { ar: 'جنيه مصري', en: 'EGP' } } as const;

const ago = (lang: WidgetLang, days: number) =>
  lang === 'ar' ? (days < 1 ? 'تأكيد اليوم' : days === 1 ? 'تأكيد أمس' : `تأكيد منذ ${n(days)} يوم`) : days < 1 ? 'Confirmed today' : `Confirmed ${days}d ago`;

export type CarInput = {
  vehicle: Vehicle;
  name: string; // vehicleName(vehicle) in the app language
  logs: Log[];
  snoozes: Record<string, string | null>;
  expenses: Expense[]; // all of the owner's; filtered here
};

export function buildCar(i: CarInput, lang: WidgetLang, now: Date): WidgetCar {
  const v = i.vehicle;
  const unit = v.odometer_unit as Unit;
  const parts: Part[] = [];
  for (const log of latestPerType(i.logs)) {
    const st = log.service_types;
    if (!st?.has_reminder) continue;
    const status = partStatus({
      odometer: v.current_odometer,
      unit,
      lastReading: log.odometer_reading,
      lastDate: log.service_date,
      intervalKm: log.interval_km ?? st.default_interval_km,
      intervalMonths: log.interval_months ?? st.default_interval_months,
      today: now,
    });
    if (status) parts.push({ serviceType: st, log, status, snoozedUntil: i.snoozes[st.id] ?? null });
  }
  parts.sort((a, b) => a.status.urgency - b.status.urgency);
  const h = carHealth(parts);

  const top = parts
    .filter((p) => !p.snoozedUntil)
    .slice(0, 5)
    .map((p): WidgetPart => {
      const st = p.status;
      const interval = p.log.interval_km ?? p.serviceType.default_interval_km;
      const kmFraction = st.remainingKm != null && interval ? st.remainingKm / interval : Infinity;
      const art = p.serviceType as { image_ok?: string | null; image_soon?: string | null; image_late?: string | null }; // catalog columns (migration 20261022100000), not in the generated types yet
      const remote = (st.state === 'overdue' ? art.image_late : st.state === 'soon' ? art.image_soon : art.image_ok) ?? null;
      return {
        id: p.serviceType.id,
        name: lang === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en,
        state: st.state,
        kmLeft: st.remainingKm,
        daysLeft: st.remainingDays,
        by: st.remainingKm != null && kmFraction <= st.urgency ? 'km' : 'days', // same division as partStatus
        art: p.serviceType.name_en,
        remote,
        img: null,
      };
    });

  const month = format(now, 'yyyy-MM');
  const mine = i.expenses.filter((e) => e.vehicle_id === v.id && e.expense_date.startsWith(month));
  const sum = (f: (e: Expense) => boolean) => mine.filter(f).reduce((t, e) => t + Number(e.amount), 0);
  const total = sum(() => true);
  const fuel = sum((e) => e.category === 'fuel');
  const maintenance = sum((e) => e.category === 'maintenance');
  const code = mine[0]?.currency ?? 'EGP';
  const days = v.odometer_updated_at ? Math.floor((+now - +new Date(v.odometer_updated_at)) / 86_400_000) : 0;
  const s = STRINGS[lang];

  return {
    id: v.id,
    name: i.name,
    type: v.vehicle_type,
    img: null,
    km: v.current_odometer,
    unit: unit === 'mi' ? s.mi : s.km,
    ageLabel: ago(lang, days),
    health: h.score,
    parts: top,
    spend: {
      label: lang === 'ar' ? `مصاريف ${format(now, 'LLLL', { locale: arLocale })}` : `${format(now, 'LLLL', { locale: enUS })} spend`,
      total: n(total),
      currency: CURRENCY[code as keyof typeof CURRENCY]?.[lang] ?? code,
      fuel: total ? fuel / total : 0,
      maintenance: total ? maintenance / total : 0,
      other: total ? (total - fuel - maintenance) / total : 0,
    },
  };
}

export function buildSnapshot(cars: CarInput[], lang: WidgetLang, api: WidgetApi | null, sel = 0, now = new Date()): WidgetSnapshot {
  return {
    v: 2,
    updated: +now,
    lang,
    cars: cars.map((c) => buildCar(c, lang, now)),
    sel: Math.min(Math.max(sel, 0), Math.max(cars.length - 1, 0)),
    api,
    soonKm: SOON_DISTANCE.km,
    s: STRINGS[lang],
  };
}

/** What the widgets show before the app has written anything, and after sign-out. */
export const emptySnapshot = (lang: WidgetLang): WidgetSnapshot => ({ v: 2, updated: Date.now(), lang, cars: [], sel: 0, api: null, soonKm: SOON_DISTANCE.km, s: STRINGS[lang] });

