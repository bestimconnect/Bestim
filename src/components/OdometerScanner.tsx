import { onlineManager } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Flashlight, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Linking, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
  type CameraDevice,
  type CameraPhotoOutput,
  type Frame,
} from 'react-native-vision-camera';
import { useTextRecognition } from 'react-native-vision-camera-ocr-plus';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { pickOutlier, pickReading, settle, type Held } from '@/lib/odometerScan';
import { useIsGuest } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

const WINDOW_H = 120; // the camera window: a wide strip, the shape of an odometer display
const SLOW_AFTER = 8000; // decisions Q72
const AI_AFTER = 2000; // no number from the phone by then: the AI gets one look
const ZOOM = 1.6; // the digits fill the window without holding the phone too close to focus
const STILL_W = 960; // px: the still the AI sees, far under 300 KB as a JPEG
const GLASS = 'rgba(245, 247, 245, 0.12)'; // round buttons on the dark panel
// The video is read as it streams (decisions Q75), and only the middle band of the picture, which is what the
// window shows (the preview fills its width), with slack for the video's shape. The reader itself paces the work:
// one frame in six is read (about five a second), the rest pass untouched. Module-level so the reader is built once.
const READER = { language: 'latin', frameSkipThreshold: 6, scanRegion: { left: '0%', top: '33%', width: '100%', height: '34%' } } as const;

type Props = {
  current?: number; // the reading on file: a number at or just above it is preferred. Leave out when there is none yet (a vehicle being added)
  jump?: number; // see maxJump() in lib/odometerScan; only with `current`
  unit: string; // "km", shown next to the number
  confirmLabel?: string; // where confirming does not save
  onConfirm: (reading: number) => void;
  onType: () => void; // the way out: type it instead
  onClose: () => void;
};

/** What the camera sees now, as a small JPEG in base64: the middle band of the picture, where the window is. */
async function still(output: CameraPhotoOutput) {
  const photo = await output.capturePhoto({ flashMode: 'off', enableShutterSound: false }, {});
  const full = await photo.toImageAsync();
  // Shrink before cropping: on iPhone shrinking is what turns the picture upright, cropping alone does not.
  const small = await full.resizeAsync(STILL_W, Math.round((STILL_W * full.height) / full.width));
  const band = await small.cropAsync(0, Math.round(small.height * 0.3), small.width, Math.round(small.height * 0.7));
  const file = new File(`file://${await band.saveToTemporaryFileAsync('jpg', 70)}`);
  for (const o of [photo, full, small, band]) o.dispose();
  try {
    return await file.base64();
  } finally {
    file.delete(); // the picture is never kept
  }
}

/** The dark panel every state of the scanner sits on. */
function Shell({ onClose, corner, footer, children }: { onClose: () => void; corner?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const { top, bottom } = useSafeAreaInsets();

  // Android's back button closes the camera, not the whole page behind it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true));
    return () => sub.remove();
  }, [onClose]);

  return (
    <View className="absolute inset-0 bg-panel px-6" style={{ paddingTop: top + 12, paddingBottom: bottom + 16 }}>
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel={t('odometer.scan.close')} hitSlop={12} onPress={onClose} className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: GLASS }}>
          <X size={20} color="#F5F7F5" />
        </Pressable>
        {corner}
      </View>
      <View className="flex-1 justify-center gap-5">{children}</View>
      {footer}
    </View>
  );
}

/** The camera itself: only rendered once there is a camera and the permission to use it. */
function Live({ device, current, jump = 0, unit, confirmLabel, onConfirm, onType, onClose }: Props & { device: CameraDevice }) {
  const { t } = useTranslation();
  const guest = useIsGuest();
  const [torch, setTorch] = useState(false);
  const [started, setStarted] = useState(false);
  const [slow, setSlow] = useState(false);
  const [asking, setAsking] = useState(false); // the AI is looking at a still
  const [found, setFound] = useState<number | null>(null);
  const held = useRef<Held>(null);
  const since = useRef(0); // when "Look again" was last pressed
  const look = useRef(0); // counts looks, so an AI answer for an earlier look is dropped
  const paused = useRef(false);
  const last = useRef(''); // the text last looked at
  const [seen, setSeen] = useState(''); // test builds only: what the reader saw, under the window

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_AFTER);
    return () => {
      clearTimeout(id);
      paused.current = true; // an AI answer still on its way is dropped
    };
  }, []);

  // A number that fits the saved reading first; otherwise the one that looks like an odometer display (Q73).
  const pick = useCallback(
    (lines: string[]) => (current == null ? pickOutlier(lines) : pickReading(lines, current, jump) ?? pickOutlier(lines)),
    [current, jump],
  );

  const show = useCallback(
    (reading: number) => {
      paused.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFound(reading);
    },
    [],
  );

  // Stable on purpose: the frame reader is rebuilt whenever this function changes.
  const onLines = useCallback(
    (lines: string[]) => {
      if (paused.current) return;
      // The same text with no number waiting needs no second look; a waiting number is checked on every report.
      const key = lines.join('\n');
      if (key === last.current && held.current == null) return;
      last.current = key;
      if (__DEV__) setSeen(key.replace(/\n/g, ' | ').slice(0, 80));
      const reading = pick(lines);
      const step = settle(held.current, reading, Date.now(), since.current);
      held.current = step.held;
      if (step.accept && reading != null) show(reading);
    },
    [pick, show],
  );

  const { recognizer } = useTextRecognition(READER);
  // Runs on the camera's thread for every frame, the same way the reader's own camera does it: the call never
  // waits (it hands back the last finished read), and only the lines of text cross to the screen's thread.
  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      const lines: string[] = [];
      const buffer = frame.getNativeBuffer();
      try {
        const text = recognizer.scanFrame(buffer.pointer, frame.orientation);
        for (const block of text?.blocks ?? []) for (const line of block.lines) lines.push(line.lineText);
      } finally {
        buffer.release();
      }
      if (lines.length) scheduleOnRN(onLines, lines);
      frame.dispose();
    },
    [recognizer, onLines],
  );
  // The reader needs RGB frames on Android and reads the camera's own format on iPhone.
  const frames = useFrameOutput({ pixelFormat: Platform.OS === 'android' ? 'rgb' : 'yuv', onFrame });
  const photo = usePhotoOutput({ targetResolution: CommonResolutions.FHD_16_9, containerFormat: 'jpeg', qualityPrioritization: 'speed' });
  // Guests never ask the AI, so their camera does without the photo stream.
  const outputs = useMemo(() => (guest ? [frames] : [frames, photo]), [guest, frames, photo]);
  const onStarted = useCallback(() => setStarted(true), []);

  // The backup for displays the phone cannot read (digital segment digits): with no number after AI_AFTER, a still
  // goes to the AI, once per look. Its answer is doubted like the phone's own read, and the owner still confirms it.
  useEffect(() => {
    if (!started || found != null || guest) return;
    const mine = look.current;
    const id = setTimeout(async () => {
      if (!onlineManager.isOnline()) return;
      setAsking(true);
      try {
        const { data } = await supabase.functions.invoke('read-odometer', { body: { image_base64: await still(photo) } });
        const n: unknown = data?.reading;
        if (__DEV__) setSeen(`AI: ${JSON.stringify(data ?? null)}`.slice(0, 80));
        const reading = typeof n === 'number' && Number.isInteger(n) ? (current == null ? n : pick([String(n)])) : null;
        if (reading != null && mine === look.current && !paused.current) show(reading);
      } catch (e) {
        // Silent for the owner: the phone keeps reading, and "Type it instead" is still offered.
        if (__DEV__) setSeen(`AI: ${e instanceof Error ? e.message : String(e)}`.slice(0, 80));
      } finally {
        if (mine === look.current) setAsking(false);
      }
    }, AI_AFTER);
    return () => clearTimeout(id);
  }, [started, found, guest, photo, current, pick, show]);

  const again = () => {
    look.current += 1;
    held.current = null;
    since.current = Date.now();
    paused.current = false;
    last.current = '';
    setAsking(false);
    setFound(null);
  };

  const n = (v: number) => v.toLocaleString('en-US');

  return (
    <Shell
      onClose={onClose}
      corner={
        device.hasTorch ? (
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
        ) : null
      }
      footer={
        found != null ? (
          <View className="gap-2">
            <Button title={confirmLabel ?? t('odometer.scan.confirm')} onPress={() => onConfirm(found)} />
            <Button variant="secondary" title={t('odometer.scan.again')} onPress={again} />
          </View>
        ) : slow ? (
          <Button variant="secondary" title={t('odometer.scan.slowAction')} onPress={onType} />
        ) : null
      }>
      {found != null ? (
        <View className="items-center gap-1">
          <Text variant="number" className="text-onpanel" style={{ fontFamily: 'Poppins_700Bold', fontSize: 56, lineHeight: 64 }}>{n(found)}</Text>
          <Text variant="caption" className="text-onpanel" style={{ opacity: 0.7 }}>{unit}</Text>
        </View>
      ) : (
        <Text variant="heading" className="text-center text-onpanel">{t('odometer.scan.hint')}</Text>
      )}
      <View className="overflow-hidden rounded-[20px] border-2 border-lime" style={{ height: WINDOW_H }}>
        <Camera
          style={{ flex: 1 }}
          device={device}
          isActive
          resizeMode="cover"
          torchMode={torch ? 'on' : 'off'}
          zoom={Math.min(device.maxZoom, Math.max(device.minZoom, ZOOM))}
          outputs={outputs}
          onStarted={onStarted}
        />
      </View>
      {found != null && current != null && (found < current || found > current + jump) ? (
        <Text variant="caption" className="text-center text-onpanel">
          {t(found < current ? 'odometer.scan.lowerNote' : 'odometer.scan.higherNote', { current: n(current) })}
        </Text>
      ) : found == null && asking ? (
        <Text variant="caption" className="text-center text-onpanel">{t('odometer.scan.asking')}</Text>
      ) : found == null && slow ? (
        <Text variant="caption" className="text-center text-onpanel">{t('odometer.scan.slow')}</Text>
      ) : null}
      {__DEV__ ? (
        <Text variant="caption" className="text-center text-onpanel" style={{ opacity: 0.5 }}>
          {`${guest ? 'guest' : 'account'} · ${started ? 'camera on' : 'camera starting'} · ${seen || 'no text yet'}`}
        </Text>
      ) : null}
    </Shell>
  );
}

/**
 * Reads the odometer live, on the phone, on iPhone and Android alike (decisions Q71–Q75): no shutter.
 * A number counts when two reads agree (see settle() in lib/odometerScan); a display the phone cannot read goes
 * to the AI as a still. Either way the number is shown large, and the user confirms it or looks again.
 * Covers the screen it is rendered in (not a Modal, so the theme colours still apply).
 */
export function OdometerScanner(props: Props) {
  const { t } = useTranslation();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back'); // undefined where there is no camera (simulator)

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, canRequestPermission]);

  if (hasPermission && device) return <Live {...props} device={device} />;

  const denied = !hasPermission && !canRequestPermission;
  return (
    <Shell
      onClose={props.onClose}
      footer={
        denied ? (
          <Button title={t('odometer.scan.deniedAction')} onPress={() => Linking.openSettings()} />
        ) : hasPermission ? (
          <Button variant="secondary" title={t('odometer.scan.slowAction')} onPress={props.onType} />
        ) : null
      }>
      {denied || hasPermission ? (
        <Text className="text-center text-onpanel">{t(denied ? 'odometer.scan.denied' : 'odometer.scan.unavailable')}</Text>
      ) : null}
    </Shell>
  );
}
