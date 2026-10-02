import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bell, Download, Moon, Repeat, User, Wallet, LogOut } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Item, Text, Toggle, PressableScale } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { applyLanguage } from '@/lib/i18n';
import { useCurrentVehicle, useProfile } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { sheet } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL;

// Screen 26 — Account & settings (Q33, Q35, Q36, Q48); Figma 167:59659
export default function AccountScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const userId = useSession()?.user.id;
  const { language, setLanguage, theme, setTheme } = useSettings();
  const { vehicle } = useCurrentVehicle();
  const { data: profile } = useProfile();

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
      <ScrollView contentContainerClassName="gap-3 px-6 pt-6" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="flex-row items-center gap-4 pb-3">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-lime">
            <User size={28} color="#222E29" />
          </View>
          <View className="flex-1 gap-1">
            <Text variant="title">{profile?.full_name?.trim() || t('account.myAccount')}</Text>
            <Text variant="caption" className="text-muted">{t('account.subtitle')}</Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <PressableScale
            accessibilityRole="button"
            onPress={switchLanguage}
            className="flex-1 gap-1 rounded-item bg-white p-4"
            style={{ boxShadow: shadows.soft }}>
            <Text variant="caption" className="text-muted">{t('account.language')}</Text>
            <Text variant="label">{t('account.languageName')}</Text>
          </PressableScale>
          <View className="flex-1 gap-1 rounded-item bg-white p-4" style={{ boxShadow: shadows.soft }}>
            <Text variant="caption" className="text-muted">{t('account.currency')}</Text>
            <Text variant="label">{t('account.currencyName')}</Text>
          </View>
        </View>

        <Item icon={Wallet} tone="sky" title={t('expenses.title')} subtitle={t('account.expensesSub')} onPress={() => router.push('/account/expenses')} />
        <Item icon={Bell} tone="mint" title={t('account.notifications')} subtitle={t('account.notificationsSub')} onPress={() => router.push('/account/notifications')} />
        <Item icon={Download} tone="paper" title={t('account.export')} subtitle={t('account.exportSub')} onPress={() => router.push('/account/export')} />
        <Item icon={Repeat} tone="paper" title={t('account.share')} subtitle={t('account.shareSub')} onPress={() => router.push('/account/share')} />
        <View className="min-h-[72px] flex-row items-center gap-3 rounded-item bg-white p-3.5" style={{ boxShadow: shadows.soft }}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-paper">
            <Moon size={20} color={c.teal} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="label">{t('account.dark')}</Text>
            <Text variant="caption" className="text-muted">{t('account.darkSub')}</Text>
          </View>
          <Toggle value={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} label={t('account.dark')} />
        </View>
        <Item icon={LogOut} tone="paper" title={t('account.signOut')} chevron={false} onPress={confirmSignOut} />

        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            {privacyUrl ? (
              <>
                <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(privacyUrl)}>
                  <Text variant="caption" className="text-muted">{t('account.privacy')}</Text>
                </Pressable>
                <Text variant="caption" className="text-muted">·</Text>
              </>
            ) : null}
            <Text variant="caption" className="text-muted">{t('account.version', { v: Constants.expoConfig?.version ?? '' })}</Text>
          </View>
          {vehicle ? (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/delete-vehicle', params: { vehicleId: vehicle.id } })}>
              <Text variant="caption" className="text-danger">{t('account.deleteVehicle')}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account')} className="self-start">
          <Text variant="caption" className="text-danger">{t('account.deleteAccount')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
