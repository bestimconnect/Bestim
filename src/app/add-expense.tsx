import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Link2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { I18nManager, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, Note, Text, Toggle } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { useCurrentVehicle, useIsGuest, useRecordCategories, useVehicle, useVehicleLogs } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { shadows } from '@/lib/theme';
import { EXPENSE_CATEGORIES, type ExpenseRecord } from '@/lib/voiceRecords';
import { useVoiceBatch } from '@/stores/voiceBatch';

// Screen 24 — Add expense (167:67164); decisions Q26, Q28, Q29, Q31.
// With ?batch it edits one expense card of the voice review list and writes back instead of saving (Q69).
type Cat = 'maintenance' | (typeof EXPENSE_CATEGORIES)[number];

export default function AddExpense() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const guest = useIsGuest();
  const { vehicleId, batch } = useLocalSearchParams<{ vehicleId?: string; batch?: string }>();
  const [card] = useState(() => useVoiceBatch.getState().records.find((r) => r.key === batch && r.kind === 'expense') as ExpenseRecord | undefined);
  const current = useCurrentVehicle().vehicle;
  const picked = useVehicle(vehicleId).vehicle;
  const vehicle = picked ?? current;
  // The chips are the tree's running-cost subcategories (the stored value is their expense code); the plain list is the fallback until the tree has loaded once.
  const costs = (useRecordCategories().data ?? []).filter((c) => c.expense_code);
  const codes = (costs.length ? costs.map((c) => c.expense_code) : EXPENSE_CATEGORIES) as Cat[];
  const chipLabel = (k: Cat) => {
    const c = costs.find((x) => x.expense_code === k);
    return c ? (i18n.language === 'ar' ? c.name_ar : c.name_en) : t(`expenses.chip.${k}`);
  };
  const logs = (useVehicleLogs(vehicle?.id).data ?? []).slice(0, 20);
  const [category, setCategory] = useState<Cat | null>(card ? card.category : 'maintenance'); // null: a voice card whose category the owner must choose
  const amountRef = useRef<TextInput>(null);
  const [amount, setAmount] = useState(card?.amount != null ? String(card.amount) : '');
  const [date, setDate] = useState(card?.date ?? new Date().toLocaleDateString('en-CA'));
  const [place, setPlace] = useState(card?.place ?? '');
  const [liters, setLiters] = useState(card?.liters != null ? String(card.liters) : '');
  const [reading, setReading] = useState(card?.odometer != null ? String(card.odometer) : '');
  const [fullTank, setFullTank] = useState(true); // consumption is measured between full tanks (Q91)
  const [logId, setLogId] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const fuel = category === 'fuel';
      const l = fuel && Number(liters) > 0 ? Number(liters) : null;
      const odo = fuel && reading.trim() && Number(reading) >= 0 ? Math.round(Number(reading)) : null;
      if (batch) {
        const patch: Partial<ExpenseRecord> = { category: category as ExpenseRecord['category'], amount: Number(amount), date, place: place.trim(), liters: l, odometer: odo };
        return useVoiceBatch.getState().update(batch, { ...patch, error: undefined });
      }
      const { error } = await supabase.from('expenses').insert({
        vehicle_id: vehicle!.id,
        category: category!,
        amount: Number(amount),
        expense_date: date,
        description: place.trim() || null,
        log_id: logId,
        liters: l,
        odometer_reading: odo,
        full_tank: fuel ? fullTank : true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      router.back();
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'expenses' } }} />;

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
  const valid = !!vehicle && !!category && Number(amount) > 0 && dateOk;
  const linked = logs.find((l) => l.id === logId);
  const vehicleName = vehicle ? vehicle.nickname || `${vehicle.make} ${vehicle.model}` : '';

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" className="flex-1">
        <Header title={t('expenses.add')} />
        <Text variant="caption" className="text-muted">{vehicleName}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {(batch ? codes : (['maintenance', ...codes] as Cat[])).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: category === k }}
              onPress={() => setCategory(k)}
              className={`h-11 justify-center rounded-nav px-4 ${category === k ? 'bg-ink' : 'bg-line'}`}>
              <Text variant="caption" className={category === k ? 'text-paper' : 'text-muted'}>{chipLabel(k)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {/* The whole card focuses the amount, not just the digits. */}
        <Pressable onPress={() => amountRef.current?.focus()} className="gap-1 rounded-metric bg-lime p-5" style={{ boxShadow: shadows.glow }}>
          <Text variant="caption" className="text-[#222E29]">{t('expenses.amount')}</Text>
          <TextInput
            ref={amountRef}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#222E2955"
            className="text-[36px] leading-[44px] text-[#222E29]"
            style={{ fontFamily: 'Poppins_700Bold', textAlign: I18nManager.isRTL ? 'right' : 'left' }}
          />
          <Text variant="caption" className="text-[#222E29]">EGP</Text>
        </Pressable>
        <Field
          label={t('expenses.date')}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          error={dateOk ? undefined : t('expenses.dateError')}
        />
        <Field label={t('expenses.place')} value={place} onChangeText={setPlace} placeholder={t('expenses.optional')} />
        {category === 'fuel' ? (
          <View className="flex-row gap-4">
            <Field className="flex-1" label={t('expenses.liters')} value={liters} onChangeText={setLiters} keyboardType="decimal-pad" placeholder={t('expenses.optional')} />
            <Field className="flex-1" label={t('expenses.reading')} value={reading} onChangeText={setReading} keyboardType="number-pad" placeholder={t('expenses.optional')} />
          </View>
        ) : null}
        {category === 'fuel' && !batch ? (
          <View className="flex-row items-center gap-3 rounded-field bg-white p-4">
            <View className="flex-1 gap-0.5">
              <Text variant="label">{t('expenses.fullTank')}</Text>
              <Text variant="caption" className="text-muted">{t('expenses.fullTankHint')}</Text>
            </View>
            <Toggle value={fullTank} onChange={setFullTank} label={t('expenses.fullTank')} />
          </View>
        ) : null}
        {batch ? null : (
          <Item
            icon={Link2}
            tone="sky"
            title={t('expenses.link')}
            subtitle={linked ? linked.title : t('expenses.optional')}
            onPress={() => setPick(!pick)}
          />
        )}
        {pick ? (
          <View className="gap-2">
            <Text variant="caption" className="text-muted">{t('expenses.linkPick')} · {t('expenses.linkHint')}</Text>
            {[null, ...logs].map((l) => (
              <Pressable
                key={l?.id ?? 'none'}
                onPress={() => {
                  setLogId(l?.id ?? null);
                  setPick(false);
                }}
                className={`rounded-field px-4 py-3 ${(l?.id ?? null) === logId ? 'bg-lime' : 'bg-white'}`}>
                <Text variant="label" className={(l?.id ?? null) === logId ? 'text-[#222E29]' : ''}>
                  {l ? l.title : t('expenses.noLink')}
                </Text>
                {l ? (
                  <Text variant="caption" className={(l?.id ?? null) === logId ? 'text-[#222E29]' : 'text-muted'}>
                    {format(new Date(l.service_date), 'd MMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS })}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        {error ? <Note tone="warning" text={error} /> : null}
      </ScrollView>
      <View className="px-6 pb-4 pt-2">
        <Button title={t(batch ? 'capture.batch.doneEdit' : 'expenses.save')} onPress={() => save.mutate()} disabled={!valid} loading={save.isPending} />
      </View>
    </SafeAreaView>
  );
}
