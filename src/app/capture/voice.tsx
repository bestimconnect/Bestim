import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { KEYBOARD_DONE_ID } from '@/components/KeyboardDone';
import { SheetBody, StopButton, TextLink, VoiceBlocked, VoiceIdle, VoiceNotHeard, VoiceUnderstanding } from '@/components/VoiceSheet';
import { Text } from '@/components/ui';
import { showUpgrade } from '@/lib/entitlements';
import { useServiceTypes, useVehicles } from '@/lib/queries';
import { speechLang } from '@/lib/speech';
import { normalizeRecords } from '@/lib/voiceRecords';
import { MAX_AUDIO_BYTES, queueVoice, sendVoice } from '@/lib/voiceSend';
import { useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';
import { useLogDraft } from '@/stores/logDraft';
import { useVoiceBatch } from '@/stores/voiceBatch';

// Log by voice, v2: a bottom sheet (design-v2 flow 4/8/13). Idle until the owner taps the big button (bug #19); no live captions (bug #21).
// The phone's own recognizer only draws the live text; the recording itself goes to the `process-voice-log`
// Edge Function, which answers with a list of records for capture/review-all (decisions Q58–Q69).
const MAX_SECONDS = 90; // Q66
const HINT_SECONDS = 75;
const MIME: Record<string, string> = { wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4' };
// Q79: phones with no speech service (Huawei), and Android 12 or older where the recognizer can't keep the
// recording, record directly. Small voice-quality AAC: 90 s is about 360 KB.
const DIRECT: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { extension: '.aac', outputFormat: 'aac_adts', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.LOW },
  web: {},
};

const BARS = [14, 26, 40, 22, 54, 34, 18, 46, 60, 30, 16, 42, 28, 12, 36, 20, 10]; // heights from the v2 design

function Bar({ base, level, green }: { base: number; level: SharedValue<number>; green: boolean }) {
  const style = useAnimatedStyle(() => ({ height: withTiming(base * (0.3 + 0.7 * level.value), { duration: 120 }) }));
  return <Animated.View className={`w-1 rounded-full ${green ? 'bg-ok' : 'bg-ink'}`} style={style} />;
}

/** Direct recording has no recognizer to report loudness, so the bars follow the recorder's own meter (dB). */
function DirectMeter({ recorder, level }: { recorder: AudioRecorder; level: SharedValue<number> }) {
  const { metering } = useAudioRecorderState(recorder, 150);
  useEffect(() => {
    level.set(Math.min(1, Math.max(0, ((metering ?? -60) + 60) / 50)));
  }, [metering, level]);
  return null;
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Voice() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const serviceTypes = useServiceTypes();
  const vehicles = useVehicles();
  const level = useSharedValue(0);
  const audioUri = useRef<string | null>(null);
  const sending = useRef(false); // once sending starts, send() owns the recording file
  const said = useRef(''); // the latest transcript, for handlers that run after the state they closed over
  const waitingForEnd = useRef(false);
  const doneAt = useRef(0); // when the owner tapped Done, to time the wait in development
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [listening, setListening] = useState(false);
  const [noSpeech, setNoSpeech] = useState(false);
  const [typed, setTyped] = useState(false); // DEV fallback on the iOS simulator (no recognizer, no one to speak): sends the typed text
  const recorder = useAudioRecorder(DIRECT);
  const [direct, setDirect] = useState(false); // Q79: recording directly, so no live text
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false); // nothing records until the owner taps the button
  const [blocked, setBlocked] = useState(false); // microphone permission refused
  const [step, setStep] = useState(0); // processing progress, for the three-step view
  const gone = useRef(false); // the sheet was closed: a late answer is ignored

  // The quick-add sheet is the fallback. A sheet is closed with back(), so go back first, then push it.
  const toManual = (notice?: string) => {
    router.back();
    router.push({ pathname: '/capture', params: { notice, vehicleId: useLogDraft.getState().vehicleId ?? undefined } });
  };

  const startDirect = async () => {
    if (__DEV__ && Platform.OS === 'ios') return setTyped(true);
    try {
      if (!(await requestRecordingPermissionsAsync()).granted) return setBlocked(true);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      audioUri.current = recorder.uri; // so leaving the screen can still delete the file
      setDirect(true);
      setListening(true);
    } catch {
      toManual('aiFailed');
    }
  };

  const start = async () => {
    audioUri.current = null;
    // Decide before asking for the microphone, so nobody grants it only to be sent to manual entry.
    // Offline (Q93) the phone's recognizer often needs the network too, so record directly; the recording waits in the queue.
    if (!onlineManager.isOnline() || !ExpoSpeechRecognitionModule.isRecognitionAvailable() || (Platform.OS === 'android' && Platform.Version < 33))
      return startDirect();
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return setBlocked(true);
    ExpoSpeechRecognitionModule.start({
      lang: await speechLang(i18n.language),
      interimResults: false, // no live text on screen: it is sometimes wrong, and the server writes the records from the audio
      continuous: true,
      volumeChangeEventOptions: { enabled: true },
      // 16 kHz 16-bit keeps 90 s under the upload limit.
      recordingOptions: { persist: true, outputSampleRate: 16000, outputEncoding: 'pcmFormatInt16' },
    });
  };

  const say = (text: string) => {
    said.current = text;
    setTranscript(text);
  };

  const send = async () => {
    sending.current = true;
    waitingForEnd.current = false;
    const d = useLogDraft.getState();
    const text = said.current.trim();
    const mime = MIME[audioUri.current?.split('.').pop() ?? ''] ?? null;
    const uri = audioUri.current && mime ? audioUri.current : null;
    const file = uri ? new File(uri) : null;
    let kept = false; // queued for later: the file now lives in the queue
    try {
      if (!d.vehicleId) return toManual('aiFailed');
      const fits = !!file && file.size > 0 && file.size <= MAX_AUDIO_BYTES;
      if (!fits && !text) {
        setBusy(false);
        return setNoSpeech(true);
      }
      // Q93: no connection, so the recording waits on the phone and is written up once it's back.
      const keep = () => {
        kept = queueVoice({ uri: fits ? uri : null, mime, text, vehicleId: d.vehicleId!, lang: i18n.language });
        if (!kept) return toManual('aiFailed');
        router.replace({ pathname: '/success', params: { kind: 'log', vehicleId: d.vehicleId!, offline: '1', queued: '1' } });
      };
      if (!onlineManager.isOnline()) return keep();
      const res = await sendVoice({ audio: fits ? await file!.base64() : null, mime, text, vehicleId: d.vehicleId, lang: i18n.language });
      if (gone.current) return; // closed while it was being written up
      if (!res.ok) return res.reason === 'offline' ? keep() : (res.reason === 'limit' && showUpgrade('limit', null, null, 'voice_per_day'), toManual(res.reason === 'limit' ? 'dailyLimit' : 'aiFailed')); // Q64, Q65
      if (__DEV__) console.log(`voice: ${Date.now() - doneAt.current} ms from Done to result`, res.ms);
      const heard = res.transcript || text;
      if (!heard) {
        setBusy(false);
        return setNoSpeech(true);
      }
      useVoiceBatch.getState().start(
        heard,
        normalizeRecords(res.records, {
          vehicleIds: (vehicles.data ?? []).map((v) => v.id),
          fallbackVehicleId: d.vehicleId,
          serviceNames: (serviceTypes.data ?? []).filter((s) => s.category_id).map((s) => s.name_en), // retired services are not offered
          today: new Date().toLocaleDateString('en-CA'),
        }),
      );
      router.replace('/capture/review-all'); // swap this sheet for the review sheet: opening one while the other dismisses left it with no height
    } catch {
      toManual('aiFailed');
    } finally {
      try {
        if (!kept) file?.delete(); // the recording is never kept
      } catch {}
    }
  };

  useEffect(() => {
    // The widget opens this screen with no car chosen: use the current one.
    if (!useLogDraft.getState().vehicleId) useLogDraft.getState().reset({ vehicleId: useSettings.getState().currentVehicleId });
    return () => {
      gone.current = true;
      ExpoSpeechRecognitionModule.abort();
      try {
        if (!sending.current && audioUri.current) new File(audioUri.current).delete(); // left without sending: the recording is never kept
      } catch {}
    };
  }, []);


  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('audioend', (e) => {
    audioUri.current = e.uri;
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    level.set(0);
    if (waitingForEnd.current) send(); // the recording file is complete only now
  });
  // ponytail: latest result replaces the transcript; if Android continuous mode splits segments, accumulate finals here.
  useSpeechRecognitionEvent('result', (e) => say(e.results[0]?.transcript ?? ''));
  useSpeechRecognitionEvent('volumechange', (e) => {
    level.set(Math.min(1, Math.max(0, (e.value + 2) / 12)));
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'no-speech') setNoSpeech(true);
    else if (e.error === 'not-allowed') setBlocked(true);
    else if (e.error === 'service-not-allowed' || e.error === 'language-not-supported' || e.error === 'network') startDirect();
  });

  const retry = () => {
    setStarted(true);
    setNoSpeech(false);
    say('');
    setSeconds(0);
    start();
  };

  const begin = () => {
    setStarted(true);
    start();
  };

  const stopDirect = async () => {
    await recorder.stop().catch(() => {});
    audioUri.current = recorder.uri;
    setListening(false);
    level.set(0);
  };

  const cancel = async (close = true) => {
    ExpoSpeechRecognitionModule.abort();
    if (direct) {
      await stopDirect();
      try {
        if (audioUri.current) new File(audioUri.current).delete(); // the recording is never kept
      } catch {}
    }
    if (close) router.back();
  };

  const cancelToManual = async () => {
    await cancel(false);
    toManual();
  };

  const finish = async () => {
    if (busy) return;
    doneAt.current = Date.now();
    setBusy(true);
    if (direct) await stopDirect();
    if (direct || !listening) return send();
    waitingForEnd.current = true;
    ExpoSpeechRecognitionModule.stop();
  };

  // The timer, and Q66: a long recording ends by itself and carries on to the review list.
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    const cap = setTimeout(() => finish(), (MAX_SECONDS - seconds) * 1000);
    return () => {
      clearInterval(id);
      clearTimeout(cap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  // Processing progress for the three-step view (upload, transcribe, extract): paced, the server answers in one call.
  useEffect(() => {
    if (!busy) return;
    const a = setTimeout(() => setStep(1), 1500);
    const b = setTimeout(() => setStep(2), 3500);
    return () => (clearTimeout(a), clearTimeout(b));
  }, [busy]);

  if (blocked) return <VoiceBlocked onSettings={() => Linking.openSettings()} onType={() => toManual()} />;
  if (noSpeech) return <VoiceNotHeard onRetry={retry} onType={() => toManual()} />;
  if (busy) return <VoiceUnderstanding step={step} onCancel={() => cancel()} />;
  if (!started) return <VoiceIdle onStart={begin} onType={() => toManual()} />;

  return (
    <SheetBody>
      <View className="flex-row items-center gap-1.5">
        <View className="h-[7px] w-[7px] rounded-full bg-late" />
        <Text variant="caption" className="text-muted">{t('logv2.listen')}</Text>
      </View>
      <View className="h-[104px] flex-row items-center justify-center gap-1 rounded-[22px] bg-paper" style={{ direction: 'ltr' }}>
        {BARS.map((b, i) => <Bar key={i} base={b} level={level} green={i % 5 === 0} />)}
      </View>
      <Text className="text-center text-[40px] leading-[48px]" style={{ fontFamily: 'Poppins_400Regular' }}>{mmss(seconds)}</Text>
      {typed ? (
        <TextInput
          value={transcript}
          onChangeText={say}
          multiline
          placeholder={t('capture.voice.typeHint')}
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          placeholderTextColor={c.muted}
          className="min-h-[80px] rounded-field bg-paper p-4 text-body text-ink"
          style={{ textAlign: 'auto' }}
        />
      ) : (
        <Text variant="caption" className="text-center text-muted">{t(seconds >= HINT_SECONDS ? 'capture.batch.longHint' : 'logv2.hint')}</Text>
      )}
      {direct && listening ? <DirectMeter recorder={recorder} level={level} /> : null}
      <StopButton onPress={finish} label={t('capture.voice.done')} />
      <TextLink title={t('logv2.typeIn')} onPress={() => cancelToManual()} />
    </SheetBody>
  );
}
