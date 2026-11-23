import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { toast } from '@/components/Toast';

import { DeleteConfirm } from '@/components/DeleteConfirm';
import { queryClient } from '@/lib/queryClient';
import { syncNotifications } from '@/lib/notifications';
import { useVehicles } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/stores/settingsStore';

// Screen 46 — Confirm delete vehicle, PNG 46/تأكيد حذف السيارة (Q36).
export default function DeleteVehicle() {
  const { t } = useTranslation();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const vehicles = useVehicles().data ?? [];
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const remove = async () => {
    // Soft delete: the car is kept 30 days and can be restored from Recently deleted (receipt files stay until the purge).
    const { error } = await supabase.rpc('soft_delete_vehicle', { p_vehicle_id: vehicleId });
    if (error) throw error;
    const next = vehicles.filter((v) => v.id !== vehicleId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    useSettings.getState().setCurrentVehicle(next?.id ?? null);
    for (const key of ['vehicles', 'logs', 'expenses', 'snoozes', 'deleted-items']) queryClient.invalidateQueries({ queryKey: [key] });
    syncNotifications();
    toast(t('toast.vehicleDeleted'));
    router.replace('/');
  };

  return (
    <DeleteConfirm
      header={t('feedback.deleteVehicle.header')}
      title={vehicle ? t('feedback.deleteVehicle.titleNamed', { name: vehicle.model }) : t('feedback.deleteVehicle.title')}
      confirmLabel={t('feedback.deleteVehicle.confirmLabel')}
      word={vehicle?.model ?? ''}
      body={t('feedback.deleteVehicle.body')}
      keep={t('feedback.deleteVehicle.keep')}
      error={t('feedback.deleteVehicle.error')}
      onDelete={remove}
    />
  );
}
