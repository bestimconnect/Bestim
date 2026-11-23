import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { toast } from '@/components/Toast';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, FooterBar, PressableScale, Text } from '@/components/ui';
import { DENIED, useAvatarActions } from '@/lib/avatar';
import { useProfile } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { sheet } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';

// Edit account info (opened from the Edit button on the driver card, decisions Q130): the name and the photo. Email changes go through sign-in, so it is shown, not edited.
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const session = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile();
  const photo = useAvatarActions(userId, profile?.avatar_url);
  const [draft, setDraft] = useState<string | null>(null); // null until the user types
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const name = (draft ?? profile?.full_name ?? '').trim();
  const dirty = draft !== null && name !== (profile?.full_name ?? '').trim();

  const run = (job: () => Promise<unknown>) => () => {
    setError('');
    job().catch((e) => setError(t(e?.message === DENIED ? 'account.photo.denied' : 'account.photo.failed')));
  };
  const photoMenu = () =>
    sheet(t('account.photo.title'), undefined, [
      { text: t('account.photo.take'), onPress: run(() => photo.pick('camera')) },
      { text: t('account.photo.choose'), onPress: run(() => photo.pick('library')) },
      ...(profile?.avatar_url ? [{ text: t('account.photo.remove'), style: 'destructive' as const, onPress: run(photo.remove) }] : []),
      { text: t('account.cancel'), style: 'cancel' as const },
    ]);

  const save = async () => {
    if (!userId || !name) return;
    setSaving(true);
    const { error: e } = await supabase.from('profiles').update({ full_name: name }).eq('id', userId);
    setSaving(false);
    if (e) return setError(t('account.edit.failed'));
    qc.invalidateQueries({ queryKey: ['profile'] });
    toast(t('account.edit.saved'));
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <PageHeader title={t('account.edit.header')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 pb-6 pt-2" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="items-center gap-2.5 pt-3">
          <PressableScale accessibilityRole="button" accessibilityLabel={t('account.photo.title')} onPress={photoMenu}>
            {profile?.avatar_url ? (
              <Avatar path={profile.avatar_url} name={profile.full_name} size={96} />
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full bg-panel">
                <Text variant="title" className="text-onpanel">{((draft ?? profile?.full_name ?? '').trim()[0] ?? '·').toUpperCase()}</Text>
              </View>
            )}
            <View className="absolute -bottom-0.5 -end-0.5 h-[34px] w-[34px] items-center justify-center rounded-full bg-lime">
              <Camera size={17} color="#171B19" />
            </View>
          </PressableScale>
          <Text variant="caption" className="text-muted" onPress={photoMenu}>{t('account.photo.edit')}</Text>
        </View>
        <View className="gap-2.5">
          <Field label={t('account.edit.name')} value={draft ?? profile?.full_name ?? ''} onChangeText={setDraft} maxLength={60} autoCapitalize="words" textContentType="name" />
          <View className="gap-1.5">
            <Field label={t('account.card.email')} value={session?.user.email ?? ''} editable={false} style={{ opacity: 0.65, textAlign: 'left', writingDirection: 'ltr' }} />
            <Text variant="caption" className="mx-1.5 text-muted">{t('account.edit.emailNote')}</Text>
          </View>
        </View>
        {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
      </ScrollView>
      <FooterBar>
        <Button title={t('account.edit.save')} onPress={save} loading={saving} disabled={!dirty || !name} />
      </FooterBar>
    </SafeAreaView>
  );
}
