import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ChevronDown, Mic, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { toast } from '@/components/Toast';
import { Button, Field, Item, Note, PressableScale, Text, Toggle } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { shouldAskNotifications } from '@/lib/notifications';
import { useOnline } from '@/lib/online';
import { useCurrentVehicle, useExpenses, useIsGuest, useRecordCategories, useServiceTypes, useVehicle, useVehicleLogs } from '@/lib/queries';
import { expenseChip, topChips } from '@/lib/quickAdd';
import { cleanDetails, LOG_FIELDS, SAVE_LOG_KEY, type SaveLogInput } from '@/lib/saveLog';
import { pickOption } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';

// The + button: one sheet that saves a maintenance record or a running cost in one step (docs/ux-mockup, states #sheet and #fuel).
// Opened with ?serviceTypeId (+ ?vehicleId) to start on one service, e.g. from a reminder.
// Chips by identity: a service is its service_types id; a running cost is `x:<expense_code>` (fuel, wash …). Defaults by name_en / code.
const DEFAULTS = ['Oil Change', expenseChip('fuel'), expenseChip('wash'), 'Tire Replacement', 'Brake Pad Replacement', 'Battery Replacement'];
const num = (s: string) => (s.trim() && !isNaN(Number(s)) ? Number(s) : null);
// Typed numbers: Arabic-Indic digits become Latin, everything but digits (and one point, if `dec`) is dropped.
const clean = (s: string, dec = false) => {
  const v = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(dec ? /[^\d.]/g : /\D/g, '');
  return dec ? v.replace(/\./g, (m, i) => (v.indexOf('.') === i ? m : '')) : v;
};
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA'); // local date, never toISOString
};

export default function CaptureSheet() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { serviceTypeId, vehicleId } = useLocalSearchParams<{ serviceTypeId?: string; vehicleId?: string }>();
  const current = useCurrentVehicle().vehicle;
  const picked = useVehicle(vehicleId).vehicle;
  const vehicle = picked ?? current;
  const connected = useOnline();
  const guest = useIsGuest();
  const online = connected || !guest; // Q93: full accounts can record offline (it waits on the phone); guests can't
  const services = (useServiceTypes().data ?? []).filter((s) => s.category_id); // a retired one (Car Wash) is never offered
  const tree = useRecordCategories().data ?? [];
  const costs = tree.filter((x) => x.expense_code);
  const logs = useVehicleLogs(vehicle?.id).data ?? [];
  const spent = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicle?.id);
  const ar = i18n.language === 'ar';
  const name = (x: { name_en: string; name_ar: string }) => (ar ? x.name_ar : x.name_en);

  const [chip, setChip] = useState<string | null>(serviceTypeId ?? null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(daysAgo(0));
  const [liters, setLiters] = useState('');
  const [fullTank, setFullTank] = useState(true); // consumption is measured between full tanks (Q91)
  const [more, setMore] = useState(false);
  const [odo, setOdo] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [every, setEvery] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const service = services.find((s) => s.id === chip);
  const cost = chip?.startsWith('x:') ? costs.find((x) => expenseChip(x.expense_code!) === chip) : undefined;
  const fuel = chip === expenseChip('fuel');
  const fields = (service?.fields ?? []).filter((f) => f in LOG_FIELDS);
  const label = (id: string) => {
    const s = services.find((x) => x.id === id);
    const x = costs.find((k) => expenseChip(k.expense_code!) === id);
    return s ? name(s) : x ? name(x) : '';
  };

  // The owner's most used first, then the defaults. Only what exists in the catalog is offered.
  const defaults = DEFAULTS.map((d) => (d.startsWith('x:') ? d : services.find((s) => s.name_en === d)?.id)).filter((id): id is string => !!id && !!label(id));
  const known = new Set([...services.map((s) => s.id), ...costs.map((x) => expenseChip(x.expense_code!))]);
  const chips = topChips(
    logs.filter((l) => l.service_type_id && known.has(l.service_type_id)),
    spent.filter((e) => known.has(expenseChip(e.category))),
    defaults.filter((id) => label(id)),
  );
  if (chip && !chips.includes(chip) && label(chip)) chips.push(chip); // chosen from "More"

  const choose = (id: string) => {
    setChip(id);
    setDetails({});
    setEvery('');
  };
  const openMore = () =>
    pickOption({
      title: t('capture.manual.serviceType'),
      allowCustom: false,
      options: [
        ...services.map((s) => {
          const where = [s.parentCategory, s.subcategory].filter(Boolean).map((x) => name(x!)).join(' · ');
          const other = [s.parentCategory, s.subcategory].filter(Boolean).map((x) => (ar ? x!.name_en : x!.name_ar)).join(' · ');
          return { id: s.id, label: name(s), hint: where, also: `${ar ? s.name_en : s.name_ar} ${other}` };
        }),
        ...costs.map((x) => ({ id: expenseChip(x.expense_code!), label: name(x), hint: t('capture.quick.runningCost'), also: ar ? x.name_en : x.name_ar })),
      ],
      onPick: ({ id }) => choose(id!),
    });

  // ponytail: the "Other" day is a list of the last 30 days; a native date picker later (expo-ui DateTimePicker).
  const otherDay = () =>
    pickOption({
      title: t('expenses.date'),
      allowCustom: false,
      options: Array.from({ length: 30 }, (_, i) => {
        const d = daysAgo(i);
        return { id: d, label: format(new Date(`${d}T00:00:00`), 'EEEE d MMMM', { locale: ar ? arLocale : enUS }) };
      }),
      onPick: ({ id }) => setDate(id!),
    });

  const attach = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  };

  const voice = () => {
    useLogDraft.getState().reset({ vehicleId: vehicle?.id ?? null, source: 'voice' });
    // replace() from a formSheet only closes the sheet on iOS, so close it, then push the full screen.
    router.back();
    router.push('/capture/voice');
  };

  const refresh = () => {
    for (const key of ['vehicles', 'logs', 'expenses']) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const undoToast = (undo: () => PromiseLike<unknown> | void) =>
    toast(t('capture.quick.saved'), {
      label: t('capture.quick.undo'),
      // ponytail: a real delete; stage 2 replaces this with soft delete.
      onPress: async () => {
        await undo();
        refresh();
      },
    });

  const save = useMutation<{ id: string; status: string }, Error, SaveLogInput>({ mutationKey: SAVE_LOG_KEY });
  const finish = async (reminds: boolean, params: Record<string, string>) => {
    router.back(); // not replace(): that only closes a formSheet
    if (reminds && (await shouldAskNotifications())) router.push({ pathname: '/notify-permission', params }); // Q39: once, after the first saved log
  };

  const submit = async () => {
    setError(null);
    if (!vehicle || !chip) return;
    if (cost) {
      setBusy(true);
      const l = fuel && Number(liters) > 0 ? Number(liters) : null;
      const reading = fuel && odo.trim() && Number(odo) >= 0 ? Math.round(Number(odo)) : null;
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          vehicle_id: vehicle.id,
          category: cost.expense_code!,
          amount: Number(amount),
          expense_date: date,
          description: workshop.trim() || null,
          liters: l,
          odometer_reading: reading,
          full_tank: fuel ? fullTank : true,
        })
        .select('id')
        .single();
      setBusy(false);
      if (error) return setError(errorText(error));
      refresh();
      router.back();
      return undoToast(() => supabase.from('expenses').delete().eq('id', data.id));
    }
    const reminds = !!service?.has_reminder;
    const input: SaveLogInput = {
      vehicleId: vehicle.id,
      serviceTypeId: service!.id,
      title: name(service!),
      odometer: num(odo),
      cost: num(amount),
      serviceDate: date,
      location: workshop,
      notes,
      source: 'manual',
      transcript: null,
      parts: [],
      intervalKm: reminds ? num(every) : null,
      details: cleanDetails(details, service!.fields),
      photoUri: onlineManager.isOnline() ? photoUri : null, // Q45: a receipt photo needs a connection
    };
    const params = {
      kind: 'log',
      vehicleId: vehicle.id,
      serviceTypeId: service!.id,
      ...(input.odometer != null ? { odo: String(input.odometer) } : {}),
      date,
    };
    const mutations = queryClient.getMutationCache();
    const queued = () => mutations.find({ mutationKey: SAVE_LOG_KEY, predicate: (m) => m.state.variables === input });
    // Undo: a log that reached the server is deleted (with the cost row the database made from it: the link only goes null on delete);
    // one still waiting offline is dropped from the queue.
    const undo = async () => {
      const m = queued();
      const log = m?.state.data as { id: string } | undefined;
      if (!m || !log) return m && mutations.remove(m);
      await supabase.from('expenses').delete().eq('log_id', log.id).eq('from_log', true);
      await supabase.from('maintenance_logs').delete().eq('id', log.id);
    };
    if (!onlineManager.isOnline()) {
      save.mutate(input);
      finish(reminds, { ...params, offline: '1' });
      return undoToast(undo);
    }
    try {
      await save.mutateAsync(input);
    } catch (e) {
      return setError(errorText(e as Error));
    }
    finish(reminds, params);
    undoToast(undo);
  };

  const valid = !!vehicle && !!chip && (cost ? Number(amount) > 0 : !amount.trim() || Number(amount) > 0);
  const day = date === daysAgo(0) ? 'today' : date === daysAgo(1) ? 'yesterday' : 'other';

  return (
    // A formSheet lays out one scroll view as its root; a header or footer beside it gets hidden under it.
    <ScrollView
      className="flex-1 rounded-t-screen border-t border-line bg-sheet"
      contentContainerClassName="gap-4 px-6 pt-8"
      contentContainerStyle={{ paddingBottom: bottom + 16 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <View className="flex-row items-center justify-between">
        <Text variant="heading">{t('capture.newRecord')}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
        <PressableScale
          accessibilityRole="button"
          onPress={voice}
          disabled={!online}
          className={`h-14 flex-row items-center justify-center gap-3 rounded-item bg-panel ${online ? '' : 'opacity-50'}`}>
          <Mic size={22} color="#D3F53D" />
          <Text variant="label" className="text-onpanel">{t(online ? 'capture.quick.say' : 'feedback.offline.voiceSheet')}</Text>
        </PressableScale>
        <Text variant="caption" className="text-muted">{t('capture.quick.mostUsed')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {chips.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: chip === id }}
              onPress={() => choose(id)}
              className={`h-11 justify-center rounded-nav px-4 ${chip === id ? 'bg-ink' : 'bg-line'}`}>
              <Text variant="caption" className={chip === id ? 'text-paper' : 'text-muted'}>{label(id)}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={openMore} className="h-11 justify-center rounded-nav bg-line px-4">
            <Text variant="caption" className="text-muted">{t('capture.quick.more')}</Text>
          </Pressable>
        </View>
        {chip ? (
          <>
            <View className="flex-row gap-4">
              <Field className="flex-1" label={t('expenses.amount')} value={amount} onChangeText={(v) => setAmount(clean(v, true))} keyboardType="decimal-pad" placeholder="0" autoFocus />
              {fuel ? <Field className="flex-1" label={t('expenses.liters')} value={liters} onChangeText={(v) => setLiters(clean(v, true))} keyboardType="decimal-pad" placeholder={t('expenses.optional')} /> : null}
            </View>
            {fuel ? (
              <>
                <View className="flex-row items-center gap-3 rounded-field bg-white p-4">
                  <View className="flex-1 gap-0.5">
                    <Text variant="label">{t('expenses.fullTank')}</Text>
                    <Text variant="caption" className="text-muted">{t('expenses.fullTankHint')}</Text>
                  </View>
                  <Toggle value={fullTank} onChange={setFullTank} label={t('expenses.fullTank')} />
                </View>
                <Field label={t('expenses.reading')} value={odo} onChangeText={(v) => setOdo(clean(v))} keyboardType="number-pad" placeholder={t('expenses.optional')} />
              </>
            ) : null}
            <View className="gap-2">
              <Text variant="caption" className="text-muted">{t('expenses.date')}</Text>
              <View className="flex-row gap-2">
                {(['today', 'yesterday', 'other'] as const).map((k) => (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityState={{ selected: day === k }}
                    onPress={() => (k === 'other' ? otherDay() : setDate(daysAgo(k === 'today' ? 0 : 1)))}
                    className={`h-11 justify-center rounded-nav px-4 ${day === k ? 'bg-ink' : 'bg-line'}`}>
                    <Text variant="caption" className={day === k ? 'text-paper' : 'text-muted'}>
                      {k === 'other' && day === 'other' ? format(new Date(`${date}T00:00:00`), 'd MMM', { locale: ar ? arLocale : enUS }) : t(`capture.quick.${k}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setMore(!more)} className="h-11 flex-row items-center justify-between">
              <Text variant="label">{t('capture.quick.moreDetails')}</Text>
              <ChevronDown size={20} color={c.muted} style={{ transform: [{ rotate: more ? '180deg' : '0deg' }] }} />
            </Pressable>
            {more ? (
              <View className="gap-4">
                {fuel ? null : service ? (
                  <Field label={t('capture.manual.odometer')} value={odo} onChangeText={(v) => setOdo(clean(v))} keyboardType="number-pad" placeholder={t('capture.manual.optional')} />
                ) : null}
                <Field
                  label={t(service ? 'capture.manual.workshop' : 'expenses.place')}
                  value={workshop}
                  onChangeText={setWorkshop}
                  placeholder={t('capture.manual.optional')}
                />
                {fields.map((f) => (
                  <Field
                    key={f}
                    label={t(`capture.fields.${f}`)}
                    value={details[f] ?? ''}
                    onChangeText={(v) => setDetails({ ...details, [f]: v })}
                    keyboardType={LOG_FIELDS[f]}
                    placeholder={t('capture.manual.optional')}
                  />
                ))}
                {service?.has_reminder ? (
                  <Field
                    label={t('capture.manual.interval')}
                    value={every}
                    onChangeText={(v) => setEvery(clean(v))}
                    keyboardType="number-pad"
                    placeholder={service.default_interval_km != null ? service.default_interval_km.toLocaleString('en-US') : t('capture.manual.optional')}
                  />
                ) : null}
                {service ? <Field label={t('capture.manual.notes')} value={notes} onChangeText={setNotes} placeholder={t('capture.manual.optional')} multiline /> : null}
                {service ? (
                  <Item
                    icon={Camera}
                    tone="sky"
                    title={t('capture.manual.attach')}
                    subtitle={t(!connected ? 'toast.photoOffline' : photoUri ? 'capture.manual.attached' : 'capture.manual.attachSub')}
                    onPress={attach}
                    disabled={!connected}
                    style={{ opacity: connected ? 1 : 0.5 }}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
        {error ? <Note tone="warning" text={error} /> : null}
        <Button title={t('capture.quick.save')} onPress={submit} disabled={!valid} loading={busy || save.isPending} />
    </ScrollView>
  );
}
