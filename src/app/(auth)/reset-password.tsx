import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Backdrop, Button, Field, FooterBar, Header, IconTile, Note, Text } from '@/components/ui';

// Screen 49 layout — Figma 167:57136 (ar-light) / 167:64782 (en-light). New screen, not in the
// design: lands the password-recovery deep link somewhere before /login (see docs/decisions.md Q1).
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
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <ScrollView className="flex-1" contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-3">
          <Header title="" />
        </View>
        <View className="gap-6 px-6 pt-2">
          <IconTile icon={LockKeyhole} size={72} />
          <View className="gap-2">
            <Text variant="title">{t('auth.resetPassword.heading')}</Text>
            <Text className="text-muted">{t('auth.resetPassword.subtitle')}</Text>
          </View>

          <View className="gap-3">
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('auth.resetPassword.password')}
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
                  label={t('auth.resetPassword.confirmPassword')}
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

          {error ? <Note text={error} tone="warning" /> : null}
        </View>
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('auth.resetPassword.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />
      </FooterBar>
    </SafeAreaView>
  );
}
