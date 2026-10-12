import { addDays, format } from 'date-fns';
import { router } from 'expo-router';

import { toast } from '@/components/Toast';
import i18n from './i18n';
import { queryClient } from './queryClient';
import { supabase } from './supabase';

/** Snooze a part's reminder for a week (Q24), tell the owner, and go back. Returns false (after a toast) on failure. */
export async function snoozePart(vehicleId: string, serviceTypeId: string, title: string) {
  const until = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  const { error: e1 } = await supabase.from('reminders').delete().eq('vehicle_id', vehicleId).eq('service_type_id', serviceTypeId).eq('status', 'dismissed');
  const { error } = e1
    ? { error: e1 }
    : await supabase.from('reminders').insert({ vehicle_id: vehicleId, service_type_id: serviceTypeId, title, status: 'dismissed', due_date: until });
  if (error) {
    toast(i18n.t('reminders.snoozeFailed'));
    return false;
  }
  queryClient.invalidateQueries({ queryKey: ['snoozes'] });
  toast(i18n.t('reminders.snoozed'));
  router.back();
  return true;
}
