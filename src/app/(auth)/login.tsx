import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { signInWithApple, signInWithGoogle, useAppleAvailable, useGoogleAvailable } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { BrandBlock } from '@/components/BrandBlock';
import { AppleIcon, Backdrop, Button, Divider, Field, FooterBar, GoogleIcon, Header, Note, Text } from '@/components/ui';

// Screen 30 — Sign in, Figma 167:56978 (ar-light) / 167:64624 (en-light).
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
  const google = useGoogleAvailable();
  const apple = useAppleAvailable();
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async ({ email, password }: Form) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(errorText(error));
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
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <ScrollView className="flex-1" contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View className="px-6 pt-3">
          <Header title="" />
        </View>
        <View className="gap-6 px-6 pt-1">
          <BrandBlock />
          <View className="gap-2">
            <Text variant="title">{t('auth.login.heading')}</Text>
            <Text className="text-muted">{t('auth.login.subtitle')}</Text>
          </View>

          {notice === 'passwordUpdated' ? <Note text={t('auth.login.passwordUpdated')} tone="success" /> : null}
          {notice === 'linkExpired' ? <Note text={t('auth.login.linkExpired')} tone="warning" /> : null}

          <View className="gap-3">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('auth.login.email')}
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
                  label={t('auth.login.password')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry
                  autoComplete="password"
                />
              )}
            />
            <Button title={t('auth.login.forgotPassword')} variant="ghost" size="sm" className="self-end" hitSlop={{ top: 2, bottom: 2 }} onPress={() => router.push('/forgot-password')} />
          </View>

          {error ? <Note text={error} tone="warning" /> : null}

          {google || apple ? (
            <View className="gap-3">
              <Divider label={t('auth.common.or')} />
              {apple ? <Button title={t('auth.common.appleContinue')} icon={<AppleIcon />} variant="secondary" onPress={() => social(signInWithApple, 'errors.apple')} /> : null}
              {google ? <Button title={t('auth.common.googleContinue')} icon={<GoogleIcon />} variant="secondary" onPress={() => social(signInWithGoogle, 'errors.google')} /> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('auth.login.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />
        <View className="flex-row items-center justify-center gap-1.5">
          <Text className="text-muted">{t('auth.login.noAccount')}</Text>
          <Pressable onPress={() => router.replace('/register')} className="min-h-11 justify-center">
            <Text variant="label" className="text-teal">{t('auth.login.createAccount')}</Text>
          </Pressable>
        </View>
      </FooterBar>
    </SafeAreaView>
  );
}
