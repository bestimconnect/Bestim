import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, Globe } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fromLeft, Hero } from '@/components/Hero';
import { Button, Item, Text } from '@/components/ui';
import { applyLanguage } from '@/lib/i18n';
import { useSettings, type Language } from '@/stores/settingsStore';

// Screen 01 — Figma 167:56833
export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const setLanguage = useSettings((s) => s.setLanguage);
  const [picked, setPicked] = useState<Language>((i18n.language as Language) ?? 'ar');

  const choose = (l: Language) => {
    setPicked(l);
    i18n.changeLanguage(l); // preview copy immediately; layout direction flips on confirm
  };
  const confirm = () => {
    setLanguage(picked);
    router.replace('/welcome');
    applyLanguage(picked);
  };

  const option = (l: Language) => (
    <Item
      key={l}
      icon={picked === l ? Check : Globe}
      tone={picked === l ? 'mint' : 'paper'}
      title={t(`language.${l}`)}
      subtitle={t(`language.${l}Region`)}
      accessibilityState={{ selected: picked === l }}
      onPress={() => choose(l)}
    />
  );

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="pb-10" bounces={false}>
      <Hero>
        <Image
          source={require('@/assets/images/illustration-gauge.svg')}
          style={{ position: 'absolute', top: 110, width: 342, height: 180, ...fromLeft(80) }}
        />
      </Hero>
      <View className="gap-3.5 px-6 pt-[30px]">
        <Text variant="title">{t('language.title')}</Text>
        <Text className="text-muted">{t('language.body')}</Text>
        {option('ar')}
        {option('en')}
        <Button title={t('language.cta')} onPress={confirm} />
      </View>
    </ScrollView>
  );
}
