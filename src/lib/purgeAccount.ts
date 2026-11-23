import { revokeApple, signOut } from './auth';
import { supabase } from './supabase';

/** Permanent delete: Apple token, receipt and profile photos (page by page until empty), then the account. Ends signed out. */
export async function purgeAccount(userId: string) {
  await revokeApple(); // before anything is deleted: if the user cancels Apple's prompt, nothing is lost
  for (const bucket of ['receipts', 'avatars']) {
    for (;;) {
      const { data: files, error } = await supabase.storage.from(bucket).list(userId);
      if (error) throw error;
      if (!files?.length) break;
      const { data: removed, error: removeError } = await supabase.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      if (removeError || !removed?.length) throw removeError ?? new Error(`${bucket} not removed`);
    }
  }
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await signOut();
}
