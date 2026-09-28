import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { Button, Field, Header, Note, Text } from '@/components/ui';

// Screen 49 — Forgot password (Figma design context unavailable this session: figma MCP hit the
// Starter plan rate limit. Built from docs/BESTIM-TECH-PLAN.md §6.)
const schema = (t: (k: string) => string) => z.object({ email: z.string().email(t('auth.common.errors.email')) });
type Form = z.infer<ReturnType<typeof schema>>;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }: Form) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) setError(error.message);
    else router.push({ pathname: '/verify-email', params: { email } });
  };

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
      <View className="px-6 pt-3">
        <Header title={t('auth.forgotPassword.title')} />
      </View>
      <View className="gap-3.5 px-6 pt-2">
        <Text className="text-muted">{t('auth.forgotPassword.subtitle')}</Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label={t('auth.forgotPassword.email')}
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

        {error ? <Note text={error} tone="warning" /> : null}

        <Button title={t('auth.forgotPassword.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />
      </View>
    </ScrollView>
  );
}
