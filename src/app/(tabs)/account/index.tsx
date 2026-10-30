import { useTabBarSpace } from '@/components/TabBar';
import { useRefresh } from '@/components/Refresh';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell, Camera, Coins, Crown, Download, Languages, Moon, Repeat, LogOut } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Group, Header, Item, Text, Toggle, PressableScale } from '@/components/ui';
import { useAvatarActions } from '@/lib/avatar';
import { planName, useEntitlements } from '@/lib/entitlements';
import { signOut } from '@/lib/auth';
import { applyLanguage } from '@/lib/i18n';
import { openPage } from '@/lib/links';
import { useCurrentVehicle, useProfile, useVehicles } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { sheet } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

// Screen 26 — Account & settings (Q33, Q35, Q36, Q48); Figma 167:59659
export default function AccountScreen() {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const space = useTabBarSpace();
  const c = useColors();
  const session = useSession();
  const userId = session?.user.id;
  const cars = useVehicles().data?.length ?? 0;
  const [error, setError] = useState('');
  const { language, setLanguage, theme, setTheme } = useSettings();
  const { vehicle } = useCurrentVehicle();
  const { data: profile } = useProfile();
  const plan = planName(useEntitlements().data);

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

  const photo = useAvatarActions(userId, profile?.avatar_url);
  const run = (job: () => Promise<unknown>) => () => {
    setError('');
    job().catch(() => setError(t('account.photo.failed')));
  };
  const photoMenu = () =>
    sheet(t('account.photo.title'), undefined, [
      { text: t('account.photo.take'), onPress: run(() => photo.pick('camera')) },
      { text: t('account.photo.choose'), onPress: run(() => photo.pick('library')) },
      ...(profile?.avatar_url ? [{ text: t('account.photo.remove'), style: 'destructive' as const, onPress: run(photo.remove) }] : []),
      { text: t('account.cancel'), style: 'cancel' as const },
    ]);

  const confirmSignOut = () =>
    sheet(t('account.signOutTitle'), t('account.signOutBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('account.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView refreshControl={refresh} contentContainerClassName="gap-3 px-6" contentContainerStyle={{ paddingBottom: space }}>
        <Header title={t('tabs.account')} back={false} />
        <View className="gap-4 rounded-item bg-white p-4" style={{ boxShadow: shadows.soft }}>
          <View className="flex-row items-center gap-4">
            <PressableScale accessibilityRole="button" accessibilityLabel={t('account.photo.title')} onPress={photoMenu}>
              <Avatar path={profile?.avatar_url} name={profile?.full_name} size={64} />
              <View className="absolute -bottom-1 -end-1 h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-lime">
                <Camera size={14} color="#222E29" />
              </View>
            </PressableScale>
            <View className="flex-1 gap-0.5">
              <Text variant="heading" numberOfLines={1}>{profile?.full_name?.trim() || t('account.myAccount')}</Text>
              <Text variant="caption" className="text-muted" numberOfLines={1}>{session?.user.email}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="h-9 justify-center rounded-full bg-paper px-4"><Text variant="caption">{t('account.cars', { count: cars })}</Text></View>
            <PressableScale accessibilityRole="button" onPress={photoMenu} className="h-9 flex-1 items-center justify-center rounded-full bg-lime">
              <Text variant="label" className="text-[#222E29]">{t('account.photo.edit')}</Text>
            </PressableScale>
          </View>
        </View>
        {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
        <Text variant="caption" className="mt-2 px-1 text-muted">{t('account.group.preferences')}</Text>
        <Group>
          <Item icon={Languages} tone="paper" title={t('account.language')} aside={<Text variant="label">{t('account.languageName')}</Text>} onPress={switchLanguage} />
          <Item icon={Coins} tone="paper" title={t('account.currency')} aside={<Text variant="label">{t('account.currencyName')}</Text>} disabled />
          <Item icon={Moon} tone="paper" title={t('account.dark')} subtitle={t('account.darkSub')} aside={<Toggle value={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} label={t('account.dark')} />} />
          <Item icon={Bell} tone="mint" title={t('account.notifications')} subtitle={t('account.notificationsSub')} onPress={() => router.push('/account/notifications')} />
        </Group>
        <Text variant="caption" className="mt-2 px-1 text-muted">{t('account.group.data')}</Text>
        <Group>
          <Item icon={Crown} tone="paper" title={t('plans.account')} aside={plan ? <Text variant="label">{plan}</Text> : undefined} onPress={() => router.push('/plans')} />
          <Item icon={Download} tone="paper" title={t('account.export')} subtitle={t('account.exportSub')} onPress={() => router.push('/account/export')} />
          <Item icon={Repeat} tone="paper" title={t('account.share')} subtitle={t('account.shareSub')} onPress={() => router.push('/account/share')} />
        </Group>
        <View className="mt-2" />
        <Group>
          <Item icon={LogOut} tone="paper" title={t('account.signOut')} chevron={false} onPress={confirmSignOut} />
        </Group>

        <View className="mt-4 flex-row items-center gap-1">
          {(['privacy', 'terms', 'support'] as const).map((page, i) => (
            <Fragment key={page}>
              {i ? <Text variant="caption" className="text-muted">·</Text> : null}
              <Pressable accessibilityRole="link" className="min-h-11 justify-center" onPress={() => openPage(page)}>
                <Text variant="caption" className="text-muted">{t(`account.${page}`)}</Text>
              </Pressable>
            </Fragment>
          ))}
        </View>
        <View className="flex-row items-center justify-between">
          <Text variant="caption" className="text-muted">{t('account.version', { v: Constants.expoConfig?.version ?? '' })}</Text>
          {vehicle ? (
            <Pressable accessibilityRole="button" className="min-h-11 justify-center" onPress={() => router.push({ pathname: '/delete-vehicle', params: { vehicleId: vehicle.id } })}>
              <Text variant="caption" className="text-danger">{t('account.deleteVehicle')}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account')} className="min-h-11 justify-center self-start">
          <Text variant="caption" className="text-danger">{t('account.deleteAccount')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
