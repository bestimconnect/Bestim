import { onlineManager } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Flashlight, X, ZoomIn } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Linking, Platform, Pressable, Share, View } from 'react-native';
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
  type CameraRef,
  type Frame,
} from 'react-native-vision-camera';
import { performOcr, type OcrOptions } from '@chuksdengr/vision-camera-ocr';
import { useSharedValue } from 'react-native-reanimated';
import { useTextRecognition } from 'react-native-vision-camera-ocr-plus';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { candidates, NO_VOTES, pickOutlier, pickReading, vote, type Votes } from '@/lib/odometerScan';
import { useIsGuest } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

const WINDOW_H = 120; // the camera window: a wide strip, the shape of an odometer display
const SLOW_AFTER = 8000; // decisions Q72
const AI_AFTER = 2000; // no number from the phone by then: the AI gets one look
const ZOOMS = [1.6, 3] as const; // 1.6: the digits fill the window without holding the phone too close to focus; 3: small LCDs
// Decisions Q97: reading stays on the phone. The AI backup only runs when this is switched on (and the server allows it).
const AI_ON = process.env.EXPO_PUBLIC_ODOMETER_AI === 'on';
const AI_TRIES = 3;
const STILL_W = 960; // px: the still the AI sees, far under 300 KB as a JPEG
const GLASS = 'rgba(245, 247, 245, 0.12)'; // round buttons on the dark panel
// The video is read as it streams (decisions Q75), and only the middle band of the picture, which is what the
// window shows: the preview fills its width and shows about 40–60% of its height (Q97), so 37–63% gives a small margin
// without the speed and RPM numbers around it. The reader paces the work: one frame in six is read (about five a
// second), the rest get the last result back. Module-level so the reader is built once.
const BAND = { top: 0.37, bottom: 0.63 };
const READER = { language: 'latin', frameSkipThreshold: 6, scanRegion: { left: '0%', top: `${BAND.top * 100}%`, width: '100%', height: `${(BAND.bottom - BAND.top) * 100}%` } } as const;
// iPhone (Q97, phase 2): Apple Vision reads digits better than ML Kit. It reads the whole frame, so only lines whose
// middle sits in BAND are kept, and it runs at most every VISION_MS (an accurate read takes a few hundred ms).
const VISION: OcrOptions = { recognitionLevel: 'accurate', usesLanguageCorrection: false, recognitionLanguages: ['en-US'], includeBoxes: true };
const VISION_MS = 300;
const IOS = Platform.OS === 'ios';

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
  const [zoom, setZoom] = useState(0); // index in ZOOMS
  const camera = useRef<CameraRef>(null);
  const votes = useRef<Votes>(NO_VOTES);
  const since = useRef(0); // when "Look again" was last pressed
  const look = useRef(0); // counts looks, so an AI answer for an earlier look is dropped
  const paused = useRef(false);
  const [seen, setSeen] = useState(''); // test builds only: what the reader saw, under the window
  const [frameInfo, setFrameInfo] = useState(''); // test builds only: the frame's size and orientation
  const raw = useRef<string[]>([]); // test builds only: every distinct text read, to send to the developer

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
      const reading = pick(lines);
      if (__DEV__) {
        const key = lines.join(' | ');
        if (raw.current[raw.current.length - 1] !== key) raw.current = [...raw.current, key].slice(-40);
        const nums = candidates(lines).map((c) => `${c.value}${c.joined ? '*' : ''}`).join(',');
        setSeen(`${key.slice(0, 60)} → [${nums}] → ${reading ?? '—'} (${votes.current.values.join(',')})`);
      }
      // Q97: a number counts once it wins 3 of the last 5 real reads (see vote() in lib/odometerScan).
      const step = vote(votes.current, reading, Date.now(), since.current);
      votes.current = step.votes;
      if (step.accept != null) show(step.accept);
    },
    [pick, show],
  );

  const { recognizer } = useTextRecognition(READER);
  // Runs on the camera's thread for every frame, the same way the reader's own camera does it: the call never
  // waits (it hands back the last finished read), and only the lines of text cross to the screen's thread.
  const lastVision = useSharedValue(0);
  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      if (IOS) {
        const now = Date.now();
        if (now - lastVision.get() >= VISION_MS) {
          lastVision.set(now);
          const lines: string[] = [];
          for (const block of performOcr(frame, VISION)?.blocks ?? [])
            for (const line of block.lines ?? []) {
              // Vision's boxes are 0–1 with the origin at the bottom-left of the upright picture.
              const mid = line.box ? 1 - (line.box.y + line.box.height / 2) : 0.5;
              if (mid >= BAND.top && mid <= BAND.bottom) lines.push(line.text);
            }
          if (__DEV__) scheduleOnRN(setFrameInfo, `${frame.width}x${frame.height} ${frame.orientation} · Vision`);
          if (lines.length) scheduleOnRN(onLines, lines);
        }
        frame.dispose();
        return;
      }
      if (__DEV__) scheduleOnRN(setFrameInfo, `${frame.width}x${frame.height} ${frame.orientation}`);
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
    [recognizer, onLines, lastVision],
  );
  // The reader needs RGB frames on Android and reads the camera's own format on iPhone.
  // Full HD frames (Q97): small LCD digits are only a few dozen pixels tall at the default 720p.
  const frames = useFrameOutput({ targetResolution: CommonResolutions.FHD_16_9, pixelFormat: Platform.OS === 'android' ? 'rgb' : 'yuv', onFrame });
  const photo = usePhotoOutput({ targetResolution: CommonResolutions.FHD_16_9, containerFormat: 'jpeg', qualityPrioritization: 'speed' });
  // Guests never ask the AI, so their camera does without the photo stream.
  const outputs = useMemo(() => (guest || !AI_ON ? [frames] : [frames, photo]), [guest, frames, photo]);
  const onStarted = useCallback(() => setStarted(true), []);

  // The AI backup (off unless AI_ON, Q97): with no number after AI_AFTER, a still goes to the AI, retried a few times
  // while nothing is found. Its answer is doubted like the phone's own read, and the owner still confirms it.
  useEffect(() => {
    if (!AI_ON || !started || found != null || guest) return;
    const mine = look.current;
    let tries = 0;
    let stop = false;
    const ask = async () => {
      if (stop || paused.current || mine !== look.current || !onlineManager.isOnline()) return;
      tries += 1;
      setAsking(true);
      try {
        const asked = Date.now();
        const { data, error } = await supabase.functions.invoke('read-odometer', { body: { image_base64: await still(photo) } });
        if (__DEV__) {
          console.log(`odometer AI: ${Date.now() - asked} ms`, error ? `error ${error.context?.status ?? error.message}` : data);
          setSeen(`AI: ${error ? `error ${error.context?.status ?? error.message}` : JSON.stringify(data)}`.slice(0, 80));
        }
        const status = error?.context?.status;
        if (status === 403 || status === 429) return void (stop = true); // switched off, a guest, or today's limit: no retry
        const n: unknown = data?.reading;
        const reading = typeof n === 'number' && Number.isInteger(n) ? (current == null ? n : pick([String(n)]) ?? n) : null;
        if (reading != null && mine === look.current && !paused.current) return show(reading);
      } catch (e) {
        if (__DEV__) setSeen(`AI: ${e instanceof Error ? e.message : String(e)}`.slice(0, 80));
      } finally {
        if (mine === look.current) setAsking(false);
      }
      if (tries < AI_TRIES && !stop) timer = setTimeout(ask, 2500);
    };
    let timer = setTimeout(ask, AI_AFTER);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [started, found, guest, photo, current, pick, show]);

  const again = () => {
    look.current += 1;
    votes.current = NO_VOTES;
    since.current = Date.now();
    paused.current = false;
    setAsking(false);
    setFound(null);
  };

  const n = (v: number) => v.toLocaleString('en-US');

  return (
    <Shell
      onClose={onClose}
      corner={
        <View className="flex-row gap-2">
          {/* Q97: closer for small LCD digits. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('odometer.scan.zoom')}
            accessibilityState={{ selected: zoom === 1 }}
            hitSlop={12}
            onPress={() => setZoom(zoom ? 0 : 1)}
            className={`h-11 w-11 items-center justify-center rounded-full ${zoom ? 'bg-lime' : ''}`}
            style={zoom ? undefined : { backgroundColor: GLASS }}>
            <ZoomIn size={20} color={zoom ? '#222E29' : '#F5F7F5'} />
          </Pressable>
          {device.hasTorch ? (
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
      {/* Tap the window to focus on the digits (Q97). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('odometer.scan.focus')}
        onPress={(e) => camera.current?.focusTo({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }).catch(() => {})}
        className="overflow-hidden rounded-[20px] border-2 border-lime"
        style={{ height: WINDOW_H }}>
        <Camera
          ref={camera}
          style={{ flex: 1 }}
          device={device}
          isActive
          resizeMode="cover"
          torchMode={torch ? 'on' : 'off'}
          zoom={Math.min(device.maxZoom, Math.max(device.minZoom, ZOOMS[zoom]))}
          outputs={outputs}
          onStarted={onStarted}
        />
      </Pressable>
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
        // Test builds only (Q97): what was read, the numbers found, the pick and the last votes; tap to send the raw text.
        <Pressable onPress={() => Share.share({ message: [frameInfo, ...raw.current].join('\n') })}>
          <Text variant="caption" className="text-center text-onpanel" style={{ opacity: 0.5 }}>
            {`${guest ? 'guest' : 'account'} · AI ${AI_ON ? 'on' : 'off'} · ${started ? frameInfo || 'camera on' : 'camera starting'}\n${seen || 'no text yet'}`}
          </Text>
        </Pressable>
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
