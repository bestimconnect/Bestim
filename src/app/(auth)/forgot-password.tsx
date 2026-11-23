import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { errorText } from '@/lib/errors';
import { EMAIL_LINK } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { AuthBanner, AuthField, AuthScreen, AuthTitle, TextLink } from '@/components/auth/AuthKit';
import { Button } from '@/components/ui';

// v2 forgot password (design-v2 flow 9, screen 3).
const schema = (t: (k: string) => string) => z.object({ email: z.string().email(t('auth.common.errors.email')) });
type Form = z.infer<ReturnType<typeof schema>>;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }: Form) => {
    setLoading(true);
    setError(null);
    setSent(false);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: EMAIL_LINK });
    setLoading(false);
    if (error) setError(errorText(error));
    else setSent(true); // v2 flow 9 #3: the green "we sent it, open your mail" banner under the field (pressing the button again resends)
  };

  return (
    <AuthScreen
      footer={
        <>
          <Button title={t('auth.v2.forgotSend')} loading={loading} onPress={handleSubmit(onSubmit)} />
          <TextLink title={t('auth.v2.backSign')} onPress={() => router.replace('/login')} />
        </>
      }>
      <AuthTitle title={t('auth.v2.forgotTitle')} sub={t('auth.v2.forgotSub')} />
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthField className="mt-[22px]" label={t('auth.v2.email')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email?.message} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        )}
      />
      {sent ? <AuthBanner ok text={t('auth.v2.forgotSent')} /> : null}
      {error ? <AuthBanner text={error} /> : null}
    </AuthScreen>
  );
}
