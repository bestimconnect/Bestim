import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { shadows } from '@/lib/theme';
import { Linking, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { toast } from '@/components/Toast';
import { AuthScreen, TextLink } from '@/components/auth/AuthKit';
import { Button, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { EMAIL_LINK } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// v2 confirm email (design-v2 flow 9, screen 2): lime mail circle, open the mail app, resend with a countdown.
export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [wait, setWait] = useState(60); // seconds until "Send it again" works (the link was just sent)
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

  const mmss = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
  return (
    <AuthScreen
      footer={
        <>
          <Button title={t('auth.v2.verifyOpen')} onPress={openMail} />
          {email ? (
            <Button variant="secondary" title={wait > 0 ? `${t('auth.v2.verifyAgain')} · ${t('auth.v2.verifyIn', { time: mmss })}` : t('auth.v2.verifyAgain')} loading={sending} disabled={wait > 0} onPress={resend} />
          ) : null}
          <TextLink title={t('auth.v2.verifyChange')} onPress={() => router.back()} />
        </>
      }>
      <View className="mt-11 h-[104px] w-[104px] items-center justify-center self-center rounded-full bg-lime" style={{ boxShadow: shadows.ring }}>
        <Mail size={44} color="#171B19" strokeWidth={1.8} />
      </View>
      <Text variant="title" className="mt-7 text-center" style={{ letterSpacing: -0.5 }}>{t('auth.v2.verifyTitle')}</Text>
      <Text className="mt-2 text-center text-muted" style={{ fontSize: 15, lineHeight: 24 }}>{t('auth.v2.verifySub')}</Text>
      {email ? <Text className="text-center" style={{ fontSize: 15, lineHeight: 24, writingDirection: 'ltr' }}>{email}</Text> : null}
    </AuthScreen>
  );
}
