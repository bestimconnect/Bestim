import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Mic, Square, TrendingUp } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { OdometerRuler } from '@/components/OdometerRuler';
import { Button, Choice, Field, Header, PressableScale, Text } from '@/components/ui';
import { useCurrentVehicle, type Vehicle } from '@/lib/queries';
import { EASE_OUT } from '@/lib/motion';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';
import { parseReading } from '@/lib/voice';

// A soft ring that leaves the mic while it listens: "recording now" (decisions Q57).
const PULSE = {
  animationName: { from: { transform: [{ scale: 1 }], opacity: 0.45 }, to: { transform: [{ scale: 1.7 }], opacity: 0 } },
  animationDuration: '1200ms',
  animationIterationCount: 'infinite',
  animationTimingFunction: EASE_OUT,
} as const;

// Screen 25 — Update odometer (decisions Q19.2, ruler + voice Q53).
function Form({ vehicle }: { vehicle: Vehicle }) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const qc = useQueryClient();
  const [value, setValue] = useState(String(vehicle.current_odometer));
  const [reason, setReason] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const unit = vehicle.odometer_unit;
  const shortUnit = t(`home.${unit}`);
  const last = vehicle.current_odometer.toLocaleString('en-US');
  const reading = /^\d+$/.test(value) ? Number(value) : null;
  const delta = (reading ?? vehicle.current_odometer) - vehicle.current_odometer;
  const lower = delta < 0;
  const days = differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at));

  // Voice: the recognizer writes what it hears, parseReading picks the number out of it.
  const [lang, setLang] = useState<'ar' | 'en'>(i18n.language === 'ar' ? 'ar' : 'en');
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<'' | 'voiceUnavailable' | 'notHeard'>('');
  const heard = useRef(false);
  const still = useReducedMotion();
  const mic = async () => {
    if (listening) return ExpoSpeechRecognitionModule.stop();
    setVoiceNote('');
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted || !ExpoSpeechRecognitionModule.isRecognitionAvailable()) return setVoiceNote('voiceUnavailable');
    heard.current = false;
    ExpoSpeechRecognitionModule.start({ lang: lang === 'ar' ? 'ar-EG' : 'en-US', interimResults: true });
  };
  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    if (!heard.current) setVoiceNote((n) => n || 'notHeard');
  });
  useSpeechRecognitionEvent('result', (e) => {
    const r = parseReading(e.results[0]?.transcript ?? '');
    if (r == null) return;
    heard.current = true;
    setValue(String(r));
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (e.error !== 'aborted') setVoiceNote(e.error === 'no-speech' ? 'notHeard' : 'voiceUnavailable');
  });
  useEffect(() => () => ExpoSpeechRecognitionModule.abort(), []);

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
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Header title={t('odometer.header')} />
        <Text variant="caption" className="text-muted">
          {days > 0 ? t('odometer.last', { value: last, unit: shortUnit, count: days }) : t('odometer.lastToday', { value: last, unit: shortUnit })}
        </Text>

        <View className="gap-4 rounded-metric bg-panel py-5" style={{ boxShadow: shadows.soft }}>
          <View className="justify-center px-5">
            <TextInput
              accessibilityLabel={t('odometer.label')}
              // Tapping the number starts a fresh one: editing inside a comma-formatted value makes the cursor jump.
              value={focused ? value : (reading ?? vehicle.current_odometer).toLocaleString('en-US')}
              onChangeText={(v) => setValue(v.replace(/\D/g, ''))}
              onFocus={() => {
                setFocused(true);
                setValue('');
              }}
              onBlur={() => {
                setFocused(false);
                if (!value) setValue(String(vehicle.current_odometer));
              }}
              keyboardType="number-pad"
              maxLength={7}
              placeholder={last}
              placeholderTextColor="#F5F7F566"
              className="p-0 text-number text-onpanel"
              style={{ fontFamily: 'Poppins_700Bold', textAlign: 'center' }}
            />
            <Text variant="label" className="absolute end-5 text-onpanel" style={{ opacity: 0.6 }}>{shortUnit}</Text>
          </View>
          <OdometerRuler value={reading ?? vehicle.current_odometer} onChange={(v) => setValue(String(v))} segment={unit === 'h' ? 100 : 1000} />
        </View>

        {lower ? (
          <Field label={t('odometer.reason')} value={reason} onChangeText={setReason} placeholder={t('odometer.noteBody')} multiline />
        ) : delta > 0 ? (
          <View className="flex-row items-center gap-2 self-center rounded-full bg-mint px-4 py-2">
            <TrendingUp size={16} color={c.teal} />
            <Text variant="caption" className="text-teal">{t('odometer.since', { value: delta.toLocaleString('en-US'), unit: shortUnit })}</Text>
          </View>
        ) : null}

        <View className="items-center gap-4 rounded-metric bg-white p-4" style={{ boxShadow: shadows.soft }}>
          <View className="flex-row items-center self-stretch">
            <Text variant="caption" className="flex-1 text-muted">{t('odometer.sayIt')}</Text>
            <View className="w-24">
              <Choice value={lang} onChange={setLang} options={[{ value: 'ar', label: 'ع' }, { value: 'en', label: 'EN' }]} />
            </View>
          </View>
          <View className="items-center justify-center">
            {listening && !still ? <Animated.View pointerEvents="none" className="absolute h-[72px] w-[72px] rounded-full bg-coral" style={PULSE} /> : null}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t(listening ? 'odometer.listening' : 'odometer.tapToSpeak')}
              onPress={mic}
              className={`h-[72px] w-[72px] items-center justify-center rounded-full ${listening ? 'bg-coral' : 'bg-lime'}`}
              style={listening ? undefined : { boxShadow: shadows.glow }}>
              {listening ? <Square size={24} color="#222E29" fill="#222E29" /> : <Mic size={28} color="#222E29" />}
            </PressableScale>
          </View>
          <Text variant="caption" className="text-center text-muted">
            {t(listening ? 'odometer.listening' : voiceNote ? `odometer.${voiceNote}` : 'odometer.tapToSpeak')}
          </Text>
        </View>

        {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
      </ScrollView>
      <View className="px-6 pb-4 pt-2">
        <Button title={t('odometer.cta')} onPress={save} loading={saving} disabled={reading == null} />
      </View>
    </SafeAreaView>
  );
}

export default function UpdateOdometerScreen() {
  const { vehicle } = useCurrentVehicle();
  return vehicle ? <Form vehicle={vehicle} /> : null;
}
