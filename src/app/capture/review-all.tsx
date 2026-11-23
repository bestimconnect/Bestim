import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { ArrowRight, Banknote, CalendarDays, Gauge, Mic, Settings2, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { PartArt } from '@/components/PartArt';
import { TextLink } from '@/components/VoiceSheet';
import { Button, Card, Field, IconTile, Note, Text } from '@/components/ui';
import { shouldAskNotifications } from '@/lib/notifications';
import { useServiceTypes, useVehicles } from '@/lib/queries';
import { saveLog } from '@/lib/saveLog';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';
import { dropVoice } from '@/lib/voiceSend';
import { useVoiceBatch, type BatchRecord } from '@/stores/voiceBatch';

// Review what one voice recording produced (v2 sheet, design-v2 flow 4 #2): a card per record with its chips and trust label,
// edit or remove, then save them all (decisions Q58–Q69).
const n = (v: number) => v.toLocaleString('en-US');

export default function ReviewAll() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { transcript, records, update, remove } = useVoiceBatch();
  const vehicles = useVehicles().data ?? [];
  const types = useServiceTypes().data ?? [];
  const [understood] = useState(records.length > 0); // Q63: nothing understood vs Q62: the user removed every card
  const [editing, setEditing] = useState<string | null>(null); // the odometer card being typed into
  const [partial, setPartial] = useState<{ saved: number; total: number } | null>(null);
  const today = new Date().toLocaleDateString('en-CA');
  const arabic = i18n.language === 'ar';

  const vehicleOf = (r: BatchRecord) => vehicles.find((v) => v.id === r.vehicleId);
  const typeOf = (r: BatchRecord) => (r.kind === 'maintenance' ? types.find((s) => s.name_en === r.serviceType) : undefined);
  const typeName = (r: BatchRecord) => {
    const s = typeOf(r);
    return s ? (arabic ? s.name_ar : s.name_en) : '';
  };
  const reading = (r: BatchRecord, v: number) =>
    t('capture.batch.reading', { value: n(v), unit: t(`home.${vehicleOf(r)?.odometer_unit ?? 'km'}`) });
  const money = (v: number) => t('capture.batch.money', { value: n(v) });
  const day = (d: string | null) =>
    !d || d === today ? t('capture.batch.today') : format(new Date(`${d}T00:00:00`), 'd MMM yyyy', { locale: arabic ? ar : enUS });

  const title = (r: BatchRecord) =>
    r.kind === 'maintenance'
      ? r.title || typeName(r)
      : r.kind === 'expense'
        ? r.category ? t(`expenses.chip.${r.category}`) : t('capture.batch.unclearExpense')
        : t('capture.batch.odometerTitle');
  // Q59: only what was said; a missing part is left out, never shown as "not mentioned".
  const chips = (r: BatchRecord): { icon: LucideIcon; text: string }[] =>
    (r.kind === 'maintenance'
      ? [r.odometer != null && { icon: Gauge, text: reading(r, r.odometer) }, r.cost != null && { icon: Banknote, text: money(r.cost) }, { icon: CalendarDays, text: day(r.date) }]
      : r.kind === 'expense'
        ? [r.amount != null && { icon: Banknote, text: money(r.amount) }, r.liters != null && { icon: Banknote, text: t('capture.batch.liters', { value: n(r.liters) }) }, r.odometer != null && { icon: Gauge, text: reading(r, r.odometer) }, r.place && { icon: Banknote, text: r.place }, { icon: CalendarDays, text: day(r.date) }]
        : [{ icon: Gauge, text: reading(r, r.reading) }]
    ).filter((x): x is { icon: LucideIcon; text: string } => !!x);
  const artName = (r: BatchRecord) => (r.kind === 'maintenance' ? typeOf(r)?.name_en : r.kind === 'expense' && r.category === 'fuel' ? 'Fuel' : undefined);

  // What stops a card from being saved as it is (Q61). A lower reading is never written silently (Q9).
  const problem = (r: BatchRecord) => {
    if (r.kind === 'expense' && r.category == null) return t('capture.batch.missingCategory');
    if (r.kind === 'expense' && r.amount == null) return t('capture.batch.missingAmount');
    const current = vehicleOf(r)?.current_odometer ?? 0;
    if (r.kind === 'odometer' && (r.reading <= 0 || r.reading < current)) return t('capture.batch.lowerReading', { value: n(current) });
    return null;
  };
  const blocked = records.map(problem).find(Boolean);

  const edit = (r: BatchRecord) => {
    if (r.kind === 'odometer') return setEditing(editing === r.key ? null : r.key);
    router.push({ pathname: '/capture', params: { batch: r.key } }); // the quick-add sheet, filled from the card
  };

  const save = useMutation({
    // Never throws: each card succeeds or keeps its own error, so a retry can't save anything twice (Q68).
    mutationFn: async () => {
      const all = useVoiceBatch.getState().records;
      const saved: string[] = [];
      let review = false;
      for (const r of all) {
        try {
          if (r.kind === 'maintenance') {
            const log = await saveLog({
              vehicleId: r.vehicleId,
              serviceTypeId: typeOf(r)?.id ?? null,
              title: title(r),
              odometer: r.odometer,
              cost: r.cost,
              serviceDate: r.date ?? today,
              location: r.location,
              notes: r.notes,
              source: 'voice',
              transcript,
              parts: r.parts,
              intervalKm: r.intervalKm,
              intervalMonths: r.intervalMonths,
              details: r.details,
              photoUri: r.photoUri,
            });
            review ||= log.status === 'needs_review';
          } else {
            const { error } =
              r.kind === 'expense'
                ? await supabase.from('expenses').insert({
                    vehicle_id: r.vehicleId,
                    category: r.category!,
                    amount: r.amount!,
                    expense_date: r.date ?? today,
                    description: r.place || null,
                    liters: r.liters,
                    odometer_reading: r.odometer,
                  })
                : await supabase.from('vehicles').update({ current_odometer: r.reading }).eq('id', r.vehicleId);
            if (error) throw error;
          }
          saved.push(r.key);
        } catch {
          update(r.key, { error: t('capture.batch.cardFailed') });
        }
      }
      return { saved, total: all.length, review, vehicleId: all[0].vehicleId };
    },
    onSuccess: async ({ saved, total, review, vehicleId }) => {
      for (const key of ['vehicles', 'logs', 'expenses']) queryClient.invalidateQueries({ queryKey: [key] });
      const queued = useVoiceBatch.getState().queueId;
      if (queued && saved.length) dropVoice(queued); // Q93: a recording from the offline queue is done once saved
      if (saved.length < total) {
        saved.forEach(remove);
        return setPartial(saved.length ? { saved: saved.length, total } : null);
      }
      const ask = await shouldAskNotifications(); // Q39: asked once, after the first save
      router.dismissAll();
      router.push({
        pathname: ask ? '/notify-permission' : '/success',
        params: { kind: 'batch', vehicleId, count: String(total), ...(review ? { review: '1' } : {}) },
      });
    },
  });

  // Q62/Q63: nothing left to save. Start clean, on the same vehicle.
  const restart = (source: 'voice' | 'manual') => {
    router.back(); // a sheet is closed with back(); this screen sits on the home screen
    if (source === 'voice') return router.push('/capture/voice');
    router.push({ pathname: '/capture', params: { vehicleId: useLogDraft.getState().vehicleId ?? undefined } });
  };

  const foundKey = records.length === 1 ? 'logv2.foundOne' : records.length === 2 ? 'logv2.foundTwo' : 'logv2.foundMany';
  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="gap-2.5 px-5 pb-4 pt-3" keyboardShouldPersistTaps="handled" className="flex-1" style={{ flexGrow: 1, flexShrink: 1, minHeight: 240 }}>
        <View className="h-1 w-[38px] self-center rounded-full bg-tick" />
        {records.length ? <Text variant="heading" className="mb-0.5 mt-0.5">{t(foundKey, { count: records.length })}</Text> : null}
        {transcript ? <Text variant="caption" className="text-muted">«{transcript}»</Text> : null}
        {partial ? <Note tone="warning" text={t('capture.batch.partialFail', partial)} /> : null}
        {records.length === 0 ? (
          <View className="-mx-5">
            <EmptyState icon={Mic} tone={understood ? 'mint' : 'amber'} title={t('capture.batch.emptyTitle')} body={t(understood ? 'capture.batch.emptyBody' : 'capture.batch.nothingUnderstood')} />
          </View>
        ) : null}
        {records.map((r) => {
          const vehicle = vehicleOf(r);
          const issue = problem(r);
          return (
            <Card key={r.key} className="gap-2.5 px-4 py-3.5">
              <View className="flex-row items-center gap-2.5">
                {r.kind === 'odometer' ? <IconTile icon={Gauge} size={34} /> : <PartArt nameEn={artName(r)} size={34} />}
                <View className="flex-1">
                  <Text variant="label" className="text-[15px]" numberOfLines={1}>{title(r)}</Text>
                  {vehicles.length > 1 && vehicle ? <Text variant="caption" className="text-muted" numberOfLines={1}>{vehicle.nickname || `${vehicle.make} ${vehicle.model}`}</Text> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={t('capture.batch.tapHint')} hitSlop={6} onPress={() => edit(r)} className="h-[34px] w-[34px] items-center justify-center rounded-full bg-paper">
                  <Settings2 size={15} color={c.ink} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('capture.batch.remove')} hitSlop={6} onPress={() => remove(r.key)} className="h-[34px] w-[34px] items-center justify-center rounded-full bg-paper">
                  <X size={15} color={c.muted} />
                </Pressable>
              </View>
              <View className="flex-row flex-wrap gap-[7px]">
                {chips(r).map((x, i) => (
                  <View key={i} className="flex-row items-center gap-1.5 rounded-full bg-paper px-3 py-2">
                    <x.icon size={13} color={c.muted} strokeWidth={1.8} />
                    <Text variant="caption" className="text-[12.5px]">{x.text}</Text>
                  </View>
                ))}
              </View>
              {r.kind !== 'odometer' ? (
                <View className="flex-row items-center gap-1.5 self-start rounded-full bg-paper px-2.5 py-1">
                  <View className="h-[7px] w-[7px] rounded-full bg-muted" />
                  <Text variant="caption" className="text-[11.5px] text-muted">{t('logv2.self')}</Text>
                </View>
              ) : null}
              {r.kind === 'maintenance' && r.notes ? <Text variant="caption" className="text-muted">{t('capture.batch.notes', { notes: r.notes })}</Text> : null}
              {r.kind === 'odometer' && editing === r.key ? (
                <Field
                  label={t('capture.batch.odometerTitle')}
                  value={r.reading ? String(r.reading) : ''}
                  onChangeText={(v) => update(r.key, { reading: Number(v.replace(/\D/g, '')) || 0, error: undefined })}
                  keyboardType="number-pad"
                  autoFocus
                />
              ) : null}
              {issue ? (
                <View className="self-start rounded-full bg-amber px-3 py-1">
                  <Text variant="caption">{issue}</Text>
                </View>
              ) : r.error ? (
                <Text variant="caption" className="text-danger">{r.error}</Text>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
      <View className="gap-1 px-5 pt-1" style={{ paddingBottom: bottom + 8 }}>
        {records.length ? (
          <>
            {blocked ? <Note tone="alert" text={blocked} /> : null}
            <Button
              title={records.length === 1 ? t('capture.batch.saveOne') : records.length === 2 ? t('logv2.saveBoth') : t('capture.batch.saveMany', { count: records.length })}
              icon={<ArrowRight size={17} color={c.onbtn} strokeWidth={2} style={{ transform: [{ scaleX: arabic ? -1 : 1 }] }} />}
              onPress={() => save.mutate()}
              disabled={!!blocked}
              loading={save.isPending}
            />
            <TextLink title={t('logv2.redo')} onPress={() => restart('voice')} />
          </>
        ) : (
          <>
            <Button title={t('capture.batch.emptyAgain')} onPress={() => restart('voice')} />
            <TextLink title={t('capture.batch.emptyManual')} onPress={() => restart('manual')} />
          </>
        )}
      </View>
    </View>
  );
}
