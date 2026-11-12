import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { toast } from '@/components/Toast';
import { Backdrop, Button, Card, FooterBar, Header, IconTile, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { EMAIL_LINK } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Screen 50 — Check your email, Figma 167:57182 (ar-light) / 167:64828 (en-light).
export default function VerifyEmailScreen() {
  const { t } = useTranslation();
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
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: EMAIL_LINK } });
    setSending(false);
    if (error) return toast(errorText(error));
    setWait(60);
    toast(t('auth.verifyEmail.sent'));
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <View className="px-6 pt-3">
        <Header title="" back />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="grow items-center justify-center gap-4 px-6 pb-6">
        <IconTile icon={Mail} tone="sky" size={88} />
        <Text variant="title" className="text-center">{t('auth.verifyEmail.title')}</Text>
        <Text className="text-center text-muted">
          {email ? t('auth.verifyEmail.subtitleWithEmail', { email }) : t('auth.verifyEmail.subtitle')}
        </Text>
        <Card tone="sky" className="mt-2 w-full gap-1 p-4">
          <Text variant="label">{t('auth.verifyEmail.resendTitle')}</Text>
          <Text variant="caption" className="text-muted">{t('auth.verifyEmail.resendBody')}</Text>
        </Card>
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('auth.verifyEmail.openMail')} onPress={openMail} />
        {email ? <Button variant="secondary" title={t('auth.verifyEmail.sendAgain')} loading={sending} disabled={wait > 0} onPress={resend} /> : null}
        <Button variant="ghost" title={t('auth.common.backToLogin')} onPress={() => router.replace('/login')} />
      </FooterBar>
    </SafeAreaView>
  );
}
