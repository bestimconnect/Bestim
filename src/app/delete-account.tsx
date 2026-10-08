import { useTranslation } from 'react-i18next';

import { DeleteConfirm } from '@/components/DeleteConfirm';
import { toast } from '@/components/Toast';
import { signOut } from '@/lib/auth';
import { useIsGuest } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Delete account (Q34) or a guest's data (Q77): the screen 46 layout. The root gate lands on Welcome after signOut().
export default function DeleteAccount() {
  const { t } = useTranslation();
  const guest = useIsGuest();
  const userId = useSession()?.user.id;
  const copy = guest ? 'deleteGuest' : 'deleteAccount';

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
    toast(t(guest ? 'toast.guestDeleted' : 'toast.accountDeleted'));
  };

  return (
    <DeleteConfirm
      header={t(`feedback.${copy}.header`)}
      title={t(`feedback.${copy}.title`)}
      body={t(`feedback.${copy}.body`)}
      keep={t(`feedback.${copy}.keep`)}
      error={t('feedback.deleteAccount.error')}
      canExport={!guest}
      onDelete={remove}
    />
  );
}
