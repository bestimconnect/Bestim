import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { Bell, ChevronLeft, ChevronRight, CircleHelp, Compass, Download, Languages, Moon, Sun, Trash2, type LucideIcon } from 'lucide-react-native';
import { I18nManager, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { useRefresh } from '@/components/Refresh';
import { PressableScale, Text } from '@/components/ui';
import { planName, showUpgrade, useEntitlements, useLock } from '@/lib/entitlements';
import { signOut } from '@/lib/auth';
import { useProfile } from '@/lib/queries';
import { DEFAULT_PREFS, type Prefs } from '@/lib/reminderPlan.ts';
import { useSession } from '@/lib/session';
import { sheet } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';
import { useTourReplay } from '@/lib/tour';
import { useSettings } from '@/stores/settingsStore';

// Menu (v2, Q133): opened from the avatar on Home. Reference: flow 6 #4 "Menu": profile row, one card of rows (language, appearance, alerts,
// export, help), sign out, delete account. Sharing the history lives on the passport; deleting a car on the car details.
export default function AccountScreen() {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const { bottom } = useSafeAreaInsets();
  const session = useSession();
  const { data: profile } = useProfile();
  const theme = useSettings((s) => s.theme);
  const ent = useEntitlements().data;
  const plan = planName(ent);
  // Trial: the plan name and the days left.
  const left = ent?.source === 'trial' && ent.expires_at ? Math.max(0, differenceInCalendarDays(parseISO(ent.expires_at), new Date())) : null;
  const exp = useLock('export');
  const prefs: Prefs = { ...DEFAULT_PREFS, ...((profile?.notification_prefs as Partial<Prefs> | null) ?? {}) };
  const alertsOn = prefs.due_soon || prefs.overdue || prefs.odometer || prefs.weekly;
  const name = profile?.full_name?.trim() || session?.user.email?.split('@')[0] || '';

  const confirmSignOut = () =>
    sheet(t('account.signOutTitle'), t('account.signOutBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('account.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <PageHeader title={t('tabs.menu')} />
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-3 px-6 pt-2" contentContainerStyle={{ paddingBottom: bottom + 28 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3">
          <PressableScale accessibilityRole="button" accessibilityLabel={t('account.edit.title')} onPress={() => router.push('/account/edit')}>
            {profile?.avatar_url ? (
              <Avatar path={profile.avatar_url} name={name} size={52} />
            ) : (
              <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-panel">
                <Text variant="label" className="text-onpanel" style={{ fontSize: 17 }}>{(name[0] ?? '·').toUpperCase()}</Text>
              </View>
            )}
          </PressableScale>
          <View className="flex-1">
            <Text variant="label" numberOfLines={1} style={{ fontSize: 17 }}>{name}</Text>
            <Text variant="caption" className="text-muted" numberOfLines={1} style={{ fontSize: 12.5, writingDirection: 'ltr', textAlign: 'left' }}>{session?.user.email}</Text>
          </View>
          {plan ? (
            <PressableScale accessibilityRole="button" onPress={() => router.push('/plans')} className="flex-row items-center gap-1.5 rounded-full bg-white px-2.5 py-1" style={{ boxShadow: shadows.ring }}>
              <View className="h-[7px] w-[7px] rounded-full bg-muted" />
              <Text variant="caption" className="text-muted" numberOfLines={1} style={{ fontSize: 11.5 }}>{left != null ? t('plans.strip.trial', { plan, n: left }) : plan}</Text>
            </PressableScale>
          ) : null}
        </View>

        <View className="rounded-[24px] bg-white px-3.5 py-1" style={{ boxShadow: shadows.ring }}>
          <Row icon={Languages} label={t('account.language')} value={t('account.languageName')} onPress={() => router.push('/account/appearance')} />
          <Row icon={theme === 'dark' ? Moon : Sun} label={t('account.appearance.theme')} value={t(`account.appearance.${theme}`)} onPress={() => router.push('/account/appearance')} />
          <Row icon={Bell} label={t('account.notifications')} value={t(alertsOn ? 'account.on' : 'account.off')} onPress={() => router.push('/account/notifications')} />
          {exp.hidden ? null : (
            <Row icon={Download} label={t('account.export')} value={exp.locked ? undefined : t('account.exportValue')} onPress={() => (exp.locked ? showUpgrade('feature', exp.ent, null, 'export') : router.push('/account/export'))} />
          )}
          <Row icon={Trash2} label={t('account.recent')} onPress={() => router.push('/account/deleted')} />
          <Row icon={CircleHelp} label={t('account.help')} onPress={() => router.push({ pathname: '/page/[slug]', params: { slug: 'terms' } })} />
          <Row icon={Compass} label={t('account.tour')} onPress={() => { useTourReplay.setState({ on: true }); router.navigate('/'); }} last />
        </View>

        <PressableScale accessibilityRole="button" onPress={confirmSignOut} className="h-[50px] items-center justify-center rounded-full bg-white" style={{ boxShadow: shadows.ring }}>
          <Text variant="label" style={{ fontSize: 14 }}>{t('account.signOut')}</Text>
        </PressableScale>
        <PressableScale accessibilityRole="button" onPress={() => router.push('/delete-account')} className="min-h-11 items-center justify-center">
          <Text variant="caption" className="text-danger" style={{ fontSize: 13 }}>{t('account.deleteAccount')}</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

/** v2 `.mr`: 34 icon circle, label, value, chevron; hairline between rows. */
function Row({ icon: Icon, label, value, onPress, last }: { icon: LucideIcon; label: string; value?: string; onPress: () => void; last?: boolean }) {
  const c = useColors();
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  return (
    <PressableScale accessibilityRole="button" scale={0.99} onPress={onPress} className={`min-h-[58px] flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-line'}`}>
      <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-paper">
        <Icon size={17} color={c.ink} strokeWidth={1.8} />
      </View>
      <Text variant="body" className="flex-1" numberOfLines={1} style={{ fontSize: 14.5 }}>{label}</Text>
      {value ? <Text variant="caption" className="text-muted" numberOfLines={1} style={{ fontSize: 13 }}>{value}</Text> : null}
      <Chevron size={15} color={c.muted} />
    </PressableScale>
  );
}
