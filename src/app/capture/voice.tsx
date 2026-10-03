import { File } from 'expo-file-system';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Text } from '@/components/ui';
import { useServiceTypes, useVehicles } from '@/lib/queries';
import { speechLang } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { normalizeRecords } from '@/lib/voiceRecords';
import { useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';
import { useVoiceBatch } from '@/stores/voiceBatch';

// Screen 14 — Log by voice, PNG 14/التسجيل بالصوت.
// The phone's own recognizer only draws the live text; the recording itself goes to the `process-voice-log`
// Edge Function, which answers with a list of records for capture/review-all (decisions Q58–Q69).
const MAX_SECONDS = 90; // Q66; the function refuses more than ~3 MB
const HINT_SECONDS = 75;
const MAX_AUDIO_BYTES = 2_900_000;

const BARS = [22, 46, 72, 98, 64, 132, 110, 132, 64, 98, 72, 46, 22]; // heights from the PNG, symmetric

function Bar({ base, level }: { base: number; level: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ height: withTiming(base * (0.3 + 0.7 * level.value), { duration: 120 }) }));
  return <Animated.View className="w-1.5 rounded-full bg-ink" style={style} />;
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Voice() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const serviceTypes = useServiceTypes();
  const vehicles = useVehicles();
  const level = useSharedValue(0);
  const audioUri = useRef<string | null>(null);
  const said = useRef(''); // the latest transcript, for handlers that run after the state they closed over
  const waitingForEnd = useRef(false);
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [listening, setListening] = useState(false);
  const [noSpeech, setNoSpeech] = useState(false);
  const [typed, setTyped] = useState(false); // DEV fallback: recognizer unavailable (simulator); sends the typed text
  const [busy, setBusy] = useState(false);

  const toManual = (notice = 'micDenied') => router.replace({ pathname: '/capture/manual', params: { notice } });

  const unavailable = (why: string) => {
    console.warn('speech recognition unavailable:', why);
    return __DEV__ ? setTyped(true) : toManual();
  };

  const start = async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return toManual();
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return unavailable('not available on this device');
    audioUri.current = null;
    ExpoSpeechRecognitionModule.start({
      lang: await speechLang(i18n.language),
      interimResults: true,
      continuous: true,
      volumeChangeEventOptions: { enabled: true },
      // 16 kHz 16-bit keeps 90 s under the upload limit. Android 13+ only; older phones send the text instead.
      recordingOptions: { persist: true, outputSampleRate: 16000, outputEncoding: 'pcmFormatInt16' },
    });
  };

  const say = (text: string) => {
    said.current = text;
    setTranscript(text);
  };

  const send = async () => {
    waitingForEnd.current = false;
    const d = useLogDraft.getState();
    const text = said.current.trim();
    const file = audioUri.current?.endsWith('.wav') ? new File(audioUri.current) : null;
    try {
      if (!d.vehicleId) return toManual('aiFailed');
      const audio = file && file.size > 0 && file.size <= MAX_AUDIO_BYTES ? await file.base64() : null;
      if (!audio && !text) {
        setBusy(false);
        return setNoSpeech(true);
      }
      const { data, error } = await supabase.functions.invoke('process-voice-log', {
        body: { ...(audio ? { audio_base64: audio, mime: 'audio/wav' } : { transcript: text }), vehicle_id: d.vehicleId, lang: i18n.language },
      });
      if (error) return toManual(error.context?.status === 429 ? 'dailyLimit' : 'aiFailed'); // Q64, Q65
      const heard = String(data?.transcript ?? '') || text;
      if (!heard) {
        setBusy(false);
        return setNoSpeech(true);
      }
      useVoiceBatch.getState().start(
        heard,
        normalizeRecords(data?.records, {
          vehicleIds: (vehicles.data ?? []).map((v) => v.id),
          fallbackVehicleId: d.vehicleId,
          serviceNames: (serviceTypes.data ?? []).map((s) => s.name_en),
          today: new Date().toLocaleDateString('en-CA'),
        }),
      );
      router.replace('/capture/review-all');
    } catch {
      toManual('aiFailed');
    } finally {
      try {
        file?.delete(); // the recording is never kept
      } catch {}
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start();
    return () => ExpoSpeechRecognitionModule.abort();
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
    else if (e.error === 'not-allowed') toManual();
    else if (e.error === 'service-not-allowed' || e.error === 'language-not-supported') unavailable(e.error);
  });

  const retry = () => {
    setNoSpeech(false);
    say('');
    setSeconds(0);
    start();
  };

  const cancel = () => {
    ExpoSpeechRecognitionModule.abort();
    router.back();
  };

  const finish = () => {
    if (busy) return;
    setBusy(true);
    if (!listening) return send();
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

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 gap-5 p-6">
        <Header title={t('capture.voice.header')} />
        <View className="flex-row items-center justify-between">
          <Text variant="label">{t('capture.voice.listening')}</Text>
          <Text variant="small-number">{mmss(seconds)}</Text>
        </View>
        <View className="h-[150px] flex-row items-center justify-center gap-3.5">
          {BARS.map((b, i) => <Bar key={i} base={b} level={level} />)}
        </View>
        {typed ? (
          <View className="gap-2">
            <Text variant="caption" className="text-muted">{t('capture.voice.typeHint')}</Text>
            <TextInput
              value={transcript}
              onChangeText={say}
              multiline
              placeholderTextColor={c.muted}
              className="min-h-[80px] rounded-field border border-line bg-white p-4 text-body text-ink"
              style={{ textAlign: 'auto' }}
            />
          </View>
        ) : transcript ? (
          <Text variant="heading">«{transcript}»</Text>
        ) : null}
        {noSpeech ? (
          <View className="gap-2">
            <Pressable onPress={retry}><Text className="text-muted">{t('capture.voice.noSpeech')}</Text></Pressable>
            <Pressable onPress={() => router.replace('/capture/manual')}><Text variant="label" className="text-teal">{t('capture.voice.manualLink')}</Text></Pressable>
          </View>
        ) : (
          <Text className="text-muted">{t(seconds >= HINT_SECONDS ? 'capture.batch.longHint' : 'capture.voice.hint')}</Text>
        )}
        <View className="flex-1" />
        <Button title={t('capture.voice.done')} onPress={finish} loading={busy} />
        <Button variant="secondary" title={t('capture.voice.cancel')} onPress={cancel} />
      </View>
    </SafeAreaView>
  );
}
