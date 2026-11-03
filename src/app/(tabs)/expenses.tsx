import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { useState } from 'react';
import { CircleEllipsis, Droplets, Fuel, ParkingCircle, Plus, Receipt, Settings, ShieldCheck, Trash2, Wallet, Wrench } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { ExpenseChart } from '@/components/ExpenseChart';
import { FuelCard } from '@/components/FuelCard';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import { Backdrop, Card, Choice, Group, IconTile, Item, Section, Text } from '@/components/ui';
import { TabHeader } from '@/components/TabHeader';
import { changePct, fmt, hasOlder, inPeriod, keyOf, periodTotal, series, shift, stats, sumCats, type Mode } from '@/lib/expensePeriods';
import { openCapture } from '@/lib/reading';
import { useAllCars, useCurrentVehicle, useExpenses, useRecordCategories } from '@/lib/queries';
import { removeRecord } from '@/lib/removeRecord';
import { useColors } from '@/lib/theme';

// Screen 23 — Expenses (167:67034) + empty 40 (167:67235); decisions Q26, Q27, Q30, Q31.
const rows = [
  ['maintenance', ['maintenance'], Wrench],
  ['fuel', ['fuel'], Fuel],
  ['wash', ['wash'], Droplets],
  ['parking', ['parking', 'tolls'], ParkingCircle],
  ['insurance', ['insurance', 'registration'], ShieldCheck],
  ['parts', ['parts'], Settings],
  ['other', ['other'], CircleEllipsis],
] as const;

export default function Expenses() {
  const refresh = useRefresh();
  const space = useTabBarSpace();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const queryClient = useQueryClient();
  const tree = useRecordCategories().data ?? [];
  const query = useExpenses();
  const onShowSaved = useShowSavedAction();
  const car = useCurrentVehicle().vehicle;
  const all = useAllCars();
  const expenses = (query.data ?? []).filter((e) => all || !car || e.vehicle_id === car.id); // the whole page is the car chosen in the header pill, or every car
  const [view, setView] = useState<{ mode: Mode; key: string }>(() => ({ mode: 'month', key: keyOf('month') }));

  if (query.isError && !query.data) return <ErrorState onRetry={query.refetch} retrying={query.isRefetching} onShowSaved={onShowSaved} />;
  const { mode, key } = view;
  const locale = i18n.language === 'ar' ? ar : enUS;
  const add = () => openCapture();
  const scoped = inPeriod(expenses, key);
  const total = periodTotal(expenses, key);
  const points = series(expenses, mode, key);
  const { avg, top } = stats(points);
  const pct = changePct(total, periodTotal(expenses, shift(mode, key, -1)));
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const title = mode === 'year' ? key : format(new Date(y, m - 1, 1), 'LLLL yyyy', { locale });
  const pointName = (n: number) => (mode === 'year' ? format(new Date(y, n - 1, 1), 'LLLL', { locale }) : format(new Date(y, m - 1, n), 'd MMMM', { locale }));
  const split = rows.map(([name, cats, Icon]) => ({ name, Icon, sum: sumCats(scoped, cats) })).filter((x) => x.sum > 0);
  const splitTotal = split.reduce((n, x) => n + x.sum, 0) || 1;
  const tiles: [string, string, string?][] = [
    [t(mode === 'year' ? 'expenses.avgMonth' : 'expenses.avgDay'), fmt(avg)],
    [t(mode === 'year' ? 'expenses.topMonth' : 'expenses.topDay'), fmt(top)],
    [t('expenses.change'), pct == null ? '—' : `\u200E${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`, pct == null || pct === 0 ? 'text-ink' : pct > 0 ? 'text-danger' : 'text-teal'],
  ];

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Backdrop />
      <ScrollView refreshControl={refresh} contentContainerClassName="gap-6 px-6 grow" contentContainerStyle={{ paddingBottom: space }}>
        <TabHeader title={t('expenses.title')} allCars />
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Choice value={mode} onChange={(v) => setView({ mode: v, key: keyOf(v) })} options={(['month', 'year'] as const).map((v) => ({ value: v, label: t(`expenses.period.${v}`) }))} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('expenses.add')} onPress={add} className="h-11 w-11 items-center justify-center rounded-full bg-lime">
            <Plus size={22} color="#222E29" />
          </Pressable>
        </View>
        {query.isPending && !query.data ? (
          <LoadingState />
        ) : expenses.length === 0 ? (
          <View className="flex-1 justify-center">
            <EmptyState icon={Wallet} title={t('expenses.emptyTitle')} body={t('expenses.emptyBody')} action={t('expenses.emptyCta')} onAction={add} />
          </View>
        ) : (
          <>
            <ExpenseChart
              periodKey={key}
              title={title}
              points={points}
              total={total}
              pointName={pointName}
              onStep={(by) => setView({ mode, key: shift(mode, key, by) })}
              canOlder={hasOlder(expenses, key)}
              canNewer={key < keyOf(mode)}
            />
            <View className="flex-row gap-3">
              {tiles.map(([label, value, color]) => (
                <Card key={label} className="flex-1 items-center gap-0.5 px-2 py-3.5">
                  <Text variant="caption" className="text-muted" numberOfLines={1}>{label}</Text>
                  <Text variant="label" className={color ?? 'text-ink'} numberOfLines={1}>{value}</Text>
                </Card>
              ))}
            </View>
            {car && !all ? <FuelCard vehicleId={car.id} /> : null}
            {scoped.length === 0 ? (
              <Text variant="body" className="text-center text-muted">{t('expenses.emptyPeriod')}</Text>
            ) : (
              <>
                <View>
                  <Section title={t('expenses.where')} />
                  <Card className="gap-4 p-4">
                    {split.map(({ name, Icon, sum }) => (
                      <View key={name} className="gap-2">
                        <View className="flex-row items-center gap-3">
                          <IconTile icon={Icon} size={36} />
                          <Text variant="body" className="min-w-0 flex-1 text-muted" numberOfLines={1}>{t(`expenses.row.${name}`)}</Text>
                          <Text variant="label" className="shrink-0" numberOfLines={1}>{fmt(sum)} {t('expenses.currency')}</Text>
                        </View>
                        <View className="h-1.5 overflow-hidden rounded-full bg-line">
                          <View className="h-full rounded-full bg-teal" style={{ width: `${Math.max(3, Math.round((sum / splitTotal) * 100))}%` }} />
                        </View>
                      </View>
                    ))}
                  </Card>
                </View>
                <View>
                  <Section title={t('expenses.recent')} />
                  <Group>
                    {scoped.slice(0, 20).map((e) => {
                      const sub = tree.find((x) => x.expense_code === e.category);
                      return (
                        <View key={e.id} className="flex-row items-center">
                          <View className="min-w-0 flex-1">
                            <Item
                              icon={Receipt}
                              title={sub ? (i18n.language === 'ar' ? sub.name_ar : sub.name_en) : t(`expenses.chip.${e.category}`)}
                              subtitle={[`${fmt(Number(e.amount))} ${t('expenses.currency')}`, format(parseISO(e.expense_date), 'd MMM yyyy', { locale }), e.description && e.description.length > 24 ? `${e.description.slice(0, 24)}…` : e.description].filter(Boolean).join(' · ')}
                              // A cost that came from a maintenance log is changed (or deleted) through that log.
                              onPress={() => router.push(e.from_log && e.log_id ? { pathname: '/log/[id]', params: { id: e.log_id } } : { pathname: '/capture', params: { expenseId: e.id } })}
                            />
                          </View>
                          {e.from_log ? null : (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t('capture.quick.delete')}
                              onPress={() => removeRecord(queryClient, 'expenses', e.id)}
                              className="h-11 w-11 items-center justify-center">
                              <Trash2 size={20} color={c.muted} />
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </Group>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
