import { useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Note, Text, Toggle } from '@/components/ui';
import { notificationsAllowed, requestNotifications, syncNotifications } from '@/lib/notifications';
import { useIsGuest, useProfile } from '@/lib/queries';
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
  const c = useColors();
  const qc = useQueryClient();
  const guest = useIsGuest();
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

  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'account' } }} />;

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
    if (error) return;
    qc.invalidateQueries({ queryKey: ['profile'] });
    syncNotifications();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView contentContainerClassName="gap-3 px-6" contentContainerStyle={{ paddingBottom: 120 }}>
        <Header title={t('notifPrefs.title')} />
        <Text variant="title" className="mb-1">{t('notifPrefs.heading')}</Text>
        {!allowed ? (
          <Pressable accessibilityRole="button" onPress={enable}>
            <Note tone="alert" text={`${t('notifPrefs.bannerOff')} ${t('notifPrefs.bannerAction')}`} />
          </Pressable>
        ) : null}
        {TOGGLES.map((k) => (
          <View key={k} className="min-h-[64px] flex-row items-center gap-3 rounded-item bg-white px-4 py-3" style={{ boxShadow: shadows.soft }}>
            <View className="flex-1 gap-0.5">
              <Text variant="label">{t(`notifPrefs.${KEYS[k]}`)}</Text>
              <Text variant="caption" className="text-muted">{t(`notifPrefs.${KEYS[k]}Sub`)}</Text>
            </View>
            <Toggle value={p[k]} onChange={(v) => setPrefs({ ...p, [k]: v })} label={t(`notifPrefs.${KEYS[k]}`)} />
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(!open)}
          className="gap-2 rounded-item bg-white p-4"
          style={{ boxShadow: shadows.soft }}>
          <Text variant="caption" className="text-muted">{t('notifPrefs.quiet')}</Text>
          <Text variant="label">{opts[quietIdx]}</Text>
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
                  className="flex-row items-center gap-3 py-2">
                  <View className="h-5 w-5 items-center justify-center rounded-full border-2" style={{ borderColor: c.teal }}>
                    {i === quietIdx ? <View className="h-2.5 w-2.5 rounded-full bg-teal" /> : null}
                  </View>
                  <Text variant="body">{o}</Text>
                </Pressable>
              ))
            : null}
        </Pressable>
        <Text variant="caption" className="px-1 text-muted">{t('notifPrefs.footnote')}</Text>
        {saved ? <Note tone="success" text={t('notifPrefs.saved')} /> : null}
        <Button title={t('notifPrefs.save')} onPress={save} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}
