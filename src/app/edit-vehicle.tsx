import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { cleanVin, vinOk } from '@/lib/vin';
import { ColorPicker } from '@/components/ColorPicker';
import { cleanDigits, joinPlate, PlateField, splitPlate } from '@/components/Plate';
import { Button, Field, Header, Note, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { useVehicle, vehicleName, type Vehicle } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

// Edit car: the plate and the nickname (make/model/year stay as added).
function Form({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const start = splitPlate(vehicle.plate_number);
  const [letters, setLetters] = useState(start.letters);
  const [digits, setDigits] = useState(cleanDigits(start.digits));
  const [vin, setVin] = useState(vehicle.vin ?? '');
  const [color, setColor] = useState<string | null>(vehicle.color);
  const [nickname, setNickname] = useState(vehicle.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    const { error: e } = await supabase.from('vehicles').update({ plate_number: joinPlate(letters, digits), color, vin: vin || null, nickname: nickname.trim() || null }).eq('id', vehicle.id);
    setSaving(false);
    if (e) return setError(errorText(e));
    qc.invalidateQueries({ queryKey: ['vehicles'] });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Header title={t('plate.edit')} sub={vehicleName(vehicle)} />
        <Text variant="caption" className="text-muted">{t('plate.label')}</Text>
        <PlateField letters={letters} digits={digits} onChange={(l, d) => (setLetters(l), setDigits(d))} />
        <ColorPicker value={color} onChange={setColor} />
        <Field label={t('vehicles.vin.label')} value={vin} onChangeText={(v) => setVin(cleanVin(v))} autoCapitalize="characters" autoCorrect={false} placeholder={t('vehicles.vin.hint')} error={vinOk(vin) ? undefined : t('vehicles.vin.error')} />
        <Field label={t('onboarding.addVehicle.info.nickname')} value={nickname} onChangeText={setNickname} />
        {error ? <Note tone="warning" text={error} /> : null}
      </ScrollView>
      <View className="px-6 pb-4 pt-2">
        <Button title={t('plate.save')} onPress={save} loading={saving} disabled={!vinOk(vin)} />
      </View>
    </SafeAreaView>
  );
}

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).vehicle;
  return vehicle ? <Form vehicle={vehicle} /> : <SafeAreaView className="flex-1 bg-paper px-6"><Header title="" /></SafeAreaView>;
}
