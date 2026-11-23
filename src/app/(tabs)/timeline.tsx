import { useRefresh } from '@/components/Refresh';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useMutationState, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { Check, Clock, Gauge, ListFilter, SearchX, Trash2, TriangleAlert, WifiOff, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { PartArt } from '@/components/PartArt';
import { TabHeader } from '@/components/TabHeader';
import { useTabBarSpace } from '@/components/TabBar';
import { VoiceQueueCard } from '@/components/VoiceQueueCard';
import { ItemSheet } from '@/components/timeline/ItemSheet';
import { Label, Row } from '@/components/timeline/Row';
import { Segments } from '@/components/timeline/Segments';
import { Trust, trustOf } from '@/components/timeline/Trust';
import { pace, weeksLeft } from '@/components/timeline/pace';
import { confirmRemove } from '@/components/timeline/confirmRemove';
import { DEFAULT_PREF, prefKey, useSchedulePrefs } from '@/components/timeline/schedulePrefs';
import { useOnline } from '@/lib/online';
import { Button, Card, Chip, Choice, FooterBar, Text } from '@/components/ui';
import { openCapture } from '@/lib/reading';
import { carLog, scopeOf, type Kind } from '@/lib/carLog';
import { consumption } from '@/lib/fuel';
import { useCurrentVehicle, useExpenses, useFuelFills, useOdometerReadings, useRecordCategories, useServiceTypes, useVehicleLogs, useVehicleParts, type Part } from '@/lib/queries';
import { SAVE_LOG_KEY, type SaveLogInput } from '@/lib/saveLog';
import { pickOption, type PickOption } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';

// Timeline tab (v2 flow 5): "Coming up" = parts by how soon they are due, "Done" = the car log (maintenance, costs, readings).
// The same screen is the /history route (opened from links): there it has a back button and an add button.
const n = (x: number) => x.toLocaleString('en-US');
const KINDS: Kind[] = ['all', 'maintenance', 'cost', 'reading'];
const PAGE = 50; // rows shown at a time: a long history would otherwise render every row at once

export default function TimelineScreen() {
  const { t, i18n } = useTranslation();
  const refresh = useRefresh();
  const c = useColors();
  const qc = useQueryClient();
  const p = useLocalSearchParams<{ vehicleId?: string; filter?: string; item?: string }>(); // filter: a category, subcategory or service id
  const { vehicle: current } = useCurrentVehicle();
  const vehicleId = p.vehicleId ?? current?.id;
  const logs = useVehicleLogs(vehicleId);
  const { parts } = useVehicleParts(current && current.id === vehicleId ? current : undefined);
  const costs = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicleId);
  const readings = useOdometerReadings(vehicleId).data ?? [];
  const services = useServiceTypes().data ?? [];
  const tree = useRecordCategories().data ?? [];
  const onShowSaved = useShowSavedAction();
  const tab = usePathname() === '/timeline';
  const space = useTabBarSpace();
  const [seg, setSeg] = useState<'up' | 'done'>(p.filter ? 'done' : 'up');
  const [kind, setKind] = useState<Kind>('all');
  const [shown, setShown] = useState(PAGE);
  const [filterId, setFilterId] = useState<string | null>(p.filter ?? null);
  const [item, setItem] = useState<Part | null>(null);
  const online = useOnline();
  const prefs = useSchedulePrefs((x) => x.prefs);
  const prefOf = (x: Part) => prefs[prefKey(vehicleId ?? '', x.serviceType.id)] ?? DEFAULT_PREF;
  // An alert for a licence or insurance opens that item here: /timeline?item=<service id>.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const hit = p.item ? parts.find((x) => x.serviceType.id === p.item) : null;
    if (hit) {
      setSeg('up');
      setItem(hit);
      router.setParams({ item: undefined });
    }
  }, [p.item, parts]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Q45: logs written offline wait in the mutation queue until they sync.
  const queued = useMutationState({
    filters: { mutationKey: SAVE_LOG_KEY, status: 'pending' },
    select: (m) => m.state.variables as SaveLogInput,
  }).filter((v) => v.vehicleId === vehicleId);

  const arabic = i18n.language === 'ar';
  const locale = arabic ? ar : enUS;
  const name = (x: { name_en: string; name_ar: string }, other = false) => (arabic !== other ? x.name_ar : x.name_en);
  const unit = t(`vehicles.unit.${(current?.odometer_unit ?? 'km') as 'km'}`);
  const perDay = pace(readings);
  // The filter list as a tree: each category, then its subcategories, each followed by its services (indented).
  const options: PickOption[] = tree
    .filter((x) => !x.parent_id)
    .flatMap((cat) => [
      { id: cat.id, label: name(cat), hint: t('history.level.category'), also: name(cat, true), depth: 0 },
      ...tree
        .filter((sub) => sub.parent_id === cat.id)
        .flatMap((sub) => [
          { id: sub.id, label: name(sub), hint: `${t('history.level.subcategory')} · ${name(cat)}`, also: name(sub, true), depth: 1 },
          ...services
            .filter((s) => s.category_id === sub.id)
            .map((s) => ({ id: s.id, label: name(s), hint: `${t('history.level.service')} · ${name(sub)}`, also: name(s, true), depth: 2 })),
        ]),
    ]);
  // Fuel: the litres per 100 km of each full tank that closed a pair (src/lib/fuel.ts).
  const fuel = consumption(useFuelFills(vehicleId).data ?? []);
  const perFill = (id: string) => {
    const f = fuel?.byFill.get(id);
    return f ? t('fuel.perFill', { n: f.lPer100.toLocaleString('en-US', { maximumFractionDigits: 1 }) }) : null;
  };
  const trash = (table: 'maintenance_logs' | 'expenses', id: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={t('capture.quick.delete')} hitSlop={13} onPress={() => confirmRemove(qc, table, id)}>
      <Trash2 size={18} color={c.muted} />
    </Pressable>
  );
  const chip = options.find((o) => o.id === filterId);

  const entries = carLog(logs.data ?? [], costs, readings, kind, scopeOf(filterId, tree, services));
  const groups: { month: string; items: typeof entries }[] = [];
  for (const e of entries.slice(0, shown)) {
    const month = format(parseISO(e.date), 'MMMM yyyy', { locale });
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }
  const empty = logs.isSuccess && !carLog(logs.data, costs, readings, 'all', null).length && !queued.length;
  const review = (logs.data ?? []).find((l) => l.status === 'needs_review');

  // Coming up: overdue, due soon (this month), the rest. Flow 8 "all clear": nothing overdue or soon.
  const clear = parts.length > 0 && parts.every((x) => x.status.state === 'ok');
  const due: [string, Part[]][] = [
    [t('tl.overdue'), parts.filter((x) => x.status.state === 'overdue')],
    [t('tl.thisMonth'), parts.filter((x) => x.status.state === 'soon' || (x.status.state === 'ok' && x.status.remainingKm != null && x.status.remainingKm <= prefOf(x).remindKm))],
    [clear ? t('home.clear.next') : t('tl.later'), parts.filter((x) => x.status.state === 'ok' && !(x.status.remainingKm != null && x.status.remainingKm <= prefOf(x).remindKm))],
  ];
  const when = (x: Part) => {
    const s = x.status;
    if (s.state === 'overdue')
      return s.remainingDays != null && s.remainingDays < 0 ? t('tl.late', { count: -s.remainingDays }) : t('tl.overBy', { n: n(Math.abs(s.remainingKm ?? 0)), u: unit });
    const w = weeksLeft(s, prefOf(x).predict ? perDay : null);
    if (w == null) return '';
    if (w > 0) return t('tl.inWeeks', { count: w });
    return s.remainingDays != null && s.remainingDays > 0 ? t('tl.inDays', { count: s.remainingDays }) : t('tl.soon');
  };
  const dueAt = (x: Part) =>
    x.status.dueOdometer != null ? t('tl.at', { n: n(x.status.dueOdometer), u: unit }) : x.status.dueDate ? format(parseISO(x.status.dueDate), 'd MMM yyyy', { locale }) : '';

  if (logs.isError && !logs.data) return <ErrorState onRetry={logs.refetch} retrying={logs.isRefetching} onShowSaved={onShowSaved} />;
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="gap-3 px-6">
        <TabHeader title={t('tabs.timeline')} back={!tab} />
        <Segments value={seg} onChange={setSeg} options={[{ value: 'up', label: t('tl.up') }, { value: 'done', label: t('tl.done') }]} />
      </View>
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-2 px-6 pb-6 pt-3" contentContainerStyle={tab ? { paddingBottom: space } : undefined} showsVerticalScrollIndicator={false}>
        {!online ? (
          <Card tone="amber" className="flex-row items-center gap-3 p-3.5">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white"><WifiOff size={18} color={c.soon} /></View>
            <View className="flex-1">
              <Text variant="label" className="font-normal">{t('tl.offlineTitle')}</Text>
              <Text variant="caption" className="text-muted">{t('tl.offlineBody')}</Text>
            </View>
          </Card>
        ) : null}
        {vehicleId ? <VoiceQueueCard vehicleId={vehicleId} /> : null}
        {seg === 'up' ? (
          <>
            {review ? (
              <Card className="gap-2 p-3.5">
                <View style={{ boxShadow: `0 0 0 1.5px ${c.soon}`, borderRadius: 24, position: 'absolute', inset: 0 }} pointerEvents="none" />
                <Text variant="caption" className="text-muted" style={{ fontSize: 12 }}>{t('tl.eye')}</Text>
                <View className="flex-row items-center gap-3">
                  <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-soon"><TriangleAlert size={18} color="#FFFFFF" /></View>
                  <View className="flex-1">
                    <Text variant="label" className="font-normal">{t('tl.eyeTitle')}</Text>
                    <Text variant="caption" className="text-muted" numberOfLines={2}>{t('tl.eyeSub', { n: n(review.odometer_reading ?? 0), u: unit })}</Text>
                  </View>
                  <Button size="sm" title={t('tl.review')} onPress={() => router.push({ pathname: '/log/review-reading', params: { id: review.id } })} />
                </View>
              </Card>
            ) : null}
            {clear ? (
              <Card className="items-center gap-1 px-4 py-6">
                <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-lime"><Check size={40} color="#171B19" strokeWidth={2} /></View>
                <Text variant="heading" className="mt-3">{t('home.clear.title')}</Text>
                <Text variant="caption" className="text-center text-muted">{t('home.clear.body')}</Text>
              </Card>
            ) : null}
            {parts.length === 0 && logs.isSuccess ? <EmptyState icon={SearchX} title={t('tl.nothingUp')} body={t('tl.nothingUpBody')} /> : null}
            {due.map(([label, list]) =>
              list.length ? (
                <View key={label} className="gap-2">
                  <Label>{label}</Label>
                  {list.map((x) => (
                    <Row
                      key={x.serviceType.id}
                      leading={<PartArt nameEn={x.serviceType.name_en} size={50} state={x.status.state === 'overdue' ? 'late' : x.status.state} />}
                      title={name(x.serviceType)}
                      sub={dueAt(x)}
                      aside={<Text variant="caption" className={x.status.state === 'overdue' ? 'text-late' : 'text-muted'} style={{ fontSize: 12 }}>{when(x)}</Text>}
                      onPress={() => setItem(x)}
                    />
                  ))}
                </View>
              ) : null,
            )}
          </>
        ) : empty ? (
          <EmptyState icon={SearchX} title={t('history.emptyTitle')} body={t('history.emptyBody')} action={t('history.emptyCta')} onAction={() => openCapture()} />
        ) : (
          <>
            <View className="flex-row items-center gap-2">
              <View className="flex-1"><Choice value={kind} onChange={(k) => { setKind(k); setShown(PAGE); }} options={KINDS.map((k) => ({ value: k, label: t(`history.kind.${k}`) }))} /></View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('history.filter')}
                onPress={() => pickOption({ title: t('history.filter'), options, allowCustom: false, onPick: ({ id }) => { setFilterId(id); setShown(PAGE); } })}
                className={`h-11 w-11 items-center justify-center rounded-full ${chip ? 'bg-lime' : 'bg-white'}`}
                style={{ boxShadow: shadows.ring }}>
                <ListFilter size={20} color={chip ? '#222E29' : c.ink} />
              </Pressable>
            </View>
            {chip ? (
              <View className="flex-row">
                <Chip label={chip.label} selected icon={X} onPress={() => { setFilterId(null); setShown(PAGE); }} />
              </View>
            ) : null}
            {queued.length ? (
              <View className="gap-2">
                <Label>{t('tl.waiting')}</Label>
                {queued.map((q, i) => (
                  <Row key={i} leading={<Clock size={22} color={c.muted} />} title={q.title} sub={`${(q.odometer ?? 0).toLocaleString('en-US')} · ${q.serviceDate}`} />
                ))}
              </View>
            ) : null}
            {groups.length === 0 && !queued.length && logs.isSuccess ? (
              <EmptyState icon={SearchX} title={t('history.emptyCategory')} action={t('history.clearFilter')} onAction={() => { setFilterId(null); setKind('all'); }} />
            ) : null}
            {groups.map((g) => (
              <View key={g.month} className="gap-2">
                <Label>{g.month}</Label>
                {g.items.map((e) => {
                  if (e.type === 'reading')
                    return <Row key={`r${e.item.id}`} leading={<Gauge size={22} color={c.muted} />} title={t('history.rowNoCost', { reading: n(e.item.reading) })} sub={t('history.odometerUpdated')} />;
                  if (e.type === 'cost') {
                    const x = e.item;
                    const sub = tree.find((y) => y.expense_code === x.category);
                    return (
                      <Row
                        key={`c${x.id}`}
                        leading={<PartArt nameEn={sub?.name_en} size={50} />}
                        title={sub ? name(sub) : t(`expenses.chip.${x.category}`)}
                        sub={[`${n(x.amount)} ${t('expenses.currency')}`, x.description, x.liters != null ? t('history.liters', { n: n(x.liters) }) : null, perFill(x.id)].filter(Boolean).join(' · ')}
                        aside={x.from_log ? undefined : trash('expenses', x.id)}
                      />
                    );
                  }
                  const l = e.item;
                  const flag = l.status === 'needs_review' ? t('history.needsReview') : l.status === 'corrected' ? t('history.corrected') : null;
                  return (
                    <Row
                      key={l.id}
                      leading={<PartArt nameEn={l.service_types?.name_en} size={50} />}
                      title={l.title}
                      sub={[format(parseISO(l.service_date), 'd MMM', { locale }), l.odometer_reading != null ? `${n(l.odometer_reading)} ${unit}` : null, l.cost != null ? `${n(l.cost)} ${t('vehicles.currency')}` : null].filter(Boolean).join(' · ')}
                      below={<View className="flex-row items-center gap-2"><Trust kind={trustOf(l)} />{flag ? <Text variant="caption" className={l.status === 'needs_review' ? 'text-soon' : 'text-teal'} style={{ fontSize: 11.5 }}>{flag}</Text> : null}</View>}
                      aside={trash('maintenance_logs', l.id)}
                      onPress={() => router.push({ pathname: '/log/[id]', params: { id: l.id } })}
                    />
                  );
                })}
              </View>
            ))}
            {entries.length > shown ? <Button title={t('history.more')} variant="secondary" onPress={() => setShown((k) => k + PAGE)} /> : null}
          </>
        )}
      </ScrollView>
      {tab ? null : (
        <FooterBar inset={false}>
          <Button title={t(empty ? 'history.emptyCta' : 'history.add')} onPress={() => openCapture()} />
        </FooterBar>
      )}
      {vehicleId ? <ItemSheet part={item} vehicleId={vehicleId} unit={unit} perDay={perDay} onClose={() => setItem(null)} /> : null}
    </SafeAreaView>
  );
}
