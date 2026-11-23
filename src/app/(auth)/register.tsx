import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { z } from 'zod';

import { signInWithApple, signInWithGoogle, useAppleAvailable, useGoogleAvailable } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { openPage } from '@/lib/links';
import { EMAIL_LINK } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { AuthBanner, AuthField, AuthScreen, AuthTitle, CheckRow, OrRule, StrengthBar, TextLink } from '@/components/auth/AuthKit';
import { AppleIcon, Button, GoogleIcon, Text } from '@/components/ui';

// v2 create account (design-v2 flow 9, screen 1). The name is asked on the next screens ("Your name"), not here.
const schema = (t: (k: string) => string) =>
  z
    .object({
      email: z.string().email(t('auth.common.errors.email')),
      password: z.string().min(8, t('auth.common.errors.passwordMin')),
      confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: t('auth.common.errors.passwordMismatch'),
      path: ['confirmPassword'],
    });

type Form = z.infer<ReturnType<typeof schema>>;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false); // store rule: an unticked box the user ticks themselves
  const google = useGoogleAvailable();
  const apple = useAppleAvailable();
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = async ({ email, password }: Form) => {
    setLoading(true);
    setError(null);
    // A guest (anonymous account, decisions Q17) upgrades in place: same user id, so their data stays.
    const { data } = await supabase.auth.getUser();
    const { error } = data.user?.is_anonymous
      ? await supabase.auth.updateUser({ email, password }, { emailRedirectTo: EMAIL_LINK })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: EMAIL_LINK } });
    setLoading(false);
    if (error) setError(errorText(error));
    else router.push({ pathname: '/verify-email', params: { email } });
  };

  const socialBusy = useRef(false);
  const social = async (fn: () => Promise<boolean>, fallback: 'errors.google' | 'errors.apple' = 'errors.google') => {
    if (!agreed || socialBusy.current) return; // a second tap would open a second sign-in sheet
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
      footer={
        <>
          <Button title={t('auth.v2.create')} loading={loading} disabled={!agreed} onPress={handleSubmit(onSubmit)} />
          <TextLink title={t('auth.v2.have')} onPress={() => router.replace('/login')} />
        </>
      }>
      <AuthTitle title={t('auth.v2.createTitle')} sub={t('auth.v2.createSub')} />
      {error ? <AuthBanner text={error} /> : null}

      <View className="mt-[22px] gap-[9px]">
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthField label={t('auth.v2.email')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email?.message} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          )}
        />
        <View>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <AuthField label={t('auth.v2.password')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.password?.message} secureTextEntry autoComplete="password-new" />
            )}
          />
          <StrengthBar password={password} />
        </View>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthField className="mt-1.5" label={t('auth.v2.password2')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.confirmPassword?.message} secureTextEntry autoComplete="password-new" />
          )}
        />
      </View>

      <CheckRow checked={agreed} onToggle={() => setAgreed(!agreed)}>
        <Text className="text-muted" style={{ fontSize: 13, lineHeight: 20 }}>
          <Trans
            i18nKey="auth.register.consent"
            components={{
              terms: <Text className="text-ink" style={{ fontSize: 13, textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => openPage('terms')} />,
              privacy: <Text className="text-ink" style={{ fontSize: 13, textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => openPage('privacy')} />,
            }}
          />
        </Text>
      </CheckRow>

      {google || apple ? (
        <View>
          <OrRule label={t('auth.common.or')} />
          <View className="gap-[9px]">
            {apple ? <Button title={t('auth.common.appleContinue')} icon={<AppleIcon />} variant="secondary" className="!h-[54px]" disabled={!agreed} onPress={() => social(signInWithApple, 'errors.apple')} /> : null}
            {google ? <Button title={t('auth.common.googleContinue')} icon={<GoogleIcon />} variant="secondary" className="!h-[54px]" disabled={!agreed} onPress={() => social(signInWithGoogle)} /> : null}
          </View>
        </View>
      ) : null}
    </AuthScreen>
  );
}
