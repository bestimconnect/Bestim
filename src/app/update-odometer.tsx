import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { I18nManager, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Text } from '@/components/ui';
import { useCurrentVehicle } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

// Screen 25 — Update odometer (decisions Q19.2); ar-light 25/تحديث العداد.png
export default function UpdateOdometerScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { vehicle } = useCurrentVehicle();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!vehicle) return null;

  const unit = vehicle.odometer_unit;
  const unitLabel = t(`odometer.unit.${unit}`);
  const reading = /^\d+$/.test(value) ? Number(value) : null;
  const lower = reading != null && reading < vehicle.current_odometer;
  const days = differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at));
  const shortUnit = t(`home.${unit}`);

  const save = async () => {
    if (reading == null) return setError(t('odometer.invalid'));
    if (lower && reason.trim().length < 3) return setError(t('odometer.reasonHint'));
    setSaving(true);
    setError('');
    const { error: e1 } = await supabase.from('vehicles').update({ current_odometer: reading }).eq('id', vehicle.id);
    const { error: e2 } = lower
      ? await supabase.from('maintenance_logs').insert({
          vehicle_id: vehicle.id,
          title: t('odometer.logTitle'),
          description: reason.trim(),
          odometer_reading: reading,
          service_date: format(new Date(), 'yyyy-MM-dd'),
          source: 'manual',
          status: 'needs_review',
        })
      : { error: null };
    setSaving(false);
    if (e1 || e2) return setError(t('odometer.error'));
    qc.invalidateQueries({ queryKey: ['vehicles'] });
    qc.invalidateQueries({ queryKey: ['logs'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 gap-5 p-6">
        <Header title={t('odometer.header')} />
        <Text variant="title">{t('odometer.heading')}</Text>
        <View className="gap-1 rounded-item bg-lime p-4">
          <Text variant="caption" className="text-[#222E29]" style={{ opacity: 0.7 }}>{t('odometer.label')}</Text>
          <TextInput
            value={value}
            onChangeText={(v) => setValue(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder={vehicle.current_odometer.toLocaleString('en-US')}
            placeholderTextColor="#222E2966"
            className="p-0 text-number text-[#222E29]"
            style={{ fontFamily: 'Poppins_700Bold', textAlign: I18nManager.isRTL ? 'right' : 'left' }}
          />
          <Text variant="caption" className="text-[#222E29]" style={{ opacity: 0.7 }}>{unitLabel}</Text>
        </View>
        <Text variant="caption" className="text-muted">
          {days > 0
            ? t('odometer.last', { value: vehicle.current_odometer.toLocaleString('en-US'), unit: shortUnit, count: days })
            : t('odometer.lastToday', { value: vehicle.current_odometer.toLocaleString('en-US'), unit: shortUnit })}
        </Text>
        {lower ? (
          <Field label={t('odometer.reason')} value={reason} onChangeText={setReason} placeholder={t('odometer.noteBody')} multiline />
        ) : (
          <View className="gap-1 rounded-field bg-sky p-4">
            <Text variant="label">{t('odometer.noteTitle')}</Text>
            <Text variant="caption" className="text-muted">{t('odometer.noteBody')}</Text>
          </View>
        )}
        {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
        <View className="flex-1" />
        <Button title={t('odometer.cta')} onPress={save} loading={saving} disabled={reading == null} />
      </View>
    </SafeAreaView>
  );
}
