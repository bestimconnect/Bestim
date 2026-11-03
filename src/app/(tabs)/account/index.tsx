import { useTabBarSpace } from '@/components/TabBar';
import { useRefresh } from '@/components/Refresh';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell, Coins, Compass, Crown, Download, Languages, Moon, Repeat, LogOut } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LicenceCard } from '@/components/LicenceCard';
import { Backdrop, Group, Item, Section, Text, Toggle } from '@/components/ui';
import { LockChip } from '@/components/LockChip';
import { planLabel, planName, showUpgrade, useEntitlements, useLock } from '@/lib/entitlements';
import { signOut } from '@/lib/auth';
import { applyLanguage } from '@/lib/i18n';
import { openPage } from '@/lib/links';
import { useCurrentVehicle } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { sheet } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { useTourReplay } from '@/lib/tour';
import { useSettings } from '@/stores/settingsStore';

// Screen 26 — Account & settings (Q33, Q35, Q36, Q48); Figma 167:59659
export default function AccountScreen() {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const space = useTabBarSpace();
  const session = useSession();
  const userId = session?.user.id;
  const { language, setLanguage, theme, setTheme } = useSettings();
  const { vehicle } = useCurrentVehicle();
  const ent = useEntitlements().data;
  const plan = planName(ent);
  // Trial: the plan name and the days left; the plan row is where the user always sees which plan they are on.
  const left = ent?.source === 'trial' && ent.expires_at ? Math.max(0, differenceInCalendarDays(parseISO(ent.expires_at), new Date())) : null;
  const exp = useLock('export');
  const shr = useLock('share_history');
  const lockTag = (l: typeof exp) => (l.locked ? <LockChip name={l.plan ? planLabel(l.plan) : undefined} /> : undefined);

  const switchLanguage = () =>
    sheet(t('account.switchTitle'), t('account.switchBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('account.switch'),
        onPress: () => {
          const next = language === 'ar' ? 'en' : 'ar';
          setLanguage(next);
          if (userId) supabase.from('profiles').update({ language: next }).eq('id', userId).then(() => {}); // best effort
          applyLanguage(next);
        },
      },
    ]);

  const confirmSignOut = () =>
    sheet(t('account.signOutTitle'), t('account.signOutBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('account.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Backdrop />
      <ScrollView refreshControl={refresh} contentContainerClassName="gap-6 px-6" contentContainerStyle={{ paddingBottom: space }}>
        <View className="pt-2">
          <LicenceCard onEdit={() => router.push('/account/edit')} />
        </View>
        <View>
          <Section title={t('account.group.preferences')} />
          <Group>
            <Item icon={Languages} tone="paper" title={t('account.language')} aside={<Text variant="label">{t('account.languageName')}</Text>} onPress={switchLanguage} />
            <Item icon={Coins} tone="paper" title={t('account.currency')} aside={<Text variant="label">{t('account.currencyName')}</Text>} disabled />
            <Item icon={Moon} tone="paper" title={t('account.dark')} subtitle={t('account.darkSub')} aside={<Toggle value={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} label={t('account.dark')} />} />
            <Item icon={Bell} tone="mint" title={t('account.notifications')} subtitle={t('account.notificationsSub')} onPress={() => router.push('/account/notifications')} />
            <Item icon={Compass} tone="paper" title={t('account.tour')} subtitle={t('account.tourSub')} onPress={() => { useTourReplay.setState({ on: true }); router.navigate('/'); }} />
          </Group>
        </View>
        <View>
          <Section title={t('account.group.data')} />
          <Group>
            <Item icon={Crown} tone="paper" title={t('plans.account')} aside={plan ? <Text variant="label">{left != null ? t('plans.strip.trial', { plan, n: left }) : plan}</Text> : undefined} onPress={() => router.push('/plans')} />
            {exp.hidden ? null : (
              <Item icon={Download} tone="paper" title={t('account.export')} subtitle={t('account.exportSub')} aside={lockTag(exp)} onPress={() => (exp.locked ? showUpgrade('feature', exp.ent, null, 'export') : router.push('/account/export'))} />
            )}
            {shr.hidden ? null : (
              <Item icon={Repeat} tone="paper" title={t('account.share')} subtitle={t('account.shareSub')} aside={lockTag(shr)} onPress={() => (shr.locked ? showUpgrade('feature', shr.ent, null, 'share_history') : router.push('/account/share'))} />
            )}
          </Group>
        </View>
        <Group>
          <Item icon={LogOut} tone="paper" title={t('account.signOut')} chevron={false} onPress={confirmSignOut} />
        </Group>

        <View className="items-center gap-1">
          <View className="flex-row flex-wrap items-center justify-center gap-x-2">
            {(['privacy', 'terms', 'support', 'about'] as const).map((page, i) => (
              <Fragment key={page}>
                {i ? <Text variant="caption" className="text-muted">·</Text> : null}
                <Pressable accessibilityRole="link" className="min-h-11 justify-center px-1" onPress={() => openPage(page)}>
                  <Text variant="caption" className="text-muted">{t(`account.${page}`)}</Text>
                </Pressable>
              </Fragment>
            ))}
          </View>
          <Text variant="caption" numberOfLines={1} className="text-muted">{t('account.version', { v: Constants.expoConfig?.version ?? '' })}</Text>
          <View className="flex-row flex-wrap items-center justify-center gap-x-4">
            {vehicle ? (
              <Pressable accessibilityRole="button" className="min-h-11 justify-center" onPress={() => router.push({ pathname: '/delete-vehicle', params: { vehicleId: vehicle.id } })}>
                <Text variant="caption" numberOfLines={1} className="text-danger" style={{ opacity: 0.85 }}>{t('account.deleteVehicle')}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account')} className="min-h-11 justify-center">
              <Text variant="caption" className="text-danger" style={{ opacity: 0.85 }}>{t('account.deleteAccount')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
