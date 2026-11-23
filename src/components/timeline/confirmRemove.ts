import type { QueryClient } from '@tanstack/react-query';

import i18n from '@/lib/i18n';
import { removeRecord } from '@/lib/removeRecord';
import { sheet } from '@/lib/sheet';

/** Design-v2 flow 8 #6: ask "Delete this record?" first; the delete itself then has the Undo toast. */
export function confirmRemove(qc: QueryClient, table: 'maintenance_logs' | 'expenses', id: string, name?: string, after?: () => void) {
  const t = i18n.t.bind(i18n);
  sheet(t('capture.quick.confirmTitle'), [name, t('capture.quick.confirmBody')].filter(Boolean).join(' · '), [
    { text: t('capture.quick.confirmYes'), style: 'destructive', onPress: () => { after?.(); removeRecord(qc, table, id); } },
    { text: t('capture.quick.confirmNo'), style: 'cancel' },
  ]);
}
