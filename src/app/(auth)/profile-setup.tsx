import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { Button, Field, Header, Note, Text } from '@/components/ui';

// Screen 32 — Your profile, Figma 167:57093 (ar-light) / 167:64739 (en-light).
const schema = (t: (k: string) => string) => z.object({ fullName: z.string().min(1, t('auth.common.errors.fullNameRequired')) });
type Form = z.infer<ReturnType<typeof schema>>;

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const session = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { fullName: (session?.user.user_metadata?.full_name as string) ?? '' },
  });

  const onSubmit = async ({ fullName }: Form) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', session.user.id);
    setLoading(false);
    if (error) setError(error.message);
    else router.replace('/tour-voice');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-3">
          <Header title={t('auth.profileSetup.title')} />
        </View>
        <View className="gap-3.5 px-6 pt-2">
          <Text variant="title">{t('auth.profileSetup.heading')}</Text>
          <Text className="text-muted">{t('auth.profileSetup.subtitle')}</Text>

          <View className="flex-row items-center justify-between">
            <Text className="text-muted">{t('auth.profileSetup.addPhoto')}</Text>
            {/* ponytail: avatar upload once expo-image-picker is added */}
            <Pressable className="h-20 w-20 items-center justify-center rounded-full bg-lime">
              <Camera size={28} color={c.ink} />
            </Pressable>
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

          <Button title={t('auth.profileSetup.submit')} loading={loading} onPress={handleSubmit(onSubmit)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
