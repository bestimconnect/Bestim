import { useTranslation } from 'react-i18next';

import { DeleteConfirm } from '@/components/DeleteConfirm';
import { toast } from '@/components/Toast';
import { signOut } from '@/lib/auth';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Delete account (Q34): the screen 46 layout. The root gate lands on Welcome after signOut().
export default function DeleteAccount() {
  const { t } = useTranslation();
  const userId = useSession()?.user.id;

  const remove = async () => {
    if (!userId) throw new Error('no user');
    // Receipt photos go first, a page at a time, until the folder is empty: nothing of the user may stay behind.
    for (;;) {
      const { data: files, error } = await supabase.storage.from('receipts').list(userId);
      if (error) throw error;
      if (!files?.length) break;
      const { data: removed, error: removeError } = await supabase.storage.from('receipts').remove(files.map((f) => `${userId}/${f.name}`));
      if (removeError || !removed?.length) throw removeError ?? new Error('receipts not removed');
    }
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
