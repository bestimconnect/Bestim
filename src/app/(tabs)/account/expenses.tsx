import { Redirect, router } from 'expo-router';
import { Plus, Wallet } from 'lucide-react-native';
import { I18nManager, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Text } from '@/components/ui';
import { useExpenses, useIsGuest, useVehicles } from '@/lib/queries';
import { useColors } from '@/lib/theme';

// Screen 23 — Expenses (167:67034) + empty 40 (167:67235); decisions Q26, Q27, Q30, Q31.
const rows = [
  ['maintenance', ['maintenance']],
  ['fuel', ['fuel']],
  ['insurance', ['insurance', 'registration']],
  ['parts', ['parts']],
  ['other', ['parking', 'other']],
] as const;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function Expenses() {
  const { t } = useTranslation();
  const c = useColors();
  const guest = useIsGuest();
  const expenses = useExpenses().data ?? [];
  const vehicleCount = useVehicles().data?.length ?? 0;
  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'expenses' } }} />;

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
  const add = () => router.push('/add-expense');

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView contentContainerClassName="gap-5 px-6 pt-2 pb-[120px] grow">
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
            <View className="gap-1 rounded-metric bg-ink p-5">
              <Text variant="caption" className="text-paper">{t('expenses.total', { year })}</Text>
              <Text variant="number" className="text-paper" numberOfLines={1}>{fmt(total)}</Text>
              <Text variant="caption" className="text-paper">
                {vehicleCount === 1 ? t('expenses.captionOne') : t('expenses.caption', { count: vehicleCount })}
              </Text>
            </View>
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
