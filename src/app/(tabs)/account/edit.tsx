import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { toast } from '@/components/Toast';
import { Backdrop, Button, Field, FooterBar, Header, PressableScale, Text } from '@/components/ui';
import { useAvatarActions } from '@/lib/avatar';
import { useProfile } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { sheet } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

// Edit account info (opened from the Edit button on the driver card, decisions Q130): the name and the photo. Email changes go through sign-in, so it is shown, not edited.
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const c = useColors();
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
    job().catch(() => setError(t('account.photo.failed')));
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
      <Backdrop />
      <Header title={t('account.edit.title')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pb-6 pt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="items-center gap-3">
          <PressableScale accessibilityRole="button" accessibilityLabel={t('account.photo.title')} onPress={photoMenu}>
            <Avatar path={profile?.avatar_url} name={profile?.full_name} size={96} />
            <View className="absolute -bottom-1 -end-1 h-8 w-8 items-center justify-center rounded-full border border-line bg-white">
              <Camera size={16} color={c.teal} />
            </View>
          </PressableScale>
          <Button title={t('account.photo.edit')} variant="ghost" size="sm" onPress={photoMenu} />
        </View>
        <View className="gap-4">
          <Field label={t('account.edit.name')} value={draft ?? profile?.full_name ?? ''} onChangeText={setDraft} maxLength={60} autoCapitalize="words" textContentType="name" />
          <Field label={t('account.card.email')} value={session?.user.email ?? ''} editable={false} style={{ opacity: 0.6 }} />
        </View>
        {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
      </ScrollView>
      <FooterBar>
        <Button title={t('account.edit.save')} onPress={save} loading={saving} disabled={!dirty || !name} />
      </FooterBar>
    </SafeAreaView>
  );
}
