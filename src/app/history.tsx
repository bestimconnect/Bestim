import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useMutationState } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import * as Icons from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { Button, Choice, Header, Item, Text } from '@/components/ui';
import { useCurrentVehicle, useVehicleLogs, type Log } from '@/lib/queries';
import { SAVE_LOG_KEY, type SaveLogInput } from '@/lib/saveLog';
import { shadows, useColors } from '@/lib/theme';

// Screens 10 + 39 — Maintenance log / empty state. Figma: docs/figma-screens.md (10, 39).
// Chip -> service_types.name_en (decisions Q11).
const CATEGORIES = {
  all: null,
  oils: ['Oil Change', 'Oil Filter'],
  brakes: ['Brake Inspection', 'Brake Pad Replacement'],
  tires: ['Tire Rotation', 'Tire Replacement'],
} as const;
type Category = keyof typeof CATEGORIES;

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const p = useLocalSearchParams<{ vehicleId?: string; category?: Category }>();
  const { vehicle: current } = useCurrentVehicle();
  const vehicleId = p.vehicleId ?? current?.id;
  const logs = useVehicleLogs(vehicleId);
  const onShowSaved = useShowSavedAction();
  const [category, setCategory] = useState<Category>(p.category && p.category in CATEGORIES ? p.category : 'all');
  // Q45: logs written offline wait in the mutation queue until they sync.
  const queued = useMutationState({
    filters: { mutationKey: SAVE_LOG_KEY, status: 'pending' },
    select: (m) => m.state.variables as SaveLogInput,
  }).filter((v) => v.vehicleId === vehicleId);

  const names = CATEGORIES[category];
  const rows = (logs.data ?? []).filter((l) => !names || (names as readonly string[]).includes(l.service_types?.name_en ?? ''));
  const groups: { month: string; items: Log[] }[] = [];
  for (const l of rows) {
    const month = format(parseISO(l.service_date), 'MMMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS });
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(l);
    else groups.push({ month, items: [l] });
  }
  const empty = logs.isSuccess && logs.data.length === 0 && !queued.length;
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
              value={category}
              onChange={setCategory}
              options={(Object.keys(CATEGORIES) as Category[]).map((k) => ({ value: k, label: t(`history.${k}`) }))}
            />
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
                {g.items.map((l) => {
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
                        icon={(Icons as any)[l.service_types?.icon ?? ''] ?? Icons.Wrench}
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
