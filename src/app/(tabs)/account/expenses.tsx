import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Plus, Receipt, Trash2, Wallet } from 'lucide-react-native';
import { I18nManager, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { FuelCard } from '@/components/FuelCard';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Button, Header, Item, Text } from '@/components/ui';
import { useCurrentVehicle, useExpenses, useRecordCategories, useVehicles } from '@/lib/queries';
import { removeRecord } from '@/lib/removeRecord';
import { useColors } from '@/lib/theme';

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
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function Expenses() {
  const refresh = useRefresh();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const queryClient = useQueryClient();
  const tree = useRecordCategories().data ?? [];
  const query = useExpenses();
  const expenses = query.data ?? [];
  const onShowSaved = useShowSavedAction();
  const vehicleCount = useVehicles().data?.length ?? 0;
  const car = useCurrentVehicle().vehicle;

  if (query.isError && !query.data) return <ErrorState onRetry={query.refetch} retrying={query.isRefetching} onShowSaved={onShowSaved} />;
  const now = new Date();
  const year = now.getFullYear();
  const thisYear = expenses.filter((e) => e.expense_date.startsWith(String(year)));
  const total = thisYear.reduce((s, e) => s + Number(e.amount), 0);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const sum = expenses.filter((e) => e.expense_date.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0);
    return { label: key.slice(5), sum, current: i === 5 };
  });
  const max = Math.max(...months.map((m) => m.sum), 1);
  const add = () => router.push('/capture');

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView refreshControl={refresh} contentContainerClassName="gap-5 px-6 pt-2 pb-[120px] grow">
        <Header
          title={t('expenses.title')}
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
        {thisYear.length === 0 ? (
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
            <View className="gap-1 rounded-metric bg-panel p-5">
              <Text variant="caption" className="text-onpanel">{t('expenses.total', { year })}</Text>
              <Text variant="number" className="text-onpanel" numberOfLines={1}>{fmt(total)}</Text>
              <Text variant="caption" className="text-onpanel">
                {vehicleCount === 1 ? t('expenses.captionOne') : t('expenses.caption', { count: vehicleCount })}
              </Text>
            </View>
            {car ? <FuelCard vehicleId={car.id} /> : null}
            {/* Design keeps months oldest→newest left to right in Arabic too. */}
            <View className="h-[150px] items-end justify-between px-2" style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }}>
              {months.map((m) => (
                <View key={m.label} className="items-center gap-2">
                  <View
                    className={`w-7 rounded-lg ${m.current ? 'bg-teal' : 'bg-line'}`}
                    style={{ height: Math.max(10, (m.sum / max) * 110) }}
                  />
                  <Text variant="caption" className="text-muted">{m.label}</Text>
                </View>
              ))}
            </View>
            <Text variant="heading">{t('expenses.where')}</Text>
            {rows.map(([key, cats]) => {
              const sum = thisYear.filter((e) => (cats as readonly string[]).includes(e.category)).reduce((s, e) => s + Number(e.amount), 0);
              return sum > 0 ? (
                <View key={key} className="flex-row items-center justify-between">
                  <Text variant="label">{fmt(sum)} {t('expenses.currency')}</Text>
                  <Text variant="body" className="text-muted">{t(`expenses.row.${key}`)}</Text>
                </View>
              ) : null;
            })}
            <Text variant="heading">{t('expenses.recent')}</Text>
            {thisYear.slice(0, 20).map((e) => {
              const sub = tree.find((y) => y.expense_code === e.category);
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
      </ScrollView>
    </SafeAreaView>
  );
}
