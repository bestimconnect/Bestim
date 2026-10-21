import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PartArt } from '@/components/PartArt';
import { PlateView } from '@/components/Plate';
import { Group, Item, PressableScale, Text } from '@/components/ui';
import { consumption } from '@/lib/fuel';
import { carLog, type Kind } from '@/lib/carLog';
import { STATE_COLOR } from '@/lib/health';
import { useExpenses, useFuelFills, useRecordCategories, useServiceTypes, type Log, type Part, type Vehicle } from '@/lib/queries';
import { hasReading } from '@/lib/reading';
import { shadows, useColors } from '@/lib/theme';

const n = (x: number) => x.toLocaleString('en-US');

/** A row of filter chips: the first is "everything". */
function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6" contentContainerClassName="gap-2 px-6">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          className={`h-9 justify-center rounded-full px-4 ${value === o.value ? 'bg-ink' : 'bg-line'}`}>
          <Text variant="caption" className={value === o.value ? 'text-paper' : 'text-muted'}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const openPart = (vehicleId: string, serviceTypeId: string) => router.push({ pathname: '/part', params: { vehicleId, serviceTypeId } });

const nm = (lang: string, x: { name_ar: string; name_en: string }) => (lang === 'ar' ? x.name_ar : x.name_en);

/** Overview: facts about the car only (no parts): picture, plate, odometer, and a few numbers. */
export function OverviewTab({ vehicle, logs, unit }: { vehicle: Vehicle; logs: Log[]; unit: string }) {
  const { t, i18n } = useTranslation();
  const expenses = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicle.id);
  const fuel = consumption(useFuelFills(vehicle.id).data ?? []);
  const year = String(new Date().getFullYear());
  const spent = expenses.filter((e) => e.expense_date.startsWith(year)).reduce((s, e) => s + Number(e.amount), 0);
  const last = logs[0];
  const days = vehicle.odometer_updated_at ? differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at)) : null;
  const locale = i18n.language === 'ar' ? ar : enUS;
  const facts: [string, string][] = [
    [t('vehicles.facts.thisYear'), `${n(spent)} ${t('vehicles.currency')}`],
    [t('fuel.title'), fuel ? `${fuel.average.kmPerLiter.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${t('fuel.kmPerLiter')}` : '—'],
    [t('vehicles.facts.lastService'), last ? format(parseISO(last.service_date), 'd MMM yyyy', { locale }) : '—'],
    [t('vehicles.facts.colour'), vehicle.color ? t(`vehicles.color.${vehicle.color}`, vehicle.color) : '—'],
  ];
  return (
    <>
      <View className="gap-4 rounded-item bg-white p-4" style={{ boxShadow: shadows.soft }}>
        <View className="flex-row flex-wrap items-center gap-3">
          <PlateView plate={vehicle.plate_number} />
          <Text variant="caption" className="text-muted">{t(`vehicles.type.${vehicle.vehicle_type}`)} · {vehicle.year}</Text>
        </View>
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="caption" className="text-muted">{t('vehicles.odometer', { unit })}</Text>
            <Text variant="number" style={{ fontSize: 34, lineHeight: 42 }}>{hasReading(vehicle) ? n(vehicle.current_odometer) : '—'}</Text>
            <Text variant="caption" className="text-muted">{days == null ? t('odometer.first') : days === 0 ? t('vehicles.facts.updatedToday') : t('vehicles.facts.updated', { count: days })}</Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/update-odometer', params: { vehicleId: vehicle.id } })}
            className="h-11 justify-center rounded-full bg-lime px-5">
            <Text variant="label" className="text-[#222E29]">{t('home.update')}</Text>
          </PressableScale>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-3">
        {facts.map(([label, value]) => (
          <View key={label} className="gap-1 rounded-item bg-white p-4" style={{ boxShadow: shadows.soft, width: '47.8%' }}>
            <Text variant="caption" className="text-muted">{label}</Text>
            <Text variant="label" numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>
      <PressableScale
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/edit-vehicle', params: { id: vehicle.id } })}
        className="gap-1 rounded-item bg-white p-4"
        style={{ boxShadow: shadows.soft }}>
        <Text variant="caption" className="text-muted">{t('vehicles.vin.label')}</Text>
        <Text variant="label" selectable={!!vehicle.vin}>{vehicle.vin || '—'}</Text>
      </PressableScale>
    </>
  );
}

/** Parts: every part the app knows, grouped by category. A part with records for this car is a solid tile with a count; the rest are dashed and faded. */
export function PartsTab({ vehicle, logs, parts }: { vehicle: Vehicle; logs: Log[]; parts: Part[] }) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const [gridW, setGridW] = useState(0);
  const gap = 8;
  const tileW = gridW ? Math.floor((gridW - gap * 3) / 4) : 0;
  const services = (useServiceTypes().data ?? []).filter((s) => s.category_id);
  const count = new Map<string, number>();
  for (const l of logs) if (l.service_type_id) count.set(l.service_type_id, (count.get(l.service_type_id) ?? 0) + 1);
  const state = new Map(parts.map((p) => [p.serviceType.id, p.status.state]));
  const groups: { id: string; name: string; sort: number; items: typeof services }[] = [];
  for (const s of services) {
    const top = s.parentCategory;
    if (!top) continue;
    let g = groups.find((x) => x.id === top.id);
    if (!g) groups.push((g = { id: top.id, name: nm(i18n.language, top), sort: top.sort, items: [] }));
    g.items.push(s);
  }
  groups.sort((a, b) => a.sort - b.sort);
  return (
    <View className="gap-3" onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
      {groups.map((g) => (
        <View key={g.id} className="gap-2">
          <Text variant="caption" className="text-muted">{g.name}</Text>
          <View className="flex-row flex-wrap gap-2">
            {g.items.map((s) => {
              const k = count.get(s.id) ?? 0;
              const st = state.get(s.id);
              return (
                <PressableScale
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${nm(i18n.language, s)}, ${k}`}
                  onPress={() => openPart(vehicle.id, s.id)}
                  className={`items-center gap-1.5 rounded-item px-1 pb-2 pt-3 ${k ? 'bg-panel' : 'border border-dashed border-line'}`}
                  style={{ width: tileW || '23%' }}>
                  <View style={{ opacity: k ? 1 : 0.35 }}><PartArt nameEn={s.name_en} size={38} /></View>
                  <Text variant="caption" numberOfLines={2} className={`text-center ${k ? 'text-onpanel' : 'text-muted'}`} style={{ fontSize: 11, lineHeight: 14 }}>{nm(i18n.language, s)}</Text>
                  {k ? (
                    <View className="absolute end-1.5 top-1.5 min-w-[18px] items-center rounded-full bg-lime px-1">
                      <Text variant="caption" className="text-[#222E29]" style={{ fontSize: 10, lineHeight: 16, fontFamily: 'Poppins_700Bold' }}>{k}</Text>
                    </View>
                  ) : null}
                  {st && st !== 'ok' ? <View className="absolute start-1.5 top-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: STATE_COLOR[st] }} /> : null}
                </PressableScale>
              );
            })}
          </View>
        </View>
      ))}
      <Text variant="caption" className="text-center text-muted" style={{ color: c.muted }}>{t('vehicles.facts.partsHint')}</Text>
    </View>
  );
}

/** Logs: everything paid for this car, newest first, with a total on top and a filter by kind. */
export function LogsTab({ vehicle, logs, unit, empty }: { vehicle: Vehicle; logs: Log[]; unit: string; empty?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const tree = useRecordCategories().data ?? [];
  const expenses = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicle.id);
  const [kind, setKind] = useState<Kind>('all');
  const locale = i18n.language === 'ar' ? ar : enUS;
  const entries = carLog(logs, expenses, [], kind, null);
  const total = entries.reduce((s, e) => s + (e.type === 'log' ? (e.item.cost ?? 0) : e.type === 'cost' ? Number(e.item.amount) : 0), 0);
  const groups: { month: string; items: typeof entries }[] = [];
  for (const e of entries) {
    const month = format(parseISO(e.date), 'MMMM yyyy', { locale });
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }
  // Only a car with no records at all gets the empty page; an empty filter keeps the chips so you can switch back.
  if (empty && !carLog(logs, expenses, [], 'all', null).length) return <>{empty}</>;
  return (
    <>
      <View className="flex-row items-center gap-3 rounded-item bg-white p-4" style={{ boxShadow: shadows.soft }}>
        <View className="flex-1 gap-0.5">
          <Text variant="caption" className="text-muted">{t('vehicles.facts.totalPaid')}</Text>
          <Text variant="number" style={{ fontSize: 26, lineHeight: 34 }}>{n(total)} <Text variant="caption" className="text-muted">{t('vehicles.currency')}</Text></Text>
        </View>
        <Text variant="caption" className="text-muted">{t('history.count', { count: entries.length })}</Text>
      </View>
      <Chips
        value={kind}
        onChange={setKind}
        options={[
          { value: 'all', label: t('vehicles.dash.all') },
          { value: 'maintenance', label: t('history.kind.maintenance') },
          { value: 'cost', label: t('history.kind.cost') },
        ]}
      />
      {!entries.length ? <Text variant="caption" className="py-6 text-center text-muted">{t('pick.empty')}</Text> : null}
      {groups.map((g) => (
        <View key={g.month} className="gap-3">
          <Text variant="label" className="text-muted">{g.month}</Text>
          <Group>
          {g.items.map((e) => {
            if (e.type === 'log') {
              const l = e.item;
              return (
                <Item
                  key={l.id}
                  leading={<PartArt nameEn={l.service_types?.name_en} size={28} />}
                  title={l.title}
                  subtitle={[format(parseISO(l.service_date), 'd MMM', { locale }), l.odometer_reading != null ? `${n(l.odometer_reading)} ${unit}` : ''].filter(Boolean).join(' · ')}
                  aside={l.cost != null ? <Text variant="label">{n(l.cost)}</Text> : undefined}
                  onPress={() => router.push({ pathname: '/log/[id]', params: { id: l.id } })}
                />
              );
            }
            if (e.type !== 'cost') return null;
            const x = e.item;
            const sub = tree.find((y) => y.expense_code === x.category);
            return (
              <Item
                key={x.id}
                leading={<PartArt nameEn={sub?.name_en} size={28} />}
                title={sub ? nm(i18n.language, sub) : t(`expenses.chip.${x.category}`)}
                subtitle={[format(parseISO(x.expense_date), 'd MMM', { locale }), x.description].filter(Boolean).join(' · ')}
                chevron={false}
                aside={<Text variant="label">{n(Number(x.amount))}</Text>}
              />
            );
          })}
          </Group>
        </View>
      ))}
    </>
  );
}
