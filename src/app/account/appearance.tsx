import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Segment } from '@/components/money/Segment';
import { PressableScale, Text } from '@/components/ui';
import { applyLanguage } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { sheet } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';
import { useSettings, type Language, type Theme } from '@/stores/settingsStore';

// Appearance and language (v2 strip 10.2): language and theme as segmented pills, the two theme previews, units.
export default function AppearanceScreen() {
  const { t } = useTranslation();
  const userId = useSession()?.user.id;
  const { language, setLanguage, theme, setTheme } = useSettings();

  // The language change restarts the app, so it is confirmed first (same flow as before).
  const pickLanguage = (next: Language) => {
    if (next === language) return;
    sheet(t('account.switchTitle'), t('account.switchBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('account.switch'),
        onPress: () => {
          setLanguage(next);
          if (userId) supabase.from('profiles').update({ language: next }).eq('id', userId).then(() => {}); // best effort
          applyLanguage(next);
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <PageHeader title={t('account.appearance.title')} />
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-8 pt-2" showsVerticalScrollIndicator={false}>
        <Text variant="body" className="text-muted" style={{ fontSize: 14 }}>{t('account.language')}</Text>
        <View className="mt-2">
          <Segment<Language> value={language ?? 'ar'} onChange={pickLanguage} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        </View>
        <Text variant="caption" className="mx-1.5 mt-2 text-muted">{t('account.appearance.rtl')}</Text>

        <Text variant="body" className="mt-[22px] text-muted" style={{ fontSize: 14 }}>{t('account.appearance.theme')}</Text>
        <View className="mt-2">
          <Segment<Theme> value={theme} onChange={setTheme} options={[{ value: 'light', label: t('account.appearance.light') }, { value: 'dark', label: t('account.appearance.dark') }]} />
        </View>
        <View className="mt-3 flex-row gap-[9px]">
          <Preview dark={false} on={theme === 'light'} label={t('account.appearance.light')} onPress={() => setTheme('light')} />
          <Preview dark on={theme === 'dark'} label={t('account.appearance.dark')} onPress={() => setTheme('dark')} />
        </View>

        <Text variant="body" className="mt-[22px] text-muted" style={{ fontSize: 14 }}>{t('account.appearance.units')}</Text>
        <View className="mt-2 rounded-[22px] bg-white px-3.5 py-[18px]" style={{ boxShadow: shadows.ring }}>
          <Text variant="label" style={{ fontSize: 14.5 }}>{t('account.appearance.unitsValue')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A tile with a 66-high mini screen and a lime bar; the picked one gets the 2px ink ring. */
function Preview({ dark, on, label, onPress }: { dark: boolean; on: boolean; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <PressableScale accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} className="flex-1 rounded-[24px] bg-white p-3" style={{ boxShadow: on ? `0 0 0 2px ${c.ink}` : shadows.ring }}>
      <View className="h-[66px] items-center justify-end rounded-[14px] p-2" style={{ backgroundColor: dark ? '#0F1412' : '#F1F1F0', borderWidth: dark ? 0 : 1, borderColor: '#E7E8E6' }}>
        <View className="h-[14px] w-3/5 rounded-[7px]" style={{ backgroundColor: '#D3F53D' }} />
      </View>
    </PressableScale>
  );
}
