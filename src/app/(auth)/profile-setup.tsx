import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { User } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { errorText } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { Backdrop, Button, Field, FooterBar, Header, Note, Sheen, Text } from '@/components/ui';

// Screen 32 — Your profile, Figma 167:57093 (ar-light) / 167:64739 (en-light).
const schema = (t: (k: string) => string) => z.object({ fullName: z.string().min(1, t('auth.common.errors.fullNameRequired')) });
type Form = z.infer<ReturnType<typeof schema>>;

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const c = useColors();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { fullName: (session?.user.user_metadata?.full_name as string) ?? '' },
  });

  const initial = useWatch({ control, name: 'fullName' }).trim().charAt(0).toUpperCase();

  const onSubmit = async ({ fullName }: Form) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', session.user.id);
    setLoading(false);
    if (error) setError(errorText(error));
    else router.replace('/add-vehicle');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <ScrollView className="flex-1" contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View className="px-6 pt-3">
          <Header title="" />
        </View>
        <View className="gap-6 px-6 pt-2">
          <View className="h-24 w-24 items-center justify-center self-center overflow-hidden rounded-full bg-mint">
            <Sheen color="#FFFFFF" opacity={0.6} glow="tl" />
            {initial ? <Text variant="display" className="text-teal">{initial}</Text> : <User size={40} color={c.teal} />}
          </View>
          <View className="gap-2">
            <Text variant="title">{t('auth.profileSetup.heading')}</Text>
            <Text className="text-muted">{t('auth.profileSetup.subtitle')}</Text>
          </View>

          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label={t('auth.profileSetup.fullName')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.fullName?.message}
                autoComplete="name"
              />
            )}
          />

          {error ? <Note text={error} tone="warning" /> : null}
        </View>
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('auth.profileSetup.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />
      </FooterBar>
    </SafeAreaView>
  );
}
