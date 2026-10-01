import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Text } from '@/components/ui';
import { useServiceTypes } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { parseTranscript, type VoiceResult } from '@/lib/voice';
import { useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';

// Screen 14 — Log by voice, PNG 14/التسجيل بالصوت (decisions Q18).
// Swap point for the partner's Edge Function (spec §8):
//   const { data } = await supabase.functions.invoke('process-voice-log', { body: { transcript, vehicle_id } });
const USE_MOCK = true;
async function process(transcript: string, vehicleId: string | null): Promise<VoiceResult> {
  if (USE_MOCK) return parseTranscript(transcript);
  const { data, error } = await supabase.functions.invoke('process-voice-log', { body: { transcript, vehicle_id: vehicleId } });
  if (error) throw error;
  return data as VoiceResult;
}

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
  const level = useSharedValue(0);
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [listening, setListening] = useState(false);
  const [noSpeech, setNoSpeech] = useState(false);
  const [typed, setTyped] = useState(false); // DEV fallback: recognizer unavailable (simulator)
  const [busy, setBusy] = useState(false);

  const toManual = () => router.replace({ pathname: '/capture/manual', params: { notice: 'micDenied' } });

  const unavailable = () => (__DEV__ ? setTyped(true) : toManual());

  const start = async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return toManual();
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return unavailable();
    ExpoSpeechRecognitionModule.start({
      lang: i18n.language === 'ar' ? 'ar-EG' : 'en-US',
      interimResults: true,
      continuous: true,
      volumeChangeEventOptions: { enabled: true },
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start();
    return () => ExpoSpeechRecognitionModule.abort();
  }, []);

  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    level.set(0);
  });
  // ponytail: latest result replaces the transcript; if Android continuous mode splits segments, accumulate finals here.
  useSpeechRecognitionEvent('result', (e) => setTranscript(e.results[0]?.transcript ?? ''));
  useSpeechRecognitionEvent('volumechange', (e) => {
    level.set(Math.min(1, Math.max(0, (e.value + 2) / 12)));
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'no-speech') setNoSpeech(true);
    else if (e.error === 'not-allowed') toManual();
    else if (e.error === 'service-not-allowed' || e.error === 'language-not-supported') unavailable();
  });

  const retry = () => {
    setNoSpeech(false);
    setTranscript('');
    setSeconds(0);
    start();
  };

  const cancel = () => {
    ExpoSpeechRecognitionModule.abort();
    router.back();
  };

  const finish = async () => {
    ExpoSpeechRecognitionModule.stop();
    const text = transcript.trim();
    if (!text) return setNoSpeech(true);
    setBusy(true);
    const d = useLogDraft.getState();
    try {
      const r = await process(text, d.vehicleId);
      const st = serviceTypes.data?.find((s) => s.name_en === r.service_type);
      d.set({
        transcript: text,
        serviceTypeId: st?.id ?? null,
        title: st ? (i18n.language === 'ar' ? st.name_ar : st.name_en) : text,
        odometer: r.odometer,
        cost: r.cost,
        parts: r.parts,
        source: 'voice',
      });
      const q = r.questions[0];
      router.replace(
        r.needs_clarification && q
          ? { pathname: '/capture/clarify', params: { value: String(q.value), phrase: q.phrase } }
          : '/capture/review',
      );
    } catch {
      setBusy(false);
      toManual();
    }
  };

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
              onChangeText={setTranscript}
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
          <Text className="text-muted">{t('capture.voice.hint')}</Text>
        )}
        <View className="flex-1" />
        <Button title={t('capture.voice.done')} onPress={finish} loading={busy} />
        <Button variant="secondary" title={t('capture.voice.cancel')} onPress={cancel} />
      </View>
    </SafeAreaView>
  );
}
