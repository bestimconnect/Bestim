import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DeleteConfirm } from '@/components/DeleteConfirm';
import { toast } from '@/components/Toast';
import { signOut } from '@/lib/auth';
import { useIsGuest } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Delete account (Q34): the screen 46 layout. The root gate lands on Welcome after signOut().
export default function DeleteAccount() {
  const { t } = useTranslation();
  const guest = useIsGuest();
  const userId = useSession()?.user.id;
  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'account' } }} />;

  const remove = async () => {
    // Receipt files are best effort; the account itself must go.
    const { data: files } = await supabase.storage.from('receipts').list(userId);
    if (files?.length) await supabase.storage.from('receipts').remove(files.map((f) => `${userId}/${f.name}`));
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await signOut();
    toast(t('toast.accountDeleted'));
  };

  return (
    <DeleteConfirm
      header={t('feedback.deleteAccount.header')}
      title={t('feedback.deleteAccount.title')}
      body={t('feedback.deleteAccount.body')}
      keep={t('feedback.deleteAccount.keep')}
      error={t('feedback.deleteAccount.error')}
      onDelete={remove}
    />
  );
}
