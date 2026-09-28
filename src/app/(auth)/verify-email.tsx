import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/lib/theme';
import { Button, Header, Text } from '@/components/ui';

// Screen 50 — Check your email (Figma design context unavailable this session: figma MCP hit the
// Starter plan rate limit. Built from docs/BESTIM-TECH-PLAN.md §6.)
export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <View className="flex-1 bg-paper">
      <View className="px-6 pt-3">
        <Header title="" back />
      </View>
      <View className="flex-1 items-center gap-3.5 px-6 pt-10">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-sky">
          <Mail size={36} color={c.teal} />
        </View>
        <Text variant="title" className="text-center">{t('auth.verifyEmail.title')}</Text>
        <Text className="text-center text-muted">
          {email ? t('auth.verifyEmail.subtitleWithEmail', { email }) : t('auth.verifyEmail.subtitle')}
        </Text>
      </View>
      <View className="px-6 pb-6">
        <Button title={t('auth.verifyEmail.backToLogin')} onPress={() => router.replace('/login')} />
      </View>
    </View>
  );
}
