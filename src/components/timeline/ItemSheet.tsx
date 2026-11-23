import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PartArt } from '@/components/PartArt';
import { toastError } from '@/components/Toast';
import { Button, Stepper, Text, Toggle } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { lifeFraction } from '@/lib/parts';
import type { Part } from '@/lib/queries';
import { refreshRecords } from '@/lib/removeRecord';
import { openCapture } from '@/lib/reading';
import { snoozePart } from '@/lib/snooze';
import { supabase } from '@/lib/supabase';
import { BottomSheet } from './BottomSheet';
import { Num } from './Num';
import { Ticks } from './Ticks';
import { weeksLeft } from './pace';
import { prefKey, usePref, useSchedulePrefs } from './schedulePrefs';

const n = (x: number) => x.toLocaleString('en-US');
export const partIntervals = (p: Part) => ({
  km: p.log.interval_km ?? p.serviceType.default_interval_km,
  months: p.log.interval_months ?? p.serviceType.default_interval_months,
});
const toneOf = (s: Part['status']) => (s.state === 'overdue' ? 'late' : s.state === 'soon' ? 'soon' : 'ok') as 'ok' | 'soon' | 'late';

/** The Item sheet (design `it`) and its Edit schedule sheet (`es`), opened from a Coming-up row. */
export function ItemSheet({ part, vehicleId, unit, perDay, onClose }: { part: Part | null; vehicleId: string; unit: string; perDay: number | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Part | null>(part); // keeps the content while the sheet slides out
  if (part && part !== last) setLast(part);
  const p = part ?? last;
  const pref = usePref(vehicleId, p?.serviceType.id ?? '');
  const close = () => { setEditing(false); onClose(); };
  if (!p) return null;
  const st = p.serviceType;
  const name = i18n.language === 'ar' ? st.name_ar : st.name_en;
  const { km, months } = partIntervals(p);
  const s = p.status;
  const life = s.state === 'overdue' ? 0 : 1 - lifeFraction(s, km).used;
  const weeks = weeksLeft(s, pref.predict ? perDay : null);
  const fmt = (iso: string) => format(parseISO(iso), 'd MMM', { locale: i18n.language === 'ar' ? ar : enUS });
  return (
    <BottomSheet open={!!part} onClose={close}>
      {editing ? (
        <Schedule part={p} vehicleId={vehicleId} name={name} unit={unit} onDone={close} onBack={() => setEditing(false)} />
      ) : (
        <>
          <View className="flex-row items-center gap-3">
            <PartArt nameEn={st.name_en} size={48} state={s.state === 'overdue' ? 'late' : s.state} />
            <Text variant="heading" className="flex-1 font-normal" numberOfLines={1}>{name}</Text>
          </View>
          <View className="rounded-[24px] bg-paper px-4 py-4">
            <Text variant="caption" className="text-muted">{t('tl.left')}</Text>
            <View className="mt-1.5 flex-row items-end justify-between">
              {s.remainingKm != null ? <Num value={n(Math.max(0, s.remainingKm))} unit={unit} size={44} /> : <Num value={s.remainingDays != null ? n(Math.max(0, s.remainingDays)) : '—'} unit={t('tl.days')} size={44} />}
              {weeks != null && weeks > 0 ? <Text variant="caption" className="pb-1.5 text-muted">{t('tl.about', { count: weeks })}</Text> : null}
            </View>
            <View className="mt-3"><Ticks n={12} on={Math.round(life * 12)} tone={toneOf(s)} height={26} /></View>
          </View>
          <View className="flex-row justify-between px-0.5">
            <Text variant="caption" className="text-muted">{t('tl.every')}</Text>
            <Text variant="label" className="font-normal">{km != null && months != null ? t('tl.everyV', { km: n(km), u: unit, m: months }) : km != null ? `${n(km)} ${unit}` : months != null ? t('parts.months', { m: months }) : '—'}</Text>
          </View>
          <View className="flex-row justify-between px-0.5">
            <Text variant="caption" className="text-muted">{t('tl.last')}</Text>
            <Text variant="label" className="font-normal">{[p.log.odometer_reading != null ? `${n(p.log.odometer_reading)} ${unit}` : null, fmt(p.log.service_date)].filter(Boolean).join(' · ')}</Text>
          </View>
          <Button title={t('tl.markDone')} onPress={() => { close(); openCapture({ vehicleId, serviceTypeId: st.id }); }} />
          <View className="flex-row gap-2.5">
            <Button className="flex-1" variant="soft" size="sm" title={t('tl.snooze')} loading={busy} onPress={async () => { setBusy(true); if (await snoozePart(vehicleId, st.id, name, false)) close(); setBusy(false); }} />
            <Button className="flex-[1.3]" variant="soft" size="sm" title={t('tl.edit')} onPress={() => setEditing(true)} />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function Schedule({ part, vehicleId, name, unit, onDone, onBack }: { part: Part; vehicleId: string; name: string; unit: string; onDone: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cur = partIntervals(part);
  const [km, setKm] = useState(cur.km ?? 5000);
  const [months, setMonths] = useState(cur.months ?? 6);
  const pref = usePref(vehicleId, part.serviceType.id);
  const [predict, setPredict] = useState(pref.predict);
  const [remindKm, setRemindKm] = useState(pref.remindKm);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    useSchedulePrefs.getState().save(prefKey(vehicleId, part.serviceType.id), { predict, remindKm });
    setBusy(true);
    const changes: { interval_km?: number; interval_months?: number } = {};
    if (km !== cur.km) changes.interval_km = km;
    if (months !== cur.months) changes.interval_months = months;
    let error = null;
    if (Object.keys(changes).length) {
      // A km change after the first 24 hours needs a reason (the database keeps the original): the reason is the schedule change itself.
      const direct = await supabase.from('maintenance_logs').update(changes).eq('id', part.log.id);
      error = direct.error;
      if (error?.message.includes('needs_reason')) {
        const { interval_months, ...rest } = changes;
        const fixed = await supabase.rpc('correct_log', { log_id: part.log.id, changes: Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, String(v)])), reason: t('tl.scheduleReason') });
        error = fixed.error;
        if (!error && interval_months != null) error = (await supabase.from('maintenance_logs').update({ interval_months }).eq('id', part.log.id)).error;
      }
    }
    setBusy(false);
    if (error) return toastError(errorText(error));
    refreshRecords(qc);
    onDone();
  };
  return (
    <>
      <Text variant="heading" className="font-normal" onPress={onBack}>{t('tl.editTitle', { name })}</Text>
      <Stepper label={t('tl.byKm', { u: unit })} value={km} unit={unit} step={500} min={500} onChange={setKm} />
      <Stepper label={t('tl.byMonths')} value={months} unit={t('tl.months')} step={1} min={1} onChange={setMonths} />
      <View className="flex-row items-center gap-3 rounded-input bg-paper px-4 py-3">
        <View className="flex-1">
          <Text variant="label" className="font-normal">{t('tl.predict')}</Text>
          <Text variant="caption" className="text-muted">{t('tl.predictSub')}</Text>
        </View>
        <Toggle value={predict} onChange={setPredict} label={t('tl.predict')} />
      </View>
      <Stepper label={t('tl.remindBefore')} value={remindKm} unit={unit} step={100} min={0} max={5000} onChange={setRemindKm} />
      <Button title={t('tl.save')} loading={busy} onPress={save} />
    </>
  );
}
