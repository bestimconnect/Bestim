import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { toast } from '@/components/Toast';

import { DeleteConfirm } from '@/components/DeleteConfirm';
import { queryClient } from '@/lib/queryClient';
import { syncNotifications } from '@/lib/notifications';
import { useIsGuest, useVehicles, vehicleName } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/stores/settingsStore';

// Screen 46 — Confirm delete vehicle, PNG 46/تأكيد حذف السيارة (Q36).
export default function DeleteVehicle() {
  const { t } = useTranslation();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const guest = useIsGuest();
  const vehicles = useVehicles().data ?? [];
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'account' } }} />;

  const remove = async () => {
    // Receipt files first (best effort), then the row; logs, expenses, reminders and shares cascade.
    const { data: logs } = await supabase.from('maintenance_logs').select('photos').eq('vehicle_id', vehicleId);
    const paths = (logs ?? []).flatMap((l) => l.photos ?? []);
    if (paths.length) await supabase.storage.from('receipts').remove(paths);
    const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
    if (error) throw error;
    const next = vehicles.filter((v) => v.id !== vehicleId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    useSettings.getState().setCurrentVehicle(next?.id ?? null);
    for (const key of ['vehicles', 'logs', 'expenses', 'snoozes']) queryClient.invalidateQueries({ queryKey: [key] });
    syncNotifications();
    toast(t('toast.vehicleDeleted'));
    router.replace('/');
  };

  return (
    <DeleteConfirm
      header={t('feedback.deleteVehicle.header')}
      title={t('feedback.deleteVehicle.title')}
      name={vehicle ? vehicleName(vehicle) : undefined}
      body={t('feedback.deleteVehicle.body')}
      keep={t('feedback.deleteVehicle.keep')}
      error={t('feedback.deleteVehicle.error')}
      onDelete={remove}
    />
  );
}
