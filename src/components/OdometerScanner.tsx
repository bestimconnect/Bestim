import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Flashlight, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { BackHandler, Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraDevice, useCameraPermission, type CameraViewProps } from 'react-native-vision-camera';
import { Camera, type CameraTypes, type Text as SeenText } from 'react-native-vision-camera-ocr-plus';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { pickOutlier, pickReading } from '@/lib/odometerScan';

const WINDOW_H = 120; // the camera window: a wide strip, the shape of an odometer display
const SLOW_AFTER = 8000; // decisions Q72
const GLASS = 'rgba(245, 247, 245, 0.12)'; // round buttons on the dark panel
// The video is read as it streams (decisions Q75): every 4th frame, and only the middle band of the picture,
// which is what the window shows (the preview fills its width), with slack for the video's shape.
// Module-level so the frame reader is built once.
const READER = { language: 'latin', frameSkipThreshold: 4, scanRegion: { left: '0%', top: '33%', width: '100%', height: '34%' } } as const;
// The wrapper hands every extra prop to VisionCamera's own view, but its types only list the session options.
const LiveCamera = Camera as ComponentType<CameraTypes & Pick<CameraViewProps, 'style' | 'resizeMode'>>;

type Props = {
  current: number; // the reading on file: a number at or just above it is preferred
  jump: number; // see maxJump() in lib/odometerScan
  unit: string; // "km", shown next to the number
  onConfirm: (reading: number) => void;
  onType: () => void; // the way out: type it instead
  onClose: () => void;
};

/**
 * Reads the odometer live, on the phone, on iPhone and Android alike (decisions Q71–Q75): no shutter.
 * A number counts when two frames in a row agree; it is then shown large, and the user confirms it (which saves)
 * or looks again. Covers the screen it is rendered in (not a Modal, so the theme colours still apply).
 */
export function OdometerScanner({ current, jump, unit, onConfirm, onType, onClose }: Props) {
  const { t } = useTranslation();
  const { top, bottom } = useSafeAreaInsets();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back'); // undefined where there is no camera (simulator)
  const [torch, setTorch] = useState(false);
  const [slow, setSlow] = useState(false);
  const [found, setFound] = useState<number | null>(null);
  const [seen, setSeen] = useState(''); // dev builds only: what the phone read last
  const before = useRef<number | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, canRequestPermission]);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_AFTER);
    return () => clearTimeout(id);
  }, []);

  // Android's back button closes the camera, not the whole page behind it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true));
    return () => sub.remove();
  }, [onClose]);

  // Stable on purpose: the frame reader is rebuilt whenever this function changes.
  const onText = useCallback(
    (data: string | SeenText) => {
      if (paused.current || typeof data === 'string') return;
      const lines = data.blocks.flatMap((b) => b.lines.map((l) => l.lineText));
      if (__DEV__) setSeen(lines.join(' | ').slice(0, 120));
      // A number that fits the saved reading first; otherwise the one that looks like an odometer display (Q73).
      const reading = pickReading(lines, current, jump) ?? pickOutlier(lines);
      if (reading != null && reading === before.current) {
        paused.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFound(reading);
      }
      before.current = reading;
    },
    [current, jump],
  );

  const again = () => {
    before.current = null;
    paused.current = false;
    setFound(null);
  };

  const denied = !hasPermission && !canRequestPermission;
  const broken = hasPermission && !device;
  const n = (v: number) => v.toLocaleString('en-US');

  return (
    <View className="absolute inset-0 bg-panel px-6" style={{ paddingTop: top + 12, paddingBottom: bottom + 16 }}>
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel={t('odometer.scan.close')} hitSlop={12} onPress={onClose} className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: GLASS }}>
          <X size={20} color="#F5F7F5" />
        </Pressable>
        {hasPermission && device?.hasTorch ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('odometer.scan.torch')}
            accessibilityState={{ selected: torch }}
            hitSlop={12}
            onPress={() => setTorch(!torch)}
            className={`h-11 w-11 items-center justify-center rounded-full ${torch ? 'bg-lime' : ''}`}
            style={torch ? undefined : { backgroundColor: GLASS }}>
            <Flashlight size={20} color={torch ? '#222E29' : '#F5F7F5'} />
          </Pressable>
        ) : null}
      </View>

      <View className="flex-1 justify-center gap-5">
        {denied || broken ? (
          <Text className="text-center text-onpanel">{t(denied ? 'odometer.scan.denied' : 'odometer.scan.unavailable')}</Text>
        ) : (
          <>
            {found != null ? (
              <View className="items-center gap-1">
                <Text variant="number" className="text-onpanel" style={{ fontFamily: 'Poppins_700Bold', fontSize: 56, lineHeight: 64 }}>{n(found)}</Text>
                <Text variant="caption" className="text-onpanel" style={{ opacity: 0.7 }}>{unit}</Text>
              </View>
            ) : (
              <Text variant="heading" className="text-center text-onpanel">{t('odometer.scan.hint')}</Text>
            )}
            <View className="overflow-hidden rounded-[20px] border-2 border-lime" style={{ height: WINDOW_H }}>
              {hasPermission && device ? (
                <LiveCamera
                  style={{ flex: 1 }}
                  device={device}
                  isActive
                  resizeMode="cover"
                  torchMode={torch ? 'on' : 'off'}
                  mode="recognize"
                  options={READER}
                  callback={onText}
                />
              ) : null}
            </View>
            {found != null && (found < current || found > current + jump) ? (
              <Text variant="caption" className="text-center text-onpanel">
                {t(found < current ? 'odometer.scan.lowerNote' : 'odometer.scan.higherNote', { current: n(current) })}
              </Text>
            ) : found == null && slow ? (
              <Text variant="caption" className="text-center text-onpanel">{t('odometer.scan.slow')}</Text>
            ) : null}
            {__DEV__ && seen ? <Text variant="caption" className="text-center text-muted">{seen}</Text> : null}
          </>
        )}
      </View>

      {denied ? (
        <Button title={t('odometer.scan.deniedAction')} onPress={() => Linking.openSettings()} />
      ) : found != null ? (
        <View className="gap-2">
          <Button title={t('odometer.scan.confirm')} onPress={() => onConfirm(found)} />
          <Button variant="secondary" title={t('odometer.scan.again')} onPress={again} />
        </View>
      ) : slow || broken ? (
        <Button variant="secondary" title={t('odometer.scan.slowAction')} onPress={onType} />
      ) : null}
    </View>
  );
}
