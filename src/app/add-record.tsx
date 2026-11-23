import { useMutation } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ListTree, Plus, Repeat, Wrench } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { toast, toastError } from '@/components/Toast';
import { Button, Card, Chip, Field, FooterBar, PressableScale, Text } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { searchCatalog, type CatalogJob, type CatalogPart, type Hit } from '@/lib/catalogSearch';
import { useOnline } from '@/lib/online';
import { clean } from '@/lib/numberInput';
import { pickPhoto } from '@/lib/photo';
import { useCurrentVehicle, useServiceTypes } from '@/lib/queries';
import { SAVE_VISIT_KEY, type SaveVisitInput } from '@/lib/saveVisit';
import { bilingual, usePartSearch, useSpecialists, useTracked, useVisits, type CatalogPick } from '@/lib/services';
import { pickOption } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { buildJobs, jobTotal, num, type DraftJob } from '@/lib/visitDraft';
import { useColors } from '@/lib/theme';

// v2 flow 14 "Add a record by hand": ONE ladder. Find (due now, repeat last visit, recent, common, or type: jobs then parts, with Arabic aliases)
// → Quick form (job + total cost + Save) → "Add details" (labor / parts / consumables, suggested items, phone, notes, receipt)
// → "Add another job" (summary with subtotals and the visit total). Search runs on the phone (lib/catalog.ts), so it is instant and works offline;
// saving goes through save_visit and, offline, waits in the mutation queue. Target: an oil change in 3 taps.
type Step = 'find' | 'quick' | 'details' | 'summary';
const n = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 2 });
const today = () => format(new Date(), 'yyyy-MM-dd');
const key = () => Math.random().toString(36).slice(2);

export default function AddRecordScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const arabic = i18n.language === 'ar';
  const locale = arabic ? ar : enUS;
  const online = useOnline();
  const p = useLocalSearchParams<{ vehicleId?: string; serviceTypeId?: string }>();
  const { vehicle: current } = useCurrentVehicle();
  const vehicleId = p.vehicleId ?? current?.id;
  const { jobs: catJobs, parts: catParts, load } = useCatalog();
  const specialists = useSpecialists().data ?? [];
  const tracked = useTracked(vehicleId).data ?? [];
  const visits = useVisits(vehicleId).data ?? [];
  const oldTypes = useServiceTypes().data ?? [];
  const save = useMutation<string, Error, SaveVisitInput>({ mutationKey: SAVE_VISIT_KEY });

  const [step, setStep] = useState<Step>('find');
  const [q, setQ] = useState('');
  const [jobs, setJobs] = useState<DraftJob[]>([]);
  const [at, setAt] = useState(0); // the job being edited
  const [date, setDate] = useState(today());
  const [km, setKm] = useState(current?.current_odometer ? String(current.current_odometer) : '');
  const [workshop, setWorkshop] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const job = jobs[at];
  const unit = t(`vehicles.unit.${(current?.odometer_unit ?? 'km') as 'km'}`);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { load(); }, [load]);
  // Opened from "Mark done" / "Log this" on an old service type: start the search with its name.
  useEffect(() => {
    const st = p.serviceTypeId ? oldTypes.find((x) => x.id === p.serviceTypeId) : null;
    if (st) setQ(arabic ? st.name_ar : st.name_en);
  }, [p.serviceTypeId, oldTypes, arabic]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const jobById = useMemo(() => new Map(catJobs.map((j) => [j.id, j])), [catJobs]);
  const nameOfJob = (id: string | null) => (id ? jobById.get(id) : undefined);
  const due = new Set(tracked.filter((x) => (x.state === 'soon' || x.state === 'overdue') && x.job_type_id).map((x) => x.job_type_id!));
  const recent = new Map<string, number>();
  visits.slice(0, 20).forEach((v) => v.jobs.forEach((j) => j.job_type_id && recent.set(j.job_type_id, (recent.get(j.job_type_id) ?? 0) + 1)));
  const fuel = (current as { fuel_type?: string } | undefined)?.fuel_type;
  const hits = q.trim() ? searchCatalog(q, catJobs, catParts, fuel, { due, recent }) : [];

  // ── start a job ──
  const lastWorkshopFor = (jobTypeId?: string) => visits.find((v) => v.workshop_name && v.jobs.some((j) => j.job_type_id === jobTypeId))?.workshop_name ?? '';
  const startJob = (d: Pick<DraftJob, 'jobTypeId' | 'customName' | 'nameEn' | 'nameAr' | 'specialist'> & Partial<DraftJob>) => {
    const next: DraftJob = { key: key(), cost: '', detailed: false, labor: '', partsAmt: '', consumables: '', chosen: [], ...d };
    setJobs((js) => [...js, next]);
    setAt(jobs.length);
    if (!workshop) setWorkshop(lastWorkshopFor(d.jobTypeId));
    setStep('quick');
  };
  const fromJob = (j: CatalogJob) => startJob({ jobTypeId: j.id, nameEn: j.name_en, nameAr: j.name_ar, specialist: j.specialist_key });
  const fromPart = (x: CatalogPart) => startJob({ customName: arabic ? x.name_ar : x.name_en, nameEn: x.name_en, nameAr: x.name_ar, specialist: 'other', chosen: [{ id: x.id, name_en: x.name_en, name_ar: x.name_ar }] });
  const fromCustom = () => startJob({ customName: q.trim(), nameEn: q.trim(), nameAr: q.trim(), specialist: 'other' });
  const pick = (h: Hit) => (h.kind === 'job' ? fromJob(h.row) : fromPart(h.row));
  const browse = () => {
    usePartSearch.setState({
      vehicleId,
      pops: 1,
      onPick: (x: CatalogPick) => {
        const part = catParts.find((y) => y.id === x.id);
        if (part) fromPart(part);
      },
    });
    router.push('/part-browse');
  };
  const repeatLast = () => {
    const v = visits[0];
    if (!v) return;
    const copy: DraftJob[] = v.jobs
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((j) => {
        const jt = nameOfJob(j.job_type_id);
        const total = j.line_items.reduce((s, li) => s + Number(li.total), 0);
        return { key: key(), jobTypeId: j.job_type_id ?? undefined, customName: j.custom_name ?? undefined, nameEn: jt?.name_en ?? j.custom_name ?? '', nameAr: jt?.name_ar ?? j.custom_name ?? '', specialist: j.specialist_key, cost: total ? String(total) : '', detailed: false, labor: '', partsAmt: '', consumables: '', chosen: [] };
      });
    setJobs(copy);
    setAt(0);
    setWorkshop(v.workshop_name ?? '');
    setStep(copy.length > 1 ? 'summary' : 'quick');
  };

  const patch = (d: Partial<DraftJob>) => setJobs((js) => js.map((j, i) => (i === at ? { ...j, ...d } : j)));
  const total = jobs.reduce((s, j) => s + jobTotal(j), 0);
  const specialistName = (k: string) => { const s = specialists.find((x) => x.key === k); return s ? bilingual(s, arabic) : k; };
  const jobName = (j: DraftJob) => (arabic ? j.nameAr : j.nameEn);

  const choosePerson = () =>
    pickOption({ title: t('add.specialist'), options: specialists.map((s) => ({ id: s.key, label: bilingual(s, arabic), also: bilingual({ name_en: s.name_ar, name_ar: s.name_en }, arabic) })), allowCustom: false, onPick: ({ id }) => id && patch({ specialist: id }) });
  const chooseDate = () =>
    pickOption({
      title: t('add.date'),
      options: Array.from({ length: 60 }, (_, i) => { const d = addDays(new Date(), -i); return { id: format(d, 'yyyy-MM-dd'), label: format(d, 'EEEE d MMMM', { locale }) }; }),
      allowCustom: false,
      onPick: ({ id }) => id && setDate(id),
    });

  // ── save ──
  const submit = async () => {
    if (!vehicleId || !jobs.length || busy) return;
    const reading = km.trim() ? num(km) : null;
    if (reading != null && date >= today() && current && reading < current.current_odometer) return setError(t('add.lowerReading'));
    setError('');
    const input: SaveVisitInput = { vehicle_id: vehicleId, visit_date: date, odometer: reading, workshop_name: workshop, workshop_phone: phone, notes, photoUri, jobs: buildJobs(jobs, arabic) };
    setBusy(true);
    try {
      if (!online) {
        save.mutate(input); // paused until the connection is back, kept across restarts
        toast(t('add.savedOffline'));
      } else {
        const id = await save.mutateAsync(input);
        toast(t('add.saved'), { label: t('services.undo'), onPress: async () => { await supabase.rpc('soft_delete_visit', { p_visit_id: id }); save.reset(); } });
      }
      router.back();
    } catch (e) {
      setBusy(false);
      setError(String((e as { message?: string })?.message).includes('lower_reading') ? t('add.lowerReading') : t('add.failed'));
      toastError(t('add.failed'));
    }
  };

  const total$ = (
    <View className="flex-row items-center justify-between px-1 pb-2">
      <Text variant="caption" className="text-muted">{t('add.visitTotal')}</Text>
      <Text variant="label">{n(total)}</Text>
    </View>
  );
  const back = () => (step === 'find' || (step === 'quick' && jobs.length <= 1) ? router.back() : setStep(step === 'details' ? 'quick' : jobs.length > 1 ? 'summary' : 'find'));

  // ═════ FIND ═════
  if (step === 'find') {
    const dueJobs = [...due].map((id) => nameOfJob(id)).filter(Boolean).slice(0, 4) as CatalogJob[];
    const recentJobs = [...recent.keys()].map((id) => nameOfJob(id)).filter(Boolean).slice(0, 6) as CatalogJob[];
    const common = catJobs.filter((j) => j.tracked && (!fuel || !j.fuel_types || j.fuel_types.includes(fuel))).slice(0, 8);
    const row = (h: Hit) => (
      <Card key={`${h.kind}-${h.row.id}`} onPress={() => pick(h)} className="px-4 py-3">
        <Text variant="label" numberOfLines={2}>{bilingual(h.row, arabic)}</Text>
        <Text variant="caption" className="text-muted" numberOfLines={1}>{h.alias ? `${bilingual({ name_en: h.row.name_ar, name_ar: h.row.name_en }, arabic)} · ${h.alias}` : bilingual({ name_en: h.row.name_ar, name_ar: h.row.name_en }, arabic)}</Text>
      </Card>
    );
    const group = (label: string, list: CatalogJob[]) =>
      list.length ? (
        <View className="gap-2">
          <Text variant="caption" className="px-1 text-muted">{label}</Text>
          <View className="flex-row flex-wrap gap-2">{list.map((j) => <Chip key={j.id} label={bilingual(j, arabic)} onPress={() => fromJob(j)} />)}</View>
        </View>
      ) : null;
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <PageHeader title={t('add.title')} />
        <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 pb-8 pt-2" keyboardShouldPersistTaps="handled">
          {!online ? <Text variant="caption" className="text-muted">{t('add.offline')}</Text> : null}
          <Field label={t('add.search')} value={q} onChangeText={setQ} autoFocus autoCorrect={false} returnKeyType="search" />
          {q.trim() ? (
            <>
              {hits.filter((h) => h.kind === 'job').length ? <View className="gap-2"><Text variant="caption" className="px-1 text-muted">{t('services.kindJob')}</Text>{hits.filter((h) => h.kind === 'job').map(row)}</View> : null}
              {hits.filter((h) => h.kind === 'item').length ? <View className="gap-2"><Text variant="caption" className="px-1 text-muted">{t('services.kindPart')}</Text>{hits.filter((h) => h.kind === 'item').map(row)}</View> : null}
              {hits.length === 0 ? <Card tone="amber" onPress={fromCustom} className="flex-row items-center gap-2 px-4 py-3"><Plus size={18} color={c.ink} /><Text variant="label" className="flex-1">{t('services.custom', { q: q.trim() })}</Text></Card> : null}
            </>
          ) : (
            <>
              {group(t('add.dueNow'), dueJobs)}
              {visits[0] ? (
                <Card onPress={repeatLast} className="flex-row items-center gap-3 px-4 py-3">
                  <Repeat size={18} color={c.ink} />
                  <View className="flex-1">
                    <Text variant="label">{t('add.repeat')}</Text>
                    <Text variant="caption" className="text-muted" numberOfLines={1}>{format(parseISO(visits[0].visit_date), 'd MMM', { locale })} · {visits[0].jobs.map((j) => { const x = nameOfJob(j.job_type_id); return x ? bilingual(x, arabic) : (j.custom_name ?? ''); }).join('، ')}</Text>
                  </View>
                </Card>
              ) : null}
              {group(t('add.recent'), recentJobs)}
              {group(t('add.common'), common)}
            </>
          )}
          <PressableScale accessibilityRole="button" onPress={browse} className="flex-row items-center gap-2 self-start px-1 py-2">
            <ListTree size={16} color={c.muted} /><Text variant="caption" className="text-ink">{t('services.browse')}</Text>
          </PressableScale>
          <PressableScale accessibilityRole="button" onPress={() => router.replace('/capture')} className="flex-row items-center gap-2 self-start px-1 py-2">
            <Wrench size={16} color={c.muted} /><Text variant="caption" className="text-ink">{t('add.runningCost')}</Text>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════ SUMMARY (more than one job) ═════
  if (step === 'summary')
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <PageHeader title={t('add.review')} />
        <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-2">
          {jobs.map((j, i) => (
            <Card key={j.key} onPress={() => { setAt(i); setStep('quick'); }} className="flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1">
                <Text variant="label" numberOfLines={1}>{jobName(j)}</Text>
                <Text variant="caption" className="text-muted" numberOfLines={1}>{specialistName(j.specialist)}</Text>
              </View>
              <Text variant="label">{n(jobTotal(j))}</Text>
            </Card>
          ))}
          <Button title={t('add.another')} variant="soft" icon={<Plus size={18} color={c.ink} />} onPress={() => { setQ(''); setStep('find'); }} />
          {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
        </ScrollView>
        <FooterBar inset={false}>{total$}<Button title={t('add.saveVisit')} loading={busy} onPress={submit} /></FooterBar>
      </SafeAreaView>
    );

  if (!job) return null;
  // ═════ DETAILS ═════
  if (step === 'details') {
    const suggested = (nameOfJob(job.jobTypeId ?? null)?.suggested_items ?? []).map((id) => catParts.find((x) => x.id === id)).filter(Boolean) as CatalogPart[];
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <PageHeader title={jobName(job)} sub={t('add.details')} />
        <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-2" keyboardShouldPersistTaps="handled">
          <Field label={t('services.labor')} value={job.detailed ? job.labor : ''} onChangeText={(v) => patch({ detailed: true, labor: clean(v, true), partsAmt: job.detailed ? job.partsAmt : job.cost })} keyboardType="decimal-pad" />
          <Field label={t('services.parts')} value={job.partsAmt} onChangeText={(v) => patch({ detailed: true, partsAmt: clean(v, true) })} keyboardType="decimal-pad" />
          <Field label={t('services.consumables')} value={job.consumables} onChangeText={(v) => patch({ detailed: true, consumables: clean(v, true) })} keyboardType="decimal-pad" />
          {suggested.length ? (
            <View className="gap-2">
              <Text variant="caption" className="px-1 text-muted">{t('add.suggested')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {suggested.map((s) => {
                  const on = job.chosen.some((x) => x.id === s.id);
                  return <Chip key={s.id} label={bilingual(s, arabic)} selected={on} onPress={() => patch({ detailed: true, chosen: on ? job.chosen.filter((x) => x.id !== s.id) : [...job.chosen, { id: s.id, name_en: s.name_en, name_ar: s.name_ar }] })} />;
                })}
              </View>
            </View>
          ) : null}
          <Field label={t('add.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label={t('add.notes')} value={notes} onChangeText={setNotes} multiline />
          <Chip icon={Camera} label={photoUri ? t('add.receiptDone') : t('add.receipt')} selected={!!photoUri} onPress={async () => { const u = await pickPhoto(); if (u) setPhotoUri(u); }} />
          {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
        </ScrollView>
        <FooterBar inset={false}>
          {total$}
          <Button title={jobs.length > 1 ? t('add.review') : t('add.save')} loading={busy} onPress={() => (jobs.length > 1 ? setStep('summary') : submit())} />
        </FooterBar>
      </SafeAreaView>
    );
  }

  // ═════ QUICK FORM ═════
  // The specialist as tags: the job's own, the ones used lately, me, the dealer, other; "More…" opens the full list.
  const lately = visits.flatMap((v) => v.jobs.map((j) => j.specialist_key));
  const whoOptions = [...new Set([job.specialist, ...lately.slice(0, 6), 'self_diy', 'dealer_authorized_service_center', 'other'])].slice(0, 5);
  const isToday = date === today();
  const isYesterday = date === format(addDays(new Date(), -1), 'yyyy-MM-dd');
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={jobName(job)} sub={specialistName(job.specialist)} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-2" keyboardShouldPersistTaps="handled">
        <Field label={t('add.cost')} value={job.detailed ? String(jobTotal(job) || '') : job.cost} onChangeText={(v) => patch({ cost: clean(v, true), detailed: false })} keyboardType="decimal-pad" autoFocus editable={!job.detailed} />
        <Field label={t('add.labor')} value={job.labor} onChangeText={(v) => patch({ labor: clean(v, true) })} keyboardType="decimal-pad" editable={!job.detailed} />
        <Card className="gap-2.5 p-3.5">
          <Text variant="caption" className="text-muted">{t('add.when')}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip label={t('add.today')} selected={isToday} onPress={() => setDate(today())} />
            <Chip label={t('add.yesterday')} selected={isYesterday} onPress={() => setDate(format(addDays(new Date(), -1), 'yyyy-MM-dd'))} />
            <Chip label={isToday || isYesterday ? t('add.other') : format(parseISO(date), 'd MMM yyyy', { locale })} selected={!isToday && !isYesterday} onPress={chooseDate} />
          </View>
        </Card>
        <Card className="gap-2.5 p-3.5">
          <Text variant="caption" className="text-muted">{t('add.who')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {whoOptions.map((k) => <Chip key={k} label={specialistName(k)} selected={job.specialist === k} onPress={() => patch({ specialist: k })} />)}
            <Chip label={t('add.more')} icon={Plus} onPress={choosePerson} />
          </View>
        </Card>
        <Field label={`${t('add.odometer')} (${unit})`} value={km} onChangeText={(v) => setKm(clean(v))} keyboardType="number-pad" />
        <Field label={t('add.workshop')} value={workshop} onChangeText={setWorkshop} />
        <View className="flex-row flex-wrap gap-2 pt-1">
          <Chip label={t('add.details')} onPress={() => setStep('details')} />
          <Chip label={t('add.another')} icon={Plus} onPress={() => { setQ(''); setStep('find'); }} />
          {jobs.length > 1 ? <Chip label={t('add.remove')} onPress={() => { setJobs((js) => js.filter((_, i) => i !== at)); setAt(0); setStep(jobs.length > 2 ? 'summary' : 'find'); }} /> : null}
        </View>
        {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={jobs.length > 1 ? t('add.review') : t('add.save')} loading={busy} onPress={() => (jobs.length > 1 ? setStep('summary') : submit())} />
        <Button title={t('back')} variant="link" onPress={back} />
      </FooterBar>
    </SafeAreaView>
  );
}
