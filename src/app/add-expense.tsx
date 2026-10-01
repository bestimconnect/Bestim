import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Link2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { I18nManager, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, Note, Text } from '@/components/ui';
import { useCurrentVehicle, useIsGuest, useVehicle, useVehicleLogs } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

// Screen 24 — Add expense (167:67164); decisions Q26, Q28, Q29, Q31.
const cats = ['maintenance', 'fuel', 'parts', 'insurance', 'registration', 'other'] as const;
type Cat = (typeof cats)[number];

export default function AddExpense() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const guest = useIsGuest();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const current = useCurrentVehicle().vehicle;
  const picked = useVehicle(vehicleId).vehicle;
  const vehicle = picked ?? current;
  const logs = (useVehicleLogs(vehicle?.id).data ?? []).slice(0, 20);
  const [category, setCategory] = useState<Cat>('maintenance');
  const amountRef = useRef<TextInput>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [place, setPlace] = useState('');
  const [logId, setLogId] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('expenses').insert({
        vehicle_id: vehicle!.id,
        category,
        amount: Number(amount),
        expense_date: date,
        description: place.trim() || null,
        log_id: logId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      router.back();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'expenses' } }} />;

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
  const valid = !!vehicle && Number(amount) > 0 && dateOk;
  const linked = logs.find((l) => l.id === logId);
  const vehicleName = vehicle ? vehicle.nickname || `${vehicle.make} ${vehicle.model}` : '';

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" className="flex-1">
        <Header title={t('expenses.add')} />
        <Text variant="caption" className="text-muted">{vehicleName}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {cats.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: category === k }}
              onPress={() => setCategory(k)}
              className={`h-11 justify-center rounded-nav px-4 ${category === k ? 'bg-ink' : 'bg-line'}`}>
              <Text variant="caption" className={category === k ? 'text-paper' : 'text-muted'}>{t(`expenses.chip.${k}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {/* The whole card focuses the amount, not just the digits. */}
        <Pressable onPress={() => amountRef.current?.focus()} className="gap-1 rounded-metric bg-lime p-5" style={{ boxShadow: '0 8px 24px rgba(216,244,58,0.35)' }}>
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
        <Item
          icon={Link2}
          tone="sky"
          title={t('expenses.link')}
          subtitle={linked ? linked.title : t('expenses.optional')}
          onPress={() => setPick(!pick)}
        />
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
        <Button title={t('expenses.save')} onPress={() => save.mutate()} disabled={!valid} loading={save.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}
