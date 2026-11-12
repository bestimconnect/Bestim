import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trans, useTranslation } from 'react-i18next';
import { z } from 'zod';

import { signInWithApple, signInWithGoogle, useAppleAvailable, useGoogleAvailable } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { openPage } from '@/lib/links';
import { EMAIL_LINK } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { BrandBlock } from '@/components/BrandBlock';
import { AppleIcon, Backdrop, Button, Divider, Field, FooterBar, GoogleIcon, Header, Note, Text } from '@/components/ui';

// Screen 31 — Create account, Figma 167:57037 (ar-light) / 167:64683 (en-light).
const schema = (t: (k: string) => string) =>
  z
    .object({
      fullName: z.string().min(1, t('auth.common.errors.fullNameRequired')),
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
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ fullName, email, password }: Form) => {
    setLoading(true);
    setError(null);
    // A guest (anonymous account, decisions Q17) upgrades in place: same user id, so their data stays.
    const { data } = await supabase.auth.getUser();
    const { error } = data.user?.is_anonymous
      ? await supabase.auth.updateUser({ email, password, data: { full_name: fullName } }, { emailRedirectTo: EMAIL_LINK }).then(async (r) => {
          if (!r.error) await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user!.id);
          return r;
        })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: EMAIL_LINK } });
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
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <ScrollView className="flex-1" contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View className="px-6 pt-3">
          <Header title="" />
        </View>
        <View className="gap-6 px-6 pt-1">
          <BrandBlock />
          <View className="gap-2">
            <Text variant="title">{t('auth.register.heading')}</Text>
            <Text className="text-muted">{t('auth.register.subtitle')}</Text>
          </View>

          <View className="gap-3">
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('auth.register.fullName')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.fullName?.message}
                  autoComplete="name"
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('auth.register.email')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('auth.register.password')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry
                  autoComplete="password-new"
                />
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('auth.register.confirmPassword')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                  secureTextEntry
                  autoComplete="password-new"
                />
              )}
            />
          </View>

          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed(!agreed)} className="min-h-11 flex-row items-center gap-3">
            <View className={`h-6 w-6 items-center justify-center rounded-md border ${agreed ? 'border-teal bg-teal' : 'border-line bg-white'}`}>
              {agreed ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <Text variant="caption" className="flex-1 text-muted">
              <Trans
                i18nKey="auth.register.consent"
                components={{
                  terms: <Text variant="caption" className="text-teal" accessibilityRole="link" onPress={() => openPage('terms')} />,
                  privacy: <Text variant="caption" className="text-teal" accessibilityRole="link" onPress={() => openPage('privacy')} />,
                }}
              />
            </Text>
          </Pressable>

          {error ? <Note text={error} tone="warning" /> : null}

          {google || apple ? (
            <View className="gap-3">
              <Divider label={t('auth.common.or')} />
              {apple ? <Button title={t('auth.common.appleContinue')} icon={<AppleIcon />} variant="secondary" disabled={!agreed} onPress={() => social(signInWithApple, 'errors.apple')} /> : null}
              {google ? <Button title={t('auth.common.googleContinue')} icon={<GoogleIcon />} variant="secondary" disabled={!agreed} onPress={() => social(signInWithGoogle)} /> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('auth.register.submit')} loading={loading} disabled={!agreed} onPress={handleSubmit(onSubmit)} />
        <View className="flex-row items-center justify-center gap-1.5">
          <Text className="text-muted">{t('auth.register.haveAccount')}</Text>
          <Pressable onPress={() => router.replace('/login')} className="min-h-11 justify-center">
            <Text variant="label" className="text-teal">{t('auth.register.signIn')}</Text>
          </Pressable>
        </View>
      </FooterBar>
    </SafeAreaView>
  );
}
