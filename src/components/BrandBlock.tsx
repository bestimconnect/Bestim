import { Image } from 'expo-image';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheen, Text } from '@/components/ui';
import { shadows } from '@/lib/theme';

/** The brand card on top of sign in / create account: the same dark surface and lime light as the splash. */
export function BrandBlock() {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-2 overflow-hidden rounded-[28px] bg-panel py-6" style={{ boxShadow: shadows.soft }}>
      <Sheen color="#D3F53D" opacity={0.3} glow="tr" radius={1.2} />
      <Image source={require('@/assets/images/logo-word-inverse.png')} contentFit="contain" style={{ width: 170, height: 37 }} accessibilityLabel="Bestim" />
      <Text variant="caption" className="px-6 text-center text-[#D3F53D]">{t('splash.promise')}</Text>
    </View>
  );
}
