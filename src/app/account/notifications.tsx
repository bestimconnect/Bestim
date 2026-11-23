import { useRefresh } from '@/components/Refresh';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { I18nManager, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { toast } from '@/components/Toast';
import { PageHeader } from '@/components/PageHeader';
import { Button, FooterBar, Note, PressableScale, Text, Toggle } from '@/components/ui';
import { notificationsAllowed, requestNotifications, syncNotifications } from '@/lib/notifications';
import { useProfile } from '@/lib/queries';
import { DEFAULT_PREFS, type Prefs } from '@/lib/reminderPlan.ts';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';

// Q38 presets: [quiet_from, quiet_to]; null = off
const QUIET: [number | null, number | null][] = [[22, 8], [23, 10], [0, 12], [null, null]];
const TOGGLES = ['due_soon', 'overdue', 'odometer', 'weekly'] as const;
const KEYS = { due_soon: 'dueSoon', overdue: 'overdue', odometer: 'odometer', weekly: 'weekly' } as const;

// Screen 28 — Notification preferences (Q37, Q38); Figma 167:59817
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const c = useColors();
  const qc = useQueryClient();
  const userId = useSession()?.user.id;
  const [edits, setEdits] = useState<Partial<Prefs>>({});
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(true);

  const { data: profile } = useProfile();

  useEffect(() => {
    notificationsAllowed().then(setAllowed);
  }, []);


  const p: Prefs = { ...DEFAULT_PREFS, ...((profile?.notification_prefs as Partial<Prefs> | null) ?? {}), ...edits };
  const setPrefs = (n: Prefs) => setEdits(n);
  const quietIdx = Math.max(0, QUIET.findIndex(([f, to]) => f === p.quiet_from && to === p.quiet_to));
  const opts = t('notifPrefs.quietOpts', { returnObjects: true }) as string[];

  const enable = async () => {
    const ok = await requestNotifications();
    if (!ok) Linking.openSettings();
    setAllowed(ok);
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ notification_prefs: p }).eq('id', userId);
    setSaving(false);
    if (error) return toast(t('notifPrefs.saveError'));
    qc.invalidateQueries({ queryKey: ['profile'] });
    syncNotifications();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <PageHeader title={t('notifPrefs.title')} />
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-2 px-6 pb-6 pt-2" showsVerticalScrollIndicator={false}>
        {!allowed ? (
          <View className="mb-2 gap-3">
            <Note tone="alert" text={t('notifPrefs.bannerOff')} />
            <Button title={t('notifPrefs.bannerAction')} onPress={enable} />
          </View>
        ) : null}
        {TOGGLES.map((k) => (
          <View key={k} className="flex-row items-center gap-[13px] rounded-[22px] bg-white px-3.5 py-[13px]" style={{ boxShadow: shadows.ring }}>
            <View className="flex-1">
              <Text variant="label" style={{ fontSize: 14.5 }}>{t(`notifPrefs.${KEYS[k]}`)}</Text>
              <Text variant="caption" className="text-muted" style={{ fontSize: 12.5 }}>{t(`notifPrefs.${KEYS[k]}Sub`)}</Text>
            </View>
            <Toggle value={p[k]} onChange={(v) => setPrefs({ ...p, [k]: v })} label={t(`notifPrefs.${KEYS[k]}`)} />
          </View>
        ))}
        <Text variant="body" className="mt-[18px] text-muted" style={{ fontSize: 14 }}>{t('notifPrefs.quiet')}</Text>
        <PressableScale accessibilityRole="button" onPress={() => setOpen(!open)} className="rounded-[22px] bg-white px-3.5 py-[13px]" style={{ boxShadow: shadows.ring }}>
          <View className="min-h-[24px] flex-row items-center">
            <Text variant="label" className="flex-1" style={{ fontSize: 15 }}>{opts[quietIdx]}</Text>
            {open ? <ChevronDown size={16} color={c.muted} /> : I18nManager.isRTL ? <ChevronLeft size={16} color={c.muted} /> : <ChevronRight size={16} color={c.muted} />}
          </View>
          {open
            ? opts.map((o, i) => (
                <Pressable
                  key={o}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: i === quietIdx }}
                  onPress={() => {
                    setPrefs({ ...p, quiet_from: QUIET[i][0], quiet_to: QUIET[i][1] });
                    setOpen(false);
                  }}
                  className="min-h-11 flex-row items-center gap-3">
                  <View className="h-5 w-5 items-center justify-center rounded-full border-2" style={{ borderColor: c.ink }}>
                    {i === quietIdx ? <View className="h-2.5 w-2.5 rounded-full bg-ink" /> : null}
                  </View>
                  <Text variant="body" className="flex-1">{o}</Text>
                </Pressable>
              ))
            : null}
        </PressableScale>
        <Text variant="caption" className="mx-1.5 mt-2 text-muted" style={{ fontSize: 12.5, lineHeight: 20 }}>{t('notifPrefs.footnote')}</Text>
        {saved ? <Note tone="success" text={t('notifPrefs.saved')} /> : null}
      </ScrollView>
      <FooterBar>
        <Button title={t('notifPrefs.save')} variant={allowed ? 'primary' : 'secondary'} onPress={save} loading={saving} />
      </FooterBar>
    </SafeAreaView>
  );
}
