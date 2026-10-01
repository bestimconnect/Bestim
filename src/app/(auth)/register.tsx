import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button, Divider, Field, Header, Note, Text, GoogleIcon } from '@/components/ui';

// Screen 31 — Create account, Figma 167:57037 (ar-light) / 167:64683 (en-light).
const schema = (t: (k: string) => string) =>
  z
    .object({
      fullName: z.string().min(1, t('auth.common.errors.fullNameRequired')),
      email: z.string().email(t('auth.common.errors.email')),
      password: z.string().min(6, t('auth.common.errors.passwordMin')),
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
      ? await supabase.auth.updateUser({ email, password, data: { full_name: fullName } }).then(async (r) => {
          if (!r.error) await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user!.id);
          return r;
        })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    setLoading(false);
    if (error) setError(error.message);
    else router.push({ pathname: '/verify-email', params: { email } });
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
          <Header title={t('auth.register.title')} />
        </View>
        <View className="gap-3.5 px-6 pt-2">
        <Text variant="title">{t('auth.register.heading')}</Text>
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

        {error ? <Note text={error} tone="warning" /> : null}

        <Button title={t('auth.register.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />

        <Divider label={t('auth.common.or')} />
        <View className="flex-row gap-2.5">
          <Button title={t('auth.common.google')} icon={<GoogleIcon />} variant="secondary" className="flex-1" onPress={() => social(signInWithGoogle)} />
        </View>

        <View className="flex-row justify-center gap-1.5 pt-2">
          <Text className="text-muted">{t('auth.register.haveAccount')}</Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text variant="label" className="text-teal">{t('auth.register.signIn')}</Text>
          </Pressable>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
