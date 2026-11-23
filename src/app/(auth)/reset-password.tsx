import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { AuthBanner, AuthField, AuthScreen, AuthTitle, StrengthBar } from '@/components/auth/AuthKit';
import { Button } from '@/components/ui';

// v2 new password (design-v2 flow 9, screen 4). Lands the password-recovery deep link somewhere before /login (see docs/decisions.md Q1).
const schema = (t: (k: string) => string) =>
  z
    .object({
      password: z.string().min(8, t('auth.common.errors.passwordMin')),
      confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: t('auth.common.errors.passwordMismatch'),
      path: ['confirmPassword'],
    });
type Form = z.infer<ReturnType<typeof schema>>;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = async ({ password }: Form) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(errorText(error));
      return;
    }
    await supabase.auth.signOut();
    router.replace({ pathname: '/login', params: { notice: 'passwordUpdated' } });
  };

  return (
    <AuthScreen footer={<Button title={t('auth.v2.newSave')} loading={loading} onPress={handleSubmit(onSubmit)} />}>
      <AuthTitle title={t('auth.v2.newTitle')} sub={t('auth.v2.newSub')} />
      {error ? <AuthBanner text={error} /> : null}
      <View className="mt-[22px]">
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthField label={t('auth.v2.newPassword')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.password?.message} secureTextEntry autoComplete="password-new" />
          )}
        />
        <StrengthBar password={password} />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthField className="mt-3" label={t('auth.v2.password2')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.confirmPassword?.message} secureTextEntry autoComplete="password-new" />
          )}
        />
      </View>
    </AuthScreen>
  );
}
