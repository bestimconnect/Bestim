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

// Screen 49 — Forgot password, Figma 167:57136 (ar-light) / 167:64782 (en-light).
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
    if (error) setError(errorText(error));
    else router.push({ pathname: '/verify-email', params: { email } });
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
            <Text variant="title">{t('auth.forgotPassword.heading')}</Text>
            <Text className="text-muted">{t('auth.forgotPassword.subtitle')}</Text>
          </View>

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
        </View>
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('auth.forgotPassword.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />
        <Button title={t('auth.common.backToLogin')} variant="ghost" onPress={() => router.replace('/login')} />
      </FooterBar>
    </SafeAreaView>
  );
}
