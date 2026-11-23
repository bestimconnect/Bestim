import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Camera, User } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Avatar } from '@/components/Avatar';
import { DENIED, useAvatarActions } from '@/lib/avatar';
import { errorText } from '@/lib/errors';
import { useProfile } from '@/lib/queries';
import { sheet } from '@/lib/sheet';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { AuthBanner, AuthField, AuthScreen, AuthTitle } from '@/components/auth/AuthKit';
import { Button, PressableScale, Text } from '@/components/ui';

// v2 your name (design-v2 flow 9, screen 5): step counter and bar, the photo (same sheet as Edit profile) and the name.
// ponytail: the optional phone field is left out: profiles has no phone column yet.
const schema = (t: (k: string) => string) => z.object({ fullName: z.string().min(1, t('auth.common.errors.fullNameRequired')) });
type Form = z.infer<ReturnType<typeof schema>>;

export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const { data: profile } = useProfile();
  const photo = useAvatarActions(session?.user.id, profile?.avatar_url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema(t)),
    defaultValues: { fullName: (session?.user.user_metadata?.full_name as string) ?? '' },
  });

  const initial = useWatch({ control, name: 'fullName' }).trim().charAt(0).toUpperCase();

  const run = (job: () => Promise<unknown>) => () => {
    setError(null);
    job().catch((e) => setError(t(e?.message === DENIED ? 'account.photo.denied' : 'account.photo.failed')));
  };
  const photoMenu = () =>
    sheet(t('account.photo.title'), undefined, [
      { text: t('account.photo.take'), onPress: run(() => photo.pick('camera')) },
      { text: t('account.photo.choose'), onPress: run(() => photo.pick('library')) },
      ...(profile?.avatar_url ? [{ text: t('account.photo.remove'), style: 'destructive' as const, onPress: run(photo.remove) }] : []),
      { text: t('account.cancel'), style: 'cancel' as const },
    ]);

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
    <AuthScreen right={<Text variant="caption" className="text-muted">1 / 1</Text>} footer={<Button title={t('auth.v2.next')} loading={loading} onPress={handleSubmit(onSubmit)} />}>
      <View className="mt-3 h-1 rounded-full bg-ink" />
      <AuthTitle title={t('auth.v2.nameTitle')} sub={t('auth.v2.nameSub')} />
      {error ? <AuthBanner text={error} /> : null}
      <PressableScale accessibilityRole="button" accessibilityLabel={t('account.photo.title')} onPress={photoMenu} className="mt-[26px] items-center gap-2">
        <View>
          {profile?.avatar_url ? (
            <Avatar path={profile.avatar_url} name={profile.full_name} size={96} />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-panel">
              {initial ? <Text className="text-onpanel" style={{ fontSize: 37, lineHeight: 46 }}>{initial}</Text> : <User size={40} color="#D3F53D" />}
            </View>
          )}
          <View className="absolute -bottom-0.5 -start-0.5 h-[34px] w-[34px] items-center justify-center rounded-full bg-lime">
            <Camera size={17} color="#171B19" />
          </View>
        </View>
        <Text variant="caption" className="text-muted">{t('auth.v2.addPhoto')}</Text>
      </PressableScale>
      <Controller
        control={control}
        name="fullName"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthField className="mt-[22px]" ltr={false} label={t('auth.v2.name')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.fullName?.message} autoComplete="name" />
        )}
      />
    </AuthScreen>
  );
}
