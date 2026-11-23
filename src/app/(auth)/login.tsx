import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { signInWithApple, signInWithGoogle, useAppleAvailable, useGoogleAvailable } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { AuthBanner, AuthField, AuthScreen, AuthTitle, OrRule, TextLink } from '@/components/auth/AuthKit';
import { AppleIcon, Button, GoogleIcon, Text } from '@/components/ui';

// v2 sign in (design-v2 flow 8 "Wrong password" is this screen with `wrong` set).
const schema = (t: (k: string) => string) =>
  z.object({
    email: z.string().email(t('auth.common.errors.email')),
    password: z.string().min(6, t('auth.common.errors.passwordMin')),
  });

type Form = z.infer<ReturnType<typeof schema>>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false); // the server said the email/password pair is wrong
  const google = useGoogleAvailable();
  const apple = useAppleAvailable();
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async ({ email, password }: Form) => {
    setLoading(true);
    setError(null);
    setWrong(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error?.code === 'invalid_credentials') setWrong(true);
    else if (error) setError(errorText(error));
    else router.replace('/');
  };

  const socialBusy = useRef(false);
  const social = async (fn: () => Promise<boolean>, fallback?: 'errors.google' | 'errors.apple') => {
    if (socialBusy.current) return; // a second tap would open a second sign-in sheet
    socialBusy.current = true;
    try {
      if (await fn()) router.replace('/');
    } catch (e) {
      setError(errorText(e, fallback));
    } finally {
      socialBusy.current = false;
    }
  };

  return (
    <AuthScreen
      back={false}
      footer={
        <>
          <Button title={t('auth.v2.signIn')} loading={loading} onPress={handleSubmit(onSubmit)} />
          <TextLink title={`${t('auth.login.noAccount')} ${t('auth.login.createAccount')}`} onPress={() => router.replace('/register')} />
        </>
      }>
      <AuthTitle title={t('auth.v2.signTitle')} sub={t('auth.v2.signSub')} />

      {notice === 'passwordUpdated' ? <AuthBanner ok text={t('auth.login.passwordUpdated')} /> : null}
      {notice === 'linkExpired' ? <AuthBanner text={t('auth.login.linkExpired')} /> : null}
      {wrong ? <AuthBanner text={t('auth.v2.wrongBanner')} /> : error ? <AuthBanner text={error} /> : null}

      <View className="mt-4 gap-[9px]">
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthField label={t('auth.v2.email')} value={value} onChangeText={(v) => { setWrong(false); onChange(v); }} onBlur={onBlur} error={errors.email?.message} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthField label={t('auth.v2.password')} value={value} onChangeText={(v) => { setWrong(false); onChange(v); }} onBlur={onBlur} error={errors.password?.message ?? (wrong ? t('auth.v2.wrongField') : undefined)} bad={wrong} secureTextEntry autoComplete="password" />
          )}
        />
      </View>
      <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')} className="mt-3.5 min-h-11 justify-center self-start">
        <Text style={{ fontSize: 13.5, textDecorationLine: 'underline' }}>{t('auth.login.forgotPassword')}</Text>
      </Pressable>

      {google || apple ? (
        <View>
          <OrRule label={t('auth.common.or')} />
          <View className="gap-[9px]">
            {apple ? <Button title={t('auth.common.appleContinue')} icon={<AppleIcon />} variant="secondary" className="!h-[54px]" onPress={() => social(signInWithApple, 'errors.apple')} /> : null}
            {google ? <Button title={t('auth.common.googleContinue')} icon={<GoogleIcon />} variant="secondary" className="!h-[54px]" onPress={() => social(signInWithGoogle, 'errors.google')} /> : null}
          </View>
        </View>
      ) : null}
    </AuthScreen>
  );
}
