import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ChevronDown, Mic, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { toast } from '@/components/Toast';
import { Button, Field, Item, Note, PressableScale, Text, Toggle } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { shouldAskNotifications } from '@/lib/notifications';
import { useOnline } from '@/lib/online';
import { useCurrentVehicle, useExpenses, useLog, useRecordCategories, useServiceTypes, useVehicle, useVehicleLogs } from '@/lib/queries';
import { expenseChip, isFresh, topChips } from '@/lib/quickAdd';
import { refreshRecords, removeRecord } from '@/lib/removeRecord';
import { cleanDetails, LOG_FIELDS, SAVE_LOG_KEY, type SaveLogInput } from '@/lib/saveLog';
import { pickOption } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';
import { useVoiceBatch } from '@/stores/voiceBatch';
import type { ExpenseCategory } from '@/lib/voiceRecords';

// The + button: one sheet that saves a maintenance record or a running cost in one step (docs/ux-mockup, states #sheet and #fuel).
// Opened with ?serviceTypeId (+ ?vehicleId) to start on one service, e.g. from a reminder.
// Opened with ?logId or ?expenseId it edits that record instead: free for 24 hours, then with a reason (correct_log); Delete has Undo.
// Opened with ?batch=<key> it edits one card of the voice review list (capture/review-all) and Save writes back to that list, not the database.
// Opened with ?notice=<micDenied|aiFailed|dailyLimit> (voice fallbacks) it shows that line on top.
// Chips by identity: a service is its service_types id; a running cost is `x:<expense_code>` (fuel, wash …). Defaults by name_en / code.
const DEFAULTS = ['Oil Change', expenseChip('fuel'), expenseChip('wash'), 'Tire Replacement', 'Brake Pad Replacement', 'Battery Replacement'];
const NOTICES = { micDenied: 'capture.micDenied', aiFailed: 'capture.batch.aiFailed', dailyLimit: 'capture.batch.dailyLimit' } as const;
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
  const { serviceTypeId, vehicleId, logId, expenseId, batch, notice } = useLocalSearchParams<{ serviceTypeId?: string; vehicleId?: string; logId?: string; expenseId?: string; batch?: string; notice?: keyof typeof NOTICES }>();
  const [card] = useState(() => useVoiceBatch.getState().records.find((r) => r.key === batch)); // odometer cards are edited in the list itself
  const editing = !!(logId || expenseId || card);
  const costKind = expenseId ? true : logId ? false : card ? card.kind === 'expense' : undefined; // a record keeps its kind
  const log = useLog(logId).data;
  const allSpent = useExpenses().data ?? [];
  const expense = allSpent.find((e) => e.id === expenseId);
  const current = useCurrentVehicle().vehicle;
  const picked = useVehicle(vehicleId ?? log?.vehicle_id ?? expense?.vehicle_id ?? card?.vehicleId).vehicle;
  const vehicle = picked ?? current;
  const connected = useOnline();
  const services = (useServiceTypes().data ?? []).filter((s) => s.category_id); // a retired one (Car Wash) is never offered
  const tree = useRecordCategories().data ?? [];
  const costs = tree.filter((x) => x.expense_code);
  const logs = useVehicleLogs(vehicle?.id).data ?? [];
  const spent = allSpent.filter((e) => e.vehicle_id === vehicle?.id);
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
  const [filled, setFilled] = useState(!editing); // edit mode: the form waits for the record
  const [needsReason, setNeedsReason] = useState(false); // the server said the record is older than it looked
  const [reason, setReason] = useState('');

  const service = services.find((s) => s.id === chip);
  const code = chip?.startsWith('x:') ? chip.slice(2) : null; // a running cost's expense code
  const reasonMode = !!log && (!isFresh(log.created_at) || needsReason);
  const fuel = chip === expenseChip('fuel');
  const fields = (service?.fields ?? []).filter((f) => f in LOG_FIELDS);
  const cardChip = card?.kind === 'maintenance' ? (services.find((s) => s.name_en === card.serviceType)?.id ?? null) : card?.kind === 'expense' && card.category ? expenseChip(card.category) : null;
  const ready = services.length > 0;
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
  ).filter((id) => costKind === undefined || id.startsWith('x:') === costKind);
  if (chip && !chips.includes(chip) && label(chip)) chips.push(chip); // chosen from "More"

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (filled) return;
    const s = (n: number | null) => (n != null ? String(n) : '');
    if (log) {
      setChip(log.service_type_id);
      setAmount(s(log.cost));
      setDate(log.service_date);
      setOdo(s(log.odometer_reading));
      setWorkshop(log.location ?? '');
      setDetails(Object.fromEntries(Object.entries((log.details ?? {}) as Record<string, string | number>).map(([k, v]) => [k, String(v)])));
      setEvery(s(log.interval_km));
      setNotes(log.description ?? '');
    } else if (expense) {
      setChip(expenseChip(expense.category));
      setAmount(String(expense.amount));
      setDate(expense.expense_date);
      setLiters(s(expense.liters));
      setFullTank(expense.full_tank ?? true);
      setOdo(s(expense.odometer_reading));
      setWorkshop(expense.description ?? '');
    } else if (card?.kind === 'maintenance') {
      if (!ready) return; // the service is found by name
      setChip(cardChip);
      setAmount(s(card.cost));
      setDate(card.date ?? daysAgo(0));
      setOdo(s(card.odometer));
      setWorkshop(card.location);
      setDetails(Object.fromEntries(Object.entries(card.details ?? {}).map(([k, v]) => [k, String(v)])));
      setEvery(s(card.intervalKm));
      setNotes(card.notes);
      setPhotoUri(card.photoUri);
    } else if (card?.kind === 'expense') {
      setChip(cardChip);
      setAmount(s(card.amount));
      setDate(card.date ?? daysAgo(0));
      setLiters(s(card.liters));
      setOdo(s(card.odometer));
      setWorkshop(card.place);
    } else return;
    setMore(true);
    setFilled(true);
  }, [log, expense, card, cardChip, ready, filled]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        ...(costKind ? [] : services).map((s) => {
          const where = [s.parentCategory, s.subcategory].filter(Boolean).map((x) => name(x!)).join(' · ');
          const other = [s.parentCategory, s.subcategory].filter(Boolean).map((x) => (ar ? x!.name_en : x!.name_ar)).join(' · ');
          return { id: s.id, label: name(s), hint: where, also: `${ar ? s.name_en : s.name_ar} ${other}` };
        }),
        ...(costKind === false ? [] : costs).map((x) => ({ id: expenseChip(x.expense_code!), label: name(x), hint: t('capture.quick.runningCost'), also: ar ? x.name_en : x.name_ar })),
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
    useLogDraft.getState().reset({ vehicleId: vehicle?.id ?? null });
    // replace() from a formSheet only closes the sheet on iOS, so close it, then push the full screen.
    router.back();
    router.push('/capture/voice');
  };

  const refresh = () => refreshRecords(queryClient);
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

  // Editing a maintenance record: a direct update while it is fresh; later, the changes go through correct_log with the reason.
  const editLog = async () => {
    const o = log!;
    const s = service!;
    const next: Record<string, string | number | null> = {
      title: s.id === o.service_type_id ? o.title : name(s),
      service_type_id: s.id,
      odometer_reading: num(odo),
      cost: num(amount),
      service_date: date,
      location: workshop.trim() || null,
      description: notes.trim() || null,
      interval_km: s.has_reminder ? num(every) : o.interval_km,
    };
    const changes = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== (o as Record<string, unknown>)[k]));
    const det = cleanDetails(details, s.fields);
    const detailsChanged = JSON.stringify(det) !== JSON.stringify(o.details ?? {});
    if (!Object.keys(changes).length && !detailsChanged) return router.back();
    setBusy(true);
    let failed: { message?: string } | null = null;
    if (reasonMode) {
      // details are not part of the audited fields, so they are written directly
      const text = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v == null ? null : String(v)]));
      if (Object.keys(changes).length) failed = (await supabase.rpc('correct_log', { log_id: o.id, changes: text, reason: reason.trim() })).error;
      if (!failed && detailsChanged) failed = (await supabase.from('maintenance_logs').update({ details: det }).eq('id', o.id)).error;
    } else {
      failed = (await supabase.from('maintenance_logs').update(detailsChanged ? { ...changes, details: det } : changes).eq('id', o.id)).error;
    }
    setBusy(false);
    if (/needs_reason/.test(failed?.message ?? '')) return setNeedsReason(true);
    if (failed) return setError(errorText(failed));
    refresh();
    router.back();
    toast(t('capture.quick.saved'));
  };

  const remove = () => {
    router.dismiss(logId ? 2 : 1); // a log's sheet sits on its details page
    removeRecord(queryClient, logId ? 'maintenance_logs' : 'expenses', (logId ?? expenseId)!);
  };

  const submit = async () => {
    setError(null);
    if (!vehicle || !chip) return;
    if (logId) return editLog();
    if (batch) {
      const fillUp = fuel && Number(liters) > 0 ? Number(liters) : null;
      useVoiceBatch.getState().update(
        batch,
        code
          ? { category: code as ExpenseCategory, amount: Number(amount), date, place: workshop.trim(), liters: fillUp, odometer: fuel && odo.trim() && Number(odo) >= 0 ? Math.round(Number(odo)) : null, error: undefined }
          : {
              serviceType: service!.name_en,
              title: card?.kind === 'maintenance' && card.serviceType === service!.name_en ? card.title : '',
              odometer: num(odo),
              cost: num(amount),
              date,
              location: workshop.trim(),
              notes: notes.trim(),
              photoUri,
              intervalKm: service!.has_reminder ? num(every) : null,
              details: cleanDetails(details, service!.fields),
              error: undefined,
            },
      );
      return router.back();
    }
    if (code) {
      setBusy(true);
      const l = fuel && Number(liters) > 0 ? Number(liters) : null;
      const reading = fuel && odo.trim() && Number(odo) >= 0 ? Math.round(Number(odo)) : null;
      const row = {
        category: code,
        amount: Number(amount),
        expense_date: date,
        description: workshop.trim() || null,
        liters: l,
        odometer_reading: reading,
        full_tank: fuel ? fullTank : true,
      };
      const { data, error } = await (expenseId
        ? supabase.from('expenses').update(row).eq('id', expenseId)
        : supabase.from('expenses').insert({ vehicle_id: vehicle.id, ...row })
      ).select('id').single();
      setBusy(false);
      if (error) return setError(errorText(error));
      refresh();
      router.back();
      if (expenseId) return toast(t('capture.quick.saved'));
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

  // A record dated today can't carry a reading below the car's (older dates are history; an edit may fix the record that set the reading).
  const tooLow = !editing && date === daysAgo(0) && odo.trim() !== '' && (!code || fuel) && Number(odo) < (vehicle?.current_odometer ?? 0);
  const valid =
    filled && !!vehicle && !!chip && !tooLow &&
    (code ? Number(amount) > 0 : !amount.trim() || Number(amount) > 0) &&
    (!logId || !!service) &&
    (!reasonMode || reason.trim().length >= 3);
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
        <Text variant="heading">{t(editing ? 'capture.quick.editTitle' : 'capture.newRecord')}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
        {notice && NOTICES[notice] ? <Note tone="info" text={t(NOTICES[notice])} /> : null}
        {editing ? null : (
        <PressableScale
          accessibilityRole="button"
          onPress={voice}
          className="h-14 flex-row items-center justify-center gap-3 rounded-item bg-panel">
          <Mic size={22} color="#D3F53D" />
          <Text variant="label" className="text-onpanel">{t('capture.quick.say')}</Text>
        </PressableScale>
        )}
        {editing ? null : <Text variant="caption" className="text-muted">{t('capture.quick.mostUsed')}</Text>}
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
                <Field label={t('expenses.reading')} value={odo} onChangeText={(v) => setOdo(clean(v))} keyboardType="number-pad" placeholder={t('expenses.optional')} error={tooLow ? t('errors.lowerReading') : undefined} />
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
                  <Field label={t('capture.manual.odometer')} value={odo} onChangeText={(v) => setOdo(clean(v))} keyboardType="number-pad" placeholder={t('capture.manual.optional')} error={tooLow ? t('errors.lowerReading') : undefined} />
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
        {reasonMode ? (
          <>
            <Field label={t('capture.quick.why')} value={reason} onChangeText={setReason} multiline />
            <Text variant="caption" className="text-muted">{t('capture.quick.originalStays')}</Text>
          </>
        ) : null}
        {error ? <Note tone="warning" text={error} /> : null}
        <Button title={t('capture.quick.save')} onPress={submit} disabled={!valid} loading={busy || save.isPending} />
        {(logId || expenseId) && filled ? (
          <Pressable accessibilityRole="button" onPress={remove} className="h-11 items-center justify-center">
            <Text variant="label" className="text-danger">{t('capture.quick.delete')}</Text>
          </Pressable>
        ) : null}
    </ScrollView>
  );
}
