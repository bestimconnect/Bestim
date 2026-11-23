import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Camera, Gauge, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { KEYBOARD_DONE_ID } from '@/components/KeyboardDone';
import { toast } from '@/components/Toast';
import { Button, Note, OptionPill, PressableScale, Text } from '@/components/ui';
import { blockFeature, useEntitlements } from '@/lib/entitlements';
import { errorText } from '@/lib/errors';
import { clean } from '@/lib/numberInput';
import { useOnline } from '@/lib/online';
import { useCurrentVehicle, useVehicle } from '@/lib/queries';
import { refreshRecords } from '@/lib/removeRecord';
import { pickOption } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';

// "New expense" sheet (design-v2 flow 7, #3): a big amount, four category pills, the reading and the day, a receipt photo, Save.
// Opened as /capture?mode=expense (the registered bottom sheet). Editing an existing expense still uses the full capture sheet.
const CATS = ['fuel', 'maintenance', 'parts', 'other'] as const;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA'); // local date, never toISOString
};

export function AddExpense() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const qc = useQueryClient();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const current = useCurrentVehicle().vehicle;
  const vehicle = useVehicle(vehicleId).vehicle ?? current;
  const ent = useEntitlements().data;
  const online = useOnline();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('fuel');
  const [odo, setOdo] = useState('');
  const [date, setDate] = useState(daysAgo(0));
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const arabic = i18n.language === 'ar';
  const locale = arabic ? arLocale : enUS;
  const reading = odo.trim() ? Math.round(Number(odo)) : null;
  const tooLow = reading != null && date === daysAgo(0) && cat === 'fuel' && reading < (vehicle?.current_odometer ?? 0);
  const valid = !!vehicle && Number(amount) > 0 && !tooLow;
  const when = date === daysAgo(0) ? t('capture.quick.today') : date === daysAgo(1) ? t('capture.quick.yesterday') : format(new Date(`${date}T00:00:00`), 'd MMM', { locale });

  const pickDay = () =>
    pickOption({
      title: t('expenses.date'),
      allowCustom: false,
      options: Array.from({ length: 30 }, (_, i) => {
        const d = daysAgo(i);
        return { id: d, label: format(new Date(`${d}T00:00:00`), 'EEEE d MMMM', { locale }) };
      }),
      onPick: ({ id }) => setDate(id!),
    });

  const attach = async () => {
    if (blockFeature(ent, 'receipt_photos')) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) setPhoto(r.assets[0].uri);
  };

  const save = async () => {
    if (!vehicle || !valid) return;
    setBusy(true);
    setError(null);
    try {
      let receipt: string | null = null;
      if (photo && online) {
        const userId = (await supabase.auth.getSession()).data.session?.user.id;
        if (userId) {
          const path = `${userId}/${Date.now()}.jpg`;
          const up = await supabase.storage.from('receipts').upload(path, await (await fetch(photo)).arrayBuffer(), { contentType: 'image/jpeg' });
          if (up.error) throw up.error;
          receipt = path;
        }
      }
      const { data, error: failed } = await supabase
        .from('expenses')
        .insert({
          vehicle_id: vehicle.id,
          category: cat,
          amount: Number(amount),
          expense_date: date,
          odometer_reading: cat === 'fuel' ? reading : null, // a reading on a fuel stop feeds the consumption maths; elsewhere it is not kept
          receipt_url: receipt,
        })
        .select('id')
        .single();
      if (failed) throw failed;
      refreshRecords(qc);
      router.back();
      toast(t('capture.quick.saved'), {
        label: t('capture.quick.undo'),
        onPress: async () => {
          await supabase.from('expenses').delete().eq('id', data.id);
          refreshRecords(qc);
        },
      });
    } catch (e) {
      setError(errorText(e as Error));
      setBusy(false);
    }
  };

  return (
    // A formSheet lays out one scroll view as its root; a header or footer beside it gets hidden under it.
    <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-3 px-5 pt-3" contentContainerStyle={{ paddingBottom: bottom + 16 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View className="h-1 w-[38px] self-center rounded-full bg-tick" />
      <View className="flex-row items-center justify-between">
        <Text variant="heading">{t('expenses.sheet.title')}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={router.back} className="h-10 w-10 items-center justify-center rounded-full bg-paper">
          <X size={18} color={c.ink} />
        </PressableScale>
      </View>

      {/* The amount: big and thin, the currency beside it. */}
      <View className="gap-1 rounded-[24px] bg-paper px-4 pb-4 pt-3.5">
        <Text variant="caption" className="text-muted">{t('expenses.sheet.amount')}</Text>
        <View className="flex-row items-end justify-end gap-2" style={{ direction: 'ltr' }}>
          <Text variant="caption" className="pb-3 text-muted">{t('expenses.currency')}</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(clean(v, true))}
            keyboardType="decimal-pad"
            returnKeyType="done"
            inputAccessoryViewID={KEYBOARD_DONE_ID}
            placeholder="0"
            placeholderTextColor={c.tick}
            autoFocus
            accessibilityLabel={t('expenses.sheet.amount')}
            className="min-w-[60px] p-0 text-ink"
            style={{ fontFamily: 'Poppins_300Light', fontSize: 56, lineHeight: 64, letterSpacing: -2.2, textAlign: 'right', fontVariant: ['tabular-nums'] }}
          />
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {CATS.map((k) => (
          <OptionPill key={k} size="sm" className="px-4" label={t(`expenses.chip.${k}`)} selected={cat === k} onPress={() => setCat(k)} />
        ))}
      </View>

      <View className="flex-row gap-2.5">
        <View className="h-[52px] flex-1 flex-row items-center gap-2 rounded-[18px] bg-paper px-3.5">
          <Gauge size={16} color={c.muted} />
          <TextInput
            value={odo}
            onChangeText={(v) => setOdo(clean(v))}
            keyboardType="number-pad"
            returnKeyType="done"
            inputAccessoryViewID={KEYBOARD_DONE_ID}
            placeholder={t('expenses.sheet.reading', { n: (vehicle?.current_odometer ?? 0).toLocaleString('en-US') })}
            placeholderTextColor={c.muted}
            accessibilityLabel={t('expenses.reading')}
            className="min-w-0 flex-1 p-0 text-ink"
            style={{ fontSize: 14, textAlign: 'auto', fontFamily: arabic ? 'Tajawal_500Medium' : 'Poppins_500Medium' }}
          />
        </View>
        <PressableScale accessibilityRole="button" onPress={pickDay} className="h-[52px] flex-row items-center gap-2 rounded-[18px] bg-paper px-3.5">
          <Calendar size={16} color={c.muted} />
          <Text variant="caption" className="text-ink">{when}</Text>
        </PressableScale>
      </View>
      {tooLow ? <Text variant="caption" className="px-1 text-danger">{t('errors.lowerReading')}</Text> : null}

      <PressableScale
        accessibilityRole="button"
        onPress={attach}
        disabled={!online}
        className={`min-h-[64px] flex-row items-center gap-3 rounded-[24px] bg-paper px-4 py-3 ${online ? '' : 'opacity-50'}`}
        style={{ boxShadow: shadows.hair }}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <Camera size={20} color={c.ink} />
        </View>
        <View className="flex-1">
          <Text variant="label" numberOfLines={1}>{t('expenses.sheet.receipt')}</Text>
          <Text variant="caption" className="text-muted" numberOfLines={2}>{t(!online ? 'toast.photoOffline' : photo ? 'capture.manual.attached' : 'expenses.sheet.receiptSub')}</Text>
        </View>
      </PressableScale>

      {error ? <Note tone="warning" text={error} /> : null}
      <Button title={t('capture.quick.save')} onPress={save} disabled={!valid} loading={busy} />
    </ScrollView>
  );
}
