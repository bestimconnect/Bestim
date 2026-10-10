import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { Gauge, Receipt, Wrench, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, Note, Text } from '@/components/ui';
import { shouldAskNotifications } from '@/lib/notifications';
import { useServiceTypes, useVehicles } from '@/lib/queries';
import { saveLog } from '@/lib/saveLog';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';
import { useVoiceBatch, type BatchRecord } from '@/stores/voiceBatch';

// Review what one voice recording produced: a card per record, edit or remove, then save them all
// (decisions Q58–Q69). No design PNG: built from the existing review (15) and item components.
const n = (v: number) => v.toLocaleString('en-US');
const ICONS = { maintenance: Wrench, expense: Receipt, odometer: Gauge };
const TONES = { maintenance: 'mint', expense: 'sky', odometer: 'paper' } as const;

export default function ReviewAll() {
  const { t, i18n } = useTranslation();
  const c = useColors();
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
  const subtitle = (r: BatchRecord) =>
    (r.kind === 'maintenance'
      ? [r.odometer != null ? reading(r, r.odometer) : null, r.cost != null ? money(r.cost) : null, day(r.date)]
      : r.kind === 'expense'
        ? [r.amount != null ? money(r.amount) : null, r.liters != null ? t('capture.batch.liters', { value: n(r.liters) }) : null, r.odometer != null ? reading(r, r.odometer) : null, r.place || null, day(r.date)]
        : [reading(r, r.reading)]
    ).filter(Boolean).join(' · ');

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
    if (r.kind === 'expense') return router.push({ pathname: '/add-expense', params: { batch: r.key, vehicleId: r.vehicleId } });
    useLogDraft.getState().reset({
      vehicleId: r.vehicleId,
      serviceTypeId: typeOf(r)?.id ?? null,
      title: title(r),
      odometer: r.odometer,
      cost: r.cost,
      serviceDate: r.date ?? today,
      location: r.location,
      notes: r.notes,
      source: 'voice',
      intervalKm: r.intervalKm,
      details: Object.fromEntries(Object.entries(r.details ?? {}).map(([k, v]) => [k, String(v)])),
      photoUri: r.photoUri,
    });
    router.push({ pathname: '/capture/manual', params: { batch: r.key } });
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
    const d = useLogDraft.getState();
    d.reset({ vehicleId: d.vehicleId, source });
    router.replace(source === 'voice' ? '/capture/voice' : '/capture/manual');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" className="flex-1">
        <Header title={t('capture.batch.header')} />
        <Text variant="title">{t(records.length ? 'capture.batch.title' : 'capture.batch.emptyTitle')}</Text>
        {transcript ? (
          <View className="gap-2 rounded-item bg-sky p-4">
            <Text variant="label">{t('capture.batch.transcript')}</Text>
            <Text variant="caption" className="text-muted">«{transcript}»</Text>
          </View>
        ) : null}
        {partial ? <Note tone="warning" text={t('capture.batch.partialFail', partial)} /> : null}
        {records.length === 0 ? (
          <Text className="text-muted">{t(understood ? 'capture.batch.emptyBody' : 'capture.batch.nothingUnderstood')}</Text>
        ) : null}
        {records.map((r) => {
          const vehicle = vehicleOf(r);
          const issue = problem(r);
          return (
            <View key={r.key} className="gap-1.5">
              <Text variant="caption" className="px-1 text-muted">
                {t(`capture.batch.kind.${r.kind}`)}
                {vehicles.length > 1 && vehicle ? ` · ${vehicle.nickname || `${vehicle.make} ${vehicle.model}`}` : ''}
              </Text>
              <Item
                icon={ICONS[r.kind]}
                tone={TONES[r.kind]}
                title={title(r)}
                subtitle={subtitle(r)}
                onPress={() => edit(r)}
                aside={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('capture.batch.remove')}
                    hitSlop={10}
                    onPress={() => remove(r.key)}
                    className="h-9 w-9 items-center justify-center rounded-full bg-paper">
                    <X size={16} color={c.muted} />
                  </Pressable>
                }
              />
              {r.kind === 'maintenance' && r.notes ? (
                <Text variant="caption" className="px-1 text-muted">{t('capture.batch.notes', { notes: r.notes })}</Text>
              ) : null}
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
                <Text variant="caption" className="px-1 text-danger">{r.error}</Text>
              ) : null}
            </View>
          );
        })}
        {records.length ? <Text variant="caption" className="text-muted">{t('capture.batch.tapHint')}</Text> : null}
      </ScrollView>
      <View className="gap-2 px-6 pb-4 pt-2">
        {records.length ? (
          <>
            {blocked ? <Note tone="alert" text={blocked} /> : null}
            <Button
              title={records.length === 1 ? t('capture.batch.saveOne') : t('capture.batch.saveMany', { count: records.length })}
              onPress={() => save.mutate()}
              disabled={!!blocked}
              loading={save.isPending}
            />
          </>
        ) : (
          <>
            <Button title={t('capture.batch.emptyAgain')} onPress={() => restart('voice')} />
            <Button variant="secondary" title={t('capture.batch.emptyManual')} onPress={() => restart('manual')} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
