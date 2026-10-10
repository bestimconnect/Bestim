import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useMutationState } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, ListFilter, X } from 'lucide-react-native';
import * as Icons from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Button, Choice, Header, Item, Text } from '@/components/ui';
import { carLog, scopeOf, type Kind } from '@/lib/carLog';
import { consumption } from '@/lib/fuel';
import { useCurrentVehicle, useExpenses, useFuelFills, useOdometerReadings, useRecordCategories, useServiceTypes, useVehicleLogs } from '@/lib/queries';
import { SAVE_LOG_KEY, type SaveLogInput } from '@/lib/saveLog';
import { pickOption, type PickOption } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';

// Screens 10 + 39 — Car log / empty state. Figma: docs/figma-screens.md (10, 39); the timeline and its filters are decisions Q90.
// Maintenance logs, running costs and odometer readings in one list (merge + filter: src/lib/carLog.ts).
const n = (x: number) => x.toLocaleString('en-US');
const KINDS: Kind[] = ['all', 'maintenance', 'cost', 'reading'];
const icon = (name?: string | null, fallback = Icons.Wrench) => (name && (Icons as any)[name]) || fallback;

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const p = useLocalSearchParams<{ vehicleId?: string; filter?: string }>(); // filter: a category, subcategory or service id
  const { vehicle: current } = useCurrentVehicle();
  const vehicleId = p.vehicleId ?? current?.id;
  const logs = useVehicleLogs(vehicleId);
  const costs = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicleId);
  const readings = useOdometerReadings(vehicleId).data ?? [];
  const services = useServiceTypes().data ?? [];
  const tree = useRecordCategories().data ?? [];
  const onShowSaved = useShowSavedAction();
  const [kind, setKind] = useState<Kind>('all');
  const [filterId, setFilterId] = useState<string | null>(p.filter ?? null);
  // Q45: logs written offline wait in the mutation queue until they sync.
  const queued = useMutationState({
    filters: { mutationKey: SAVE_LOG_KEY, status: 'pending' },
    select: (m) => m.state.variables as SaveLogInput,
  }).filter((v) => v.vehicleId === vehicleId);

  const arabic = i18n.language === 'ar';
  const name = (x: { name_en: string; name_ar: string }, other = false) => (arabic !== other ? x.name_ar : x.name_en);
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
  // Fuel: the km per litre of each full tank that closed a pair (src/lib/fuel.ts).
  const fuel = consumption(useFuelFills(vehicleId).data ?? []);
  const perFill = (id: string) => {
    const f = fuel?.byFill.get(id);
    return f ? t('fuel.perFill', { n: f.kmPerLiter.toLocaleString('en-US', { maximumFractionDigits: 1 }) }) : null;
  };
  const chip = options.find((o) => o.id === filterId);

  const entries = carLog(logs.data ?? [], costs, readings, kind, scopeOf(filterId, tree, services));
  const groups: { month: string; items: typeof entries }[] = [];
  for (const e of entries) {
    const month = format(parseISO(e.date), 'MMMM yyyy', { locale: arabic ? ar : enUS });
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }
  const empty = logs.isSuccess && !carLog(logs.data, costs, readings, 'all', null).length && !queued.length;
  const add = () => router.push('/capture');

  if (logs.isError && !logs.data) return <ErrorState onRetry={logs.refetch} retrying={logs.isRefetching} onShowSaved={onShowSaved} />;
  return (
    <SafeAreaView className="flex-1 bg-paper px-6">
      <Header title={t('history.header')} />
      {empty ? (
        <View className="flex-1 justify-center gap-6 pb-10">
          <View className="items-center">
            <View className="w-[200px] gap-2 rounded-item bg-white p-4" style={{ boxShadow: shadows.elevated }}>
              <View className="flex-row items-center gap-2">
                <BadgeCheck size={24} color={c.teal} />
                <Text variant="label" className="flex-1">{t('history.cardTitle')}</Text>
              </View>
              <Text variant="caption" className="text-muted">{t('history.cardBody')}</Text>
              <View className="h-1 w-[60%] rounded-full bg-lime" />
            </View>
          </View>
          <Text variant="title">{t('history.emptyTitle')}</Text>
          <Text variant="body" className="text-muted">{t('history.emptyBody')}</Text>
          <Button title={t('history.emptyCta')} onPress={add} />
        </View>
      ) : (
        <>
          <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-4" showsVerticalScrollIndicator={false}>
            <Text variant="title">{t('history.title')}</Text>
            <Choice
              className="bg-line"
              value={kind}
              onChange={setKind}
              options={KINDS.map((k) => ({ value: k, label: t(`history.kind.${k}`) }))}
            />
            <View className="flex-row flex-wrap gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => pickOption({ title: t('history.filter'), options, allowCustom: false, onPick: ({ id }) => setFilterId(id) })}
                className="h-11 flex-row items-center gap-2 rounded-nav bg-line px-4">
                <ListFilter size={16} color={c.muted} />
                <Text variant="caption" className="text-muted">{t('history.filter')}</Text>
              </Pressable>
              {chip ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('history.removeFilter')}
                  onPress={() => setFilterId(null)}
                  className="h-11 flex-row items-center gap-2 rounded-nav bg-ink px-4">
                  <Text variant="caption" className="text-paper">{chip.label}</Text>
                  <X size={14} color={c.paper} />
                </Pressable>
              ) : null}
            </View>
            {queued.map((q, i) => (
              <View key={i} className="gap-1.5">
                <Text variant="caption" className="text-muted">{t('feedback.pending')}</Text>
                <Item icon={Icons.Clock} title={q.title} subtitle={`${(q.odometer ?? 0).toLocaleString('en-US')} · ${q.serviceDate}`} chevron={false} />
              </View>
            ))}
            {groups.length === 0 && !queued.length && logs.isSuccess ? (
              <Text variant="body" className="mt-6 text-center text-muted">{t('history.emptyCategory')}</Text>
            ) : null}
            {groups.map((g) => (
              <View key={g.month} className="gap-3">
                <Text variant="heading">{g.month}</Text>
                {g.items.map((e) => {
                  if (e.type === 'reading')
                    return <Item key={`r${e.item.id}`} icon={Icons.Gauge} title={t('history.rowNoCost', { reading: n(e.item.reading) })} subtitle={t('history.odometerUpdated')} chevron={false} disabled />;
                  if (e.type === 'cost') {
                    const x = e.item;
                    const sub = tree.find((y) => y.expense_code === x.category);
                    return (
                      <Item
                        key={`c${x.id}`}
                        icon={icon(sub?.icon, Icons.Receipt)}
                        title={sub ? name(sub) : t(`expenses.chip.${x.category}`)}
                        subtitle={[`${n(x.amount)} ${t('expenses.currency')}`, x.description, x.liters != null ? t('history.liters', { n: n(x.liters) }) : null, perFill(x.id)].filter(Boolean).join(' · ')}
                        chevron={false}
                        disabled
                      />
                    );
                  }
                  const l = e.item;
                  const suffix = l.photos.length ? t('history.receipt') : t(l.source === 'voice' ? 'history.voice' : 'history.manual');
                  const reading = (l.odometer_reading ?? 0).toLocaleString('en-US');
                  const base = l.cost != null
                    ? t('history.row', { reading, cost: l.cost.toLocaleString('en-US') })
                    : t('history.rowNoCost', { reading });
                  const caption = l.status === 'needs_review' ? t('history.needsReview') : l.status === 'corrected' ? t('history.corrected') : null;
                  return (
                    <View key={l.id} className="gap-1.5">
                      {caption ? (
                        <Text variant="caption" className={l.status === 'needs_review' ? 'text-[#B7791F]' : 'text-teal'}>{caption}</Text>
                      ) : null}
                      <Item
                        icon={icon(l.service_types?.icon)}
                        title={l.title}
                        subtitle={`${base} · ${suffix}`}
                        onPress={() => router.push({ pathname: '/log/[id]', params: { id: l.id } })}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View className="pb-4 pt-2">
            <Button title={t('history.add')} onPress={add} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
