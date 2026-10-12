import type { QueryClient } from '@tanstack/react-query';

import { toast } from '@/components/Toast';
import { errorText } from './errors';
import i18n from './i18n';
import { supabase } from './supabase';

/** After a write: everything that shows records, readings, parts or costs reloads. */
export const refreshRecords = (qc: QueryClient) => {
  for (const key of ['vehicles', 'logs', 'expenses', 'log', 'log-corrections']) qc.invalidateQueries({ queryKey: [key] });
};

/**
 * Delete with Undo: the row leaves the cached lists at once, "Deleted · Undo" shows for 5 seconds, and the real delete is sent when it ends.
 * Undo cancels it. A failed delete puts the row back and says why.
 * A log's automatic expense leaves with it (the database deletes it too).
 * ponytail: the delete lives in this timer, so closing the app inside the 5 seconds keeps the record (safe side). A refetch inside them can bring the row back early.
 */
export function removeRecord(qc: QueryClient, table: 'maintenance_logs' | 'expenses', id: string) {
  const before = ['logs', 'expenses'].flatMap((key) => qc.getQueriesData({ queryKey: [key] }));
  for (const [key] of before)
    qc.setQueryData(key, (old: unknown) => (Array.isArray(old) ? old.filter((x) => x.id !== id && !(x.log_id === id && x.from_log)) : old));
  const restore = () => before.forEach(([key, data]) => qc.setQueryData(key, data));
  const timer = setTimeout(async () => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      restore();
      toast(errorText(error));
    }
    refreshRecords(qc);
  }, 5000);
  toast(i18n.t('capture.quick.deleted'), {
    label: i18n.t('capture.quick.undo'),
    onPress: () => {
      clearTimeout(timer);
      restore();
    },
  });
}
