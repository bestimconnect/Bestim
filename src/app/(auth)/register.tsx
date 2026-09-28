import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { signInWithApple, signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button, Divider, Field, Header, Note, Text } from '@/components/ui';

// Screen 31 — Create account (Figma design context unavailable this session: figma MCP hit the
// Starter plan rate limit. Built from docs/BESTIM-TECH-PLAN.md §6 and login.tsx's pattern.)
const schema = (t: (k: string) => string) =>
  z.object({
    fullName: z.string().min(1, t('auth.common.errors.fullNameRequired')),
    email: z.string().email(t('auth.common.errors.email')),
    password: z.string().min(6, t('auth.common.errors.passwordMin')),
  });

type Form = z.infer<ReturnType<typeof schema>>;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const onSubmit = async ({ fullName, email, password }: Form) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    setLoading(false);
    if (error) setError(error.message);
    else router.push({ pathname: '/verify-email', params: { email } });
  };

  const social = async (fn: () => Promise<never>) => {
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
      <View className="px-6 pt-3">
        <Header title={t('auth.register.title')} />
      </View>
      <View className="gap-3.5 px-6 pt-2">
        <Text className="text-muted">{t('auth.register.subtitle')}</Text>

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

        {error ? <Note text={error} tone="warning" /> : null}

        <Button title={t('auth.register.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />

        <Divider label={t('auth.common.or')} />
        <Button title={t('auth.common.google')} variant="secondary" onPress={() => social(signInWithGoogle)} />
        {Platform.OS === 'ios' ? (
          <Button title={t('auth.common.apple')} variant="secondary" onPress={() => social(signInWithApple)} />
        ) : null}

        <View className="flex-row justify-center gap-1.5 pt-2">
          <Text className="text-muted">{t('auth.register.haveAccount')}</Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text variant="label" className="text-teal">{t('auth.register.signIn')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
