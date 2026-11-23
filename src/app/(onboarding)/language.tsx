import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, FooterBar, PressableScale, Text } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { type Language, useSettings } from '@/stores/settingsStore';

// First screen after the splash (v2): the logo, two big option cards, Continue. Shown once (settingsStore.langPicked); the phone's
// language is preselected. Continue saves the choice (the gate in _layout applies it and flips the layout) and opens the welcome slides.
const OPTIONS: { id: Language; badge: string }[] = [
  { id: 'ar', badge: 'ع' },
  { id: 'en', badge: 'En' },
];

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const [picked, setPicked] = useState<Language>(i18n.language === 'en' ? 'en' : 'ar');
  const Arrow = I18nManager.isRTL ? ArrowLeft : ArrowRight;

  const go = () => {
    const s = useSettings.getState();
    s.set({ langPicked: true });
    if (s.language !== picked) s.setLanguage(picked);
    router.replace('/intro');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-7">
        <Image source={require('@/assets/images/logo-mark.png')} contentFit="contain" style={{ width: 64, height: 48, alignSelf: 'flex-start' }} />
        <Text variant="title" className="mt-6 !text-[30px] !leading-[38px]">{t('onboarding.lang.title')}</Text>
        <Text className="mt-1.5 !text-[14px] text-muted">{t('onboarding.lang.sub')}</Text>
        <View className="mt-7 gap-[11px]">
          {OPTIONS.map(({ id, badge }) => {
            const on = picked === id;
            return (
              <PressableScale
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setPicked(id)}
                className="flex-row items-center gap-3.5 rounded-[24px] bg-white p-[18px]"
                style={{ boxShadow: on ? `0 0 0 2px ${c.ink}` : '0 0 0 1px rgba(0,0,0,0.03)' }}>
                <View className={`h-[46px] w-[46px] items-center justify-center rounded-full ${on ? 'bg-lime' : 'bg-paper'}`}>
                  <Text variant="label" className="text-[#171B19]">{badge}</Text>
                </View>
                <Text className="flex-1 !text-[19px]">{t(`language.${id}`)}</Text>
                {on ? (
                  <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-ink">
                    <Check size={13} color={c.paper} strokeWidth={3} />
                  </View>
                ) : (
                  <View className="h-[22px] w-[22px] rounded-full border-[1.6px] border-muted" />
                )}
              </PressableScale>
            );
          })}
        </View>
      </View>
      <FooterBar inset={false}>
        <Button title={t('onboarding.lang.continue')} onPress={go} icon={<Arrow size={18} color={c.onbtn} strokeWidth={2} />} />
      </FooterBar>
    </SafeAreaView>
  );
}
