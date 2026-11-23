import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { ShieldCheck, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Num } from '@/components/home/Num';
import { PartArt } from '@/components/PartArt';
import { Ring } from '@/components/Ring';
import { PlateView } from '@/components/Plate';
import { Card, Chip, Group, Item, PressableScale, Section, Text } from '@/components/ui';
import { consumption, fuelGap } from '@/lib/fuel';
import { carLog, type Kind } from '@/lib/carLog';
import { carHealth, STATE_COLOR } from '@/lib/health';
import { useExpenses, useFuelFills, useRecordCategories, useServiceTypes, type Log, type Part, type Vehicle } from '@/lib/queries';
import { hasReading } from '@/lib/reading';
import { useColors } from '@/lib/theme';

const n = (x: number) => x.toLocaleString('en-US');

/** A row of filter chips: the first is "everything". */
function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6" contentContainerClassName="gap-2 px-6">
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

const openPart = (vehicleId: string, serviceTypeId: string) => router.push({ pathname: '/part', params: { vehicleId, serviceTypeId } });

const nm = (lang: string, x: { name_ar: string; name_en: string }) => (lang === 'ar' ? x.name_ar : x.name_en);

/** A read-only info tile (v2): small label, a big thin number or word. Editing happens only from the pencil at the top of the page. */
function Tile({ label, value, unit, children, className = '' }: { label: string; value?: string; unit?: string; children?: ReactNode; className?: string }) {
  return (
    <Card className={`min-h-[92px] flex-1 gap-1 p-4 ${className}`}>
      <Text variant="caption" className="text-muted">{label}</Text>
      {value != null ? <Num value={value} unit={unit} size={30} /> : null}
      {children}
    </Card>
  );
}

/** Overview: facts about the car (all read-only), the health ring and fuel use tiles, passport link and delete. */
export function OverviewTab({ vehicle, parts, unit }: { vehicle: Vehicle; logs?: Log[]; parts: Part[]; unit: string }) {
  const { t } = useTranslation();
  const c = useColors();
  const fills = useFuelFills(vehicle.id).data ?? [];
  const fuel = consumption(fills);
  const health = carHealth(parts);
  const hColor = health.score == null ? c.line : health.late ? STATE_COLOR.overdue : health.soon ? STATE_COLOR.soon : STATE_COLOR.ok;
  const days = vehicle.odometer_updated_at ? differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at)) : null;
  return (
    <>
      <View className="flex-row gap-3">
        <Tile label={t('vehicles.facts.year')} value={String(vehicle.year)} />
        <Tile label={t('vehicles.odometer', { unit })} value={hasReading(vehicle) ? n(vehicle.current_odometer) : '—'}>
          <Text variant="caption" className="text-muted" numberOfLines={1}>{days == null ? t('odometer.first') : days === 0 ? t('vehicles.facts.updatedToday') : t('vehicles.facts.updated', { count: days })}</Text>
        </Tile>
      </View>
      {/* Read-only on purpose (VIN, plate): details are edited only from the pencil at the top. */}
      <View className="flex-row gap-3">
        <Tile label={t('vehicles.vin.label')}>
          <Text variant="label" selectable={!!vehicle.vin} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{vehicle.vin || '—'}</Text>
        </Tile>
        <Tile label={t('plate.label')}>
          {vehicle.plate_number?.trim() ? <View className="flex-row"><PlateView plate={vehicle.plate_number} size="sm" /></View> : <Text variant="label">—</Text>}
        </Tile>
      </View>
      <View className="flex-row gap-3">
        <Tile label={t('fuel.title')} value={fuel ? fuel.average.lPer100.toLocaleString('en-US', { maximumFractionDigits: 1 }) : undefined} unit={fuel ? t('fuel.lPer100') : undefined}>
          {fuel ? null : <Text variant="caption" className="text-muted">{t(`fuel.gap.${fuelGap(fills)}`)}</Text>}
        </Tile>
        <Tile label={t('vehicles.dash.health')}>
          {health.score != null ? (
            <View className="flex-row items-center gap-3">
              <Ring value={health.score / 100} color={hColor} size={52} label={String(health.score)} />
              <Text variant="caption" className="flex-1 text-muted">{t('vehicles.dash.counts', { late: health.late, soon: health.soon })}</Text>
            </View>
          ) : (
            <Text variant="caption" className="text-muted">{t('vehicles.facts.noHealth')}</Text>
          )}
        </Tile>
      </View>
      {/* ponytail: the passport row is not in the v2 strip (it is reached from the menu there); kept so the passport stays one tap away. */}
      <Group>
        <Item icon={ShieldCheck} title={t('passport.title')} subtitle={t('passport.sub')} onPress={() => router.push({ pathname: '/passport' as never, params: { id: vehicle.id } })} />
      </Group>
      {/* v2: a white card, the label in danger red and a blush circle with the bin, no chevron. */}
      <Card onPress={() => router.push({ pathname: '/delete-vehicle', params: { vehicleId: vehicle.id } })} accessibilityRole="button" className="min-h-[60px] flex-row items-center gap-3 !rounded-row px-4 py-3">
        <Text variant="label" className="flex-1 text-danger">{t('vehicles.deleteCar')}</Text>
        <View className="h-11 w-11 items-center justify-center rounded-full bg-blush"><Trash2 size={18} color={c.danger} strokeWidth={1.8} /></View>
      </Card>
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
      <Card className="flex-row items-center gap-3 p-4">
        <View className="flex-1 gap-0.5">
          <Text variant="caption" className="text-muted">{t('vehicles.facts.totalPaid')}</Text>
          <Text variant="number" numberOfLines={1} style={{ fontSize: 26, lineHeight: 34 }}>{n(total)} <Text variant="caption" className="text-muted">{t('vehicles.currency')}</Text></Text>
        </View>
        <Text variant="caption" className="shrink-0 text-muted">{t('history.count', { count: entries.length })}</Text>
      </Card>
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
        <View key={g.month}>
          <Section title={g.month} />
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
