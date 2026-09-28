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

// Screen 30 — Sign in (Figma design context unavailable this session: figma MCP hit the Starter
// plan rate limit. Built from docs/BESTIM-TECH-PLAN.md §6 and the conventions in language.tsx.)
const schema = (t: (k: string) => string) =>
  z.object({
    email: z.string().email(t('auth.common.errors.email')),
    password: z.string().min(6, t('auth.common.errors.passwordMin')),
  });

type Form = z.infer<ReturnType<typeof schema>>;

export default function LoginScreen() {
  const { t } = useTranslation();
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
        <Header title={t('auth.login.title')} />
      </View>
      <View className="gap-3.5 px-6 pt-2">
        <Text className="text-muted">{t('auth.login.subtitle')}</Text>

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
        <Button title={t('auth.common.google')} variant="secondary" onPress={() => social(signInWithGoogle)} />
        {Platform.OS === 'ios' ? (
          <Button title={t('auth.common.apple')} variant="secondary" onPress={() => social(signInWithApple)} />
        ) : null}

        <View className="flex-row justify-center gap-1.5 pt-2">
          <Text className="text-muted">{t('auth.login.noAccount')}</Text>
          <Pressable onPress={() => router.push('/register')}>
            <Text variant="label" className="text-teal">{t('auth.login.createAccount')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
