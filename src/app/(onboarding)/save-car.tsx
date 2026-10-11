import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, GoogleIcon, Note, PressableScale, Rise, Text } from '@/components/ui';
import { signInWithGoogle, useGoogleAvailable } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { POP } from '@/lib/motion';
import { useVehicle, vehicleName } from '@/lib/queries';
import { shadows } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';

// Shown to a guest right after the car is saved (Q87): keep it safe in an account, or carry on as a guest.
export default function SaveCarScreen() {
  const { t } = useTranslation();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { vehicle } = useVehicle(vehicleId);
  const google = useGoogleAvailable();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => router.replace({ pathname: '/first-log', params: { vehicleId } });
  const withGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (await signInWithGoogle()) return next(); // links to this guest, so the car stays
    } catch (e) {
      setError(errorText(e, 'errors.google'));
    }
    setBusy(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center gap-6 p-6">
        <Animated.View entering={POP} className="h-[220px] items-center justify-center rounded-screen bg-white" style={{ boxShadow: shadows.elevated }}>
          <Image source={vehicleArt(vehicle?.vehicle_type ?? 'sedan')} contentFit="contain" style={{ width: '80%', height: 150 }} />
        </Animated.View>
        <View className="gap-3">
          <Rise index={1}>
            <Text variant="title">{t('onboarding.saveCar.title', { name: vehicle ? vehicleName(vehicle) : t('onboarding.saveCar.yourCar') })}</Text>
          </Rise>
          <Rise index={2}>
            <Text className="text-muted">{t('onboarding.saveCar.body')}</Text>
          </Rise>
        </View>
      </View>
      <View className="gap-3 px-6 pb-2">
        {error ? <Note tone="warning" text={error} /> : null}
        {google ? <Button title={t('onboarding.saveCar.google')} icon={<GoogleIcon />} onPress={withGoogle} loading={busy} /> : null}
        <Button
          title={t('onboarding.saveCar.email')}
          variant={google ? 'secondary' : 'primary'}
          onPress={() => router.push('/register')}
          disabled={busy}
        />
        <PressableScale accessibilityRole="button" disabled={busy} onPress={next} className="items-center py-2">
          <Text variant="label" className="text-muted">{t('onboarding.saveCar.later')}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}
