import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { useState } from 'react';
import { Plus, Receipt, Trash2, Wallet } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { ExpenseChart } from '@/components/ExpenseChart';
import { FuelCard } from '@/components/FuelCard';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Button, Choice, Header, Item, Text } from '@/components/ui';
import { changePct, fmt, hasOlder, inPeriod, keyOf, periodTotal, series, shift, stats, sumCats, type Mode } from '@/lib/expensePeriods';
import { openCapture } from '@/lib/reading';
import { useCurrentVehicle, useExpenses, useRecordCategories } from '@/lib/queries';
import { removeRecord } from '@/lib/removeRecord';
import { shadows, useColors } from '@/lib/theme';

// Screen 23 — Expenses (167:67034) + empty 40 (167:67235); decisions Q26, Q27, Q30, Q31.
const rows = [
  ['maintenance', ['maintenance']],
  ['fuel', ['fuel']],
  ['wash', ['wash']],
  ['parking', ['parking', 'tolls']],
  ['insurance', ['insurance', 'registration']],
  ['parts', ['parts']],
  ['other', ['other']],
] as const;

export default function Expenses() {
  const refresh = useRefresh();
  const space = useTabBarSpace();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const queryClient = useQueryClient();
  const tree = useRecordCategories().data ?? [];
  const query = useExpenses();
  const expenses = query.data ?? [];
  const onShowSaved = useShowSavedAction();
  const car = useCurrentVehicle().vehicle;
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
  const tiles: [string, string, string?][] = [
    [t(mode === 'year' ? 'expenses.avgMonth' : 'expenses.avgDay'), fmt(avg)],
    [t(mode === 'year' ? 'expenses.topMonth' : 'expenses.topDay'), fmt(top)],
    [t('expenses.change'), pct == null ? '—' : `\u200E${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`, pct == null || pct === 0 ? 'text-ink' : pct > 0 ? 'text-danger' : 'text-teal'],
  ];

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView refreshControl={refresh} contentContainerClassName="gap-5 px-6 pt-2 grow" contentContainerStyle={{ paddingBottom: space }}>
        <Header
          title={t('expenses.title')}
          back={false}
          below={
            <Choice
              onDark
              className="bg-[#FFFFFF1F]"
              value={mode}
              onChange={(v) => setView({ mode: v, key: keyOf(v) })}
              options={(['month', 'year'] as const).map((v) => ({ value: v, label: t(`expenses.period.${v}`) }))}
            />
          }
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('expenses.add')}
              onPress={add}
              className="h-11 w-11 items-center justify-center rounded-full bg-lime">
              <Plus size={22} color="#222E29" />
            </Pressable>
          }
        />
        {expenses.length === 0 ? (
          <View className="flex-1 justify-center gap-5">
            <View className="h-[100px] w-[100px] items-center justify-center self-center rounded-full bg-mint">
              <Wallet size={40} color={c.teal} />
            </View>
            <Text variant="title">{t('expenses.emptyTitle')}</Text>
            <Text variant="body" className="text-muted">{t('expenses.emptyBody')}</Text>
            <Button title={t('expenses.emptyCta')} onPress={add} />
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
            <View className="flex-row gap-2">
              {tiles.map(([label, value, color]) => (
                <View key={label} className="flex-1 items-center gap-0.5 rounded-item bg-white px-2 py-3" style={{ boxShadow: shadows.soft }}>
                  <Text variant="caption" className="text-muted" numberOfLines={1}>{label}</Text>
                  <Text variant="label" className={color ?? 'text-ink'} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>
            {car ? <FuelCard vehicleId={car.id} /> : null}
            {scoped.length === 0 ? (
              <Text variant="body" className="text-center text-muted">{t('expenses.emptyPeriod')}</Text>
            ) : (
              <>
                <Text variant="heading">{t('expenses.where')}</Text>
                {rows.map(([name, cats]) => {
                  const sum = sumCats(scoped, cats);
                  return sum > 0 ? (
                    <View key={name} className="flex-row items-center justify-between">
                      <Text variant="label">{fmt(sum)} {t('expenses.currency')}</Text>
                      <Text variant="body" className="text-muted">{t(`expenses.row.${name}`)}</Text>
                    </View>
                  ) : null;
                })}
                <Text variant="heading">{t('expenses.recent')}</Text>
                {scoped.slice(0, 20).map((e) => {
                  const sub = tree.find((x) => x.expense_code === e.category);
                  return (
                    <View key={e.id} className="flex-row items-center gap-2">
                      <View className="flex-1">
                        <Item
                          icon={Receipt}
                          title={sub ? (i18n.language === 'ar' ? sub.name_ar : sub.name_en) : t(`expenses.chip.${e.category}`)}
                          subtitle={[`${fmt(Number(e.amount))} ${t('expenses.currency')}`, e.expense_date, e.description].filter(Boolean).join(' · ')}
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
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
