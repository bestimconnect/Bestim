import { Check, Mic, MicOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, PressableScale, Text } from '@/components/ui';
import { shadows, useColors } from '@/lib/theme';

// The pieces of the v2 voice sheet (design-v2 flow 4, flow 8 failed states, flow 13). capture/voice.tsx picks one per state.
// All flat: a card-colour sheet, paper tiles inside it, one primary button.

/** The sheet's frame: grabber, then the content with the bottom inset. */
export function SheetBody({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View className="bg-white px-5 pt-3" style={{ gap, paddingBottom: bottom + 14 }}>
      <View className="h-1 w-[38px] self-center rounded-full bg-tick" />
      {children}
    </View>
  );
}

/** A quiet text-only action under the main button. */
export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} scale={0.98} className="min-h-11 items-center justify-center">
      <Text variant="caption" className="text-muted">{title}</Text>
    </PressableScale>
  );
}

/** The secondary pill: paper on the white sheet. */
export function PaperButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} className="h-[50px] items-center justify-center rounded-full bg-paper">
      <Text variant="caption" className="text-ink">{title}</Text>
    </PressableScale>
  );
}

/** The big lime record button. Recording starts only when this is tapped (bug #19). */
export function RecordButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <View className="items-center">
      <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="h-[84px] w-[84px] items-center justify-center rounded-full bg-lime" style={{ boxShadow: shadows.pill }}>
        <Mic size={34} color="#171B19" strokeWidth={1.9} />
      </PressableScale>
    </View>
  );
}

/** The stop button while recording: dark disc with a rounded square. */
export function StopButton({ onPress, label, busy }: { onPress: () => void; label: string; busy?: boolean }) {
  return (
    <View className="items-center">
      <PressableScale accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onPress} className="h-[72px] w-[72px] items-center justify-center rounded-full bg-btn" style={{ boxShadow: shadows.pill }}>
        <View className="h-[22px] w-[22px] rounded-md bg-onbtn" />
      </PressableScale>
    </View>
  );
}

/** A still waveform: the same bars as the listening card, flat. */
export function FlatWave({ height, bars, opacity }: { height: number; bars: number; opacity: number }) {
  return (
    <View className="flex-row items-center justify-center gap-1 rounded-[22px] bg-paper" style={{ height, opacity, direction: 'ltr' }}>
      {Array.from({ length: bars }, (_, i) => <View key={i} className="h-2 w-1 rounded-full bg-ink" />)}
    </View>
  );
}

/** Flow 13, "Log: ready": nothing is recording until the owner taps the button. */
export function VoiceIdle({ onStart, onType }: { onStart: () => void; onType: () => void }) {
  const { t } = useTranslation();
  return (
    <SheetBody>
      <View className="flex-row items-center gap-1.5">
        <View className="h-[7px] w-[7px] rounded-full bg-tick" />
        <Text variant="caption" className="text-muted">{t('logv2.tap')}</Text>
      </View>
      <FlatWave height={104} bars={17} opacity={0.5} />
      <Text className="px-2.5 text-center text-muted">{t('logv2.readyBody')}</Text>
      <RecordButton onPress={onStart} label={t('logv2.tap')} />
      <TextLink title={t('logv2.typeInstead')} onPress={onType} />
    </SheetBody>
  );
}

/** Flow 13, "Log: understanding": three steps while the recording is turned into records. `step` = how many are done. */
export function VoiceUnderstanding({ step, onCancel }: { step: number; onCancel: () => void }) {
  const { t } = useTranslation();
  const steps = [t('logv2.step1'), t('logv2.step2'), t('logv2.step3')];
  const done = Math.min(step, 2);
  return (
    <SheetBody gap={14}>
      <Text variant="heading" className="mt-1.5">{t('logv2.pc1')}</Text>
      <Text variant="caption" className="text-muted">{t('logv2.pc2')}</Text>
      <View className="h-1.5 overflow-hidden rounded-full bg-tick">
        <View className="h-1.5 rounded-full bg-ok" style={{ width: `${[24, 62, 88][done]}%` }} />
      </View>
      {steps.map((s, i) => (
        <View key={s} className="flex-row items-center gap-3">
          <View className={`h-[22px] w-[22px] items-center justify-center rounded-full ${i < done ? 'bg-ok' : 'bg-tick'}`}>
            {i < done ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
          <Text variant="caption" className={i > done ? 'text-muted' : 'text-ink'}>{s}</Text>
        </View>
      ))}
      <TextLink title={t('logv2.cancel')} onPress={onCancel} />
    </SheetBody>
  );
}

/** Flow 8, "Microphone blocked". */
export function VoiceBlocked({ onSettings, onType }: { onSettings: () => void; onType: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <SheetBody gap={12}>
      <View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-soonTint">
        <MicOff size={28} color={c.soon} strokeWidth={1.9} />
      </View>
      <Text variant="heading">{t('logv2.m1')}</Text>
      <Text className="leading-[26px] text-muted">{t('logv2.m2')}</Text>
      <Button title={t('logv2.m3')} onPress={onSettings} />
      <PaperButton title={t('logv2.m4')} onPress={onType} />
    </SheetBody>
  );
}

/** Flow 8, "Speech not understood". */
export function VoiceNotHeard({ onRetry, onType }: { onRetry: () => void; onType: () => void }) {
  const { t } = useTranslation();
  return (
    <SheetBody gap={12}>
      <FlatWave height={70} bars={13} opacity={0.35} />
      <Text variant="heading">{t('logv2.u1')}</Text>
      <Text variant="caption" className="text-muted">{t('logv2.u2')}</Text>
      <View className="gap-[7px]">
        {[t('logv2.ex1'), t('logv2.ex2')].map((x) => (
          <View key={x} className="rounded-2xl bg-paper px-3.5 py-[11px]">
            <Text variant="caption" className="text-ink">«{x}»</Text>
          </View>
        ))}
      </View>
      <Button title={t('logv2.u3')} onPress={onRetry} icon={<Mic size={18} color="#D3F53D" strokeWidth={1.9} />} />
      <PaperButton title={t('logv2.u4')} onPress={onType} />
    </SheetBody>
  );
}

/**
 * Flow 4, "One question": the app asks one thing it could not tell, with option pills.
 * Not reachable yet: the voice function does not ask questions (voice backend phase). The look is ready for it.
 */
export function VoiceQuestion({ said, question, options, picked, onPick, onVoice }: { said: string; question: string; options: string[]; picked: number | null; onPick: (i: number) => void; onVoice: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <SheetBody gap={14}>
      <Text variant="caption" className="text-muted">{t('logv2.heard')}</Text>
      <View className="flex-row">
        <Text className="rounded-lg bg-lime px-1.5 text-[17px] text-[#222E29]">{said}</Text>
      </View>
      <View className="flex-row items-center gap-3 rounded-[24px] bg-paper px-4 py-3.5">
        <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-lime">
          <Text variant="label" className="text-[#171B19]">B</Text>
        </View>
        <Text variant="heading" className="flex-1 text-[19px]">{question}</Text>
      </View>
      <View className="gap-2">
        {options.map((o, i) => (
          <PressableScale key={o} accessibilityRole="button" accessibilityState={{ selected: picked === i }} onPress={() => onPick(i)} scale={0.98} className={`items-center rounded-full px-[18px] py-3.5 ${picked === i ? 'bg-ink' : 'bg-paper'}`}>
            <Text className={picked === i ? 'text-paper' : 'text-ink'}>{o}</Text>
          </PressableScale>
        ))}
      </View>
      <Button variant="secondary" title={t('logv2.answerVoice')} onPress={onVoice} icon={<Mic size={18} color={c.ink} strokeWidth={1.9} />} />
    </SheetBody>
  );
}
