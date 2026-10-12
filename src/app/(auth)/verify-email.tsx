import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/lib/theme';
import { toast } from '@/components/Toast';
import { Button, Header, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

// Screen 50 — Check your email, Figma 167:57182 (ar-light) / 167:64828 (en-light).
export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [wait, setWait] = useState(0); // seconds until "Send it again" works
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const openMail = async () => {
    try {
      await Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:');
    } catch {} // no mail app: nothing to do
  };
  const resend = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setSending(false);
    if (error) return toast(errorText(error));
    setWait(60);
    toast(t('auth.verifyEmail.sent'));
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
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
        <View className="w-full gap-1 rounded-field bg-sky p-4">
          <Text variant="label">{t('auth.verifyEmail.resendTitle')}</Text>
          <Text variant="caption" className="text-muted">{t('auth.verifyEmail.resendBody')}</Text>
        </View>
      </View>
      <View className="gap-3 px-6 pb-6">
        <Button title={t('auth.verifyEmail.openMail')} onPress={openMail} />
        {email ? <Button variant="secondary" title={t('auth.verifyEmail.sendAgain')} loading={sending} disabled={wait > 0} onPress={resend} /> : null}
        <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} className="h-11 items-center justify-center">
          <Text variant="label" className="text-teal">{t('auth.common.backToLogin')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
