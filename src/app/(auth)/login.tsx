import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button, Divider, Field, Header, Note, Text, GoogleIcon } from '@/components/ui';

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
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async ({ email, password }: Form) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.replace('/');
  };

  const social = async (fn: () => Promise<boolean>) => {
    try {
      if (await fn()) router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-3">
          <Header title={t('auth.login.title')} />
        </View>
        <View className="gap-3.5 px-6 pt-2">
          <Text variant="title">{t('auth.login.heading')}</Text>
          <Text className="text-muted">{t('auth.login.subtitle')}</Text>

          {notice === 'passwordUpdated' ? <Note text={t('auth.login.passwordUpdated')} tone="success" /> : null}
          {notice === 'linkExpired' ? <Note text={t('auth.login.linkExpired')} tone="warning" /> : null}

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
          <Pressable onPress={() => router.push('/forgot-password')} className="self-end">
            <Text variant="label" className="text-teal">{t('auth.login.forgotPassword')}</Text>
          </Pressable>

          {error ? <Note text={error} tone="warning" /> : null}

          <Button title={t('auth.login.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />

          <Divider label={t('auth.common.or')} />
          <View className="flex-row gap-2.5">
            <Button title={t('auth.common.google')} icon={<GoogleIcon />} variant="secondary" className="flex-1" onPress={() => social(signInWithGoogle)} />
          </View>

          <View className="flex-row justify-center gap-1.5 pt-2">
            <Text className="text-muted">{t('auth.login.noAccount')}</Text>
            <Pressable onPress={() => router.push('/register')}>
              <Text variant="label" className="text-teal">{t('auth.login.createAccount')}</Text>
            </Pressable>
          </View>

          {/* auth.login.continueAsGuest is kept for guest home (screen 36, Phase 3) — button returns then. */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
