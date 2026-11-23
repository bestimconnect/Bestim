import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react-native';
import { forwardRef, type ReactNode } from 'react';
import { I18nManager, Pressable, ScrollView, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { KEYBOARD_DONE_ID } from '@/components/KeyboardDone';
import { PressableScale, Text } from '@/components/ui';
import { shadows, useColors } from '@/lib/theme';

// v2 auth pieces (design-v2 flows 8 and 9): back circle, big title, rounded fields with a small label, strength bar, banners.

/** Page shell: paper canvas, back circle on top, scrolling body, `footer` pinned to the bottom (flow 9 `BOT`). */
export function AuthScreen({ children, footer, back = true, right }: { children: ReactNode; footer?: ReactNode; back?: boolean; right?: ReactNode }) {
  const { t } = useTranslation();
  const c = useColors();
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="grow px-[18px] pb-3 pt-3.5" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View className="h-[50px] flex-row items-center justify-between">
          {back && router.canGoBack() ? (
            <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={router.back} className="h-[50px] w-[50px] items-center justify-center rounded-full bg-white" style={{ boxShadow: shadows.ring }}>
              <Back size={22} color={c.ink} />
            </PressableScale>
          ) : <View className="h-[50px] w-[50px]" />}
          {right ?? <View className="w-[50px]" />}
        </View>
        {children}
        {footer ? <View className="mt-auto gap-2.5 pb-2.5 pt-4">{footer}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AuthTitle({ title, sub, center }: { title: string; sub?: string; center?: boolean }) {
  return (
    <View className={`mt-[18px] ${center ? 'items-center' : ''}`}>
      <Text variant="title" className={center ? 'text-center' : ''} style={{ letterSpacing: -0.5 }}>{title}</Text>
      {sub ? <Text className={`mt-1.5 text-muted ${center ? 'text-center' : ''}`} style={{ lineHeight: 26 }}>{sub}</Text> : null}
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string; bad?: boolean; ltr?: boolean; className?: string };

/** v2 field: a white 18px tile, the label small on top, the value 16px under it. Red ring + label when `bad`/`error`. */
export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField({ label, error, bad, ltr = true, className = '', ...rest }, ref) {
  const c = useColors();
  const red = bad || !!error;
  return (
    <View className={className}>
      <View className="gap-0.5 rounded-[18px] bg-white px-4 py-[11px]" style={{ boxShadow: red ? `0 0 0 1.5px ${c.late}` : shadows.ring }}>
        <Text style={{ fontSize: 11.5, lineHeight: 16, color: red ? c.late : c.muted }}>{label}</Text>
        <TextInput
          ref={ref}
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          returnKeyType="done"
          placeholderTextColor={c.muted}
          className="p-0 text-ink"
          style={{ fontSize: 16, lineHeight: 22, textAlign: ltr ? 'left' : 'auto', writingDirection: ltr ? 'ltr' : undefined }}
          {...rest}
        />
      </View>
      {error ? <FieldError text={error} /> : null}
    </View>
  );
});

export function FieldError({ text }: { text: string }) {
  const c = useColors();
  return (
    <View className="mx-1 mt-[7px] flex-row items-center gap-1.5">
      <TriangleAlert size={14} color={c.late} strokeWidth={1.8} />
      <Text style={{ fontSize: 12.5, lineHeight: 18, color: c.late }}>{text}</Text>
    </View>
  );
}

/** Flow 8 banner: tinted tile with an icon and one line. `ok` = green (link sent), otherwise red. */
export function AuthBanner({ text, ok }: { text: string; ok?: boolean }) {
  const c = useColors();
  const Icon = ok ? Check : TriangleAlert;
  return (
    <View className={`mt-4 flex-row items-center gap-2.5 rounded-[18px] px-3.5 py-3 ${ok ? 'bg-mint' : 'bg-blush'}`}>
      <Icon size={20} color={ok ? c.ok : c.late} strokeWidth={1.8} />
      <Text className="flex-1" style={{ fontSize: 13.5, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

/** 0 to 4: length, a number, a letter, and extra length. Only the label and bar; the 8-char minimum is still enforced by the form. */
export function passwordScore(p: string) {
  if (!p) return 0;
  return [p.length >= 8, /\d/.test(p), /[A-Za-z؀-ۿ]/.test(p), p.length >= 12].filter(Boolean).length;
}

/** The 4-segment bar and the hint row under a new-password field (flow 9 `SIG`). */
export function StrengthBar({ password }: { password: string }) {
  const { t } = useTranslation();
  const c = useColors();
  const n = passwordScore(password);
  const label = n >= 4 ? 'strong' : n >= 3 ? 'good' : 'weak';
  return (
    <View>
      <View className="mt-2 flex-row gap-1" style={{ direction: 'ltr' }}>
        {[0, 1, 2, 3].map((i) => <View key={i} className="h-1 flex-1 rounded-[3px]" style={{ backgroundColor: i < n ? c.ok : c.tick }} />)}
      </View>
      <View className="mt-1.5 flex-row justify-between">
        <Text style={{ fontSize: 12, lineHeight: 18 }} className="text-muted">{t('auth.v2.rule')}</Text>
        {password ? <Text style={{ fontSize: 12, lineHeight: 18, color: n >= 3 ? c.ok : n >= 2 ? c.soon : c.late }}>{t(`auth.v2.${label}`)}</Text> : null}
      </View>
    </View>
  );
}

/** Checkbox row: a 20px square (filled ink when ticked), then the consent text. */
export function CheckRow({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: ReactNode }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} className="mt-3.5 min-h-11 flex-row items-center gap-2.5">
      <View className="h-5 w-5 items-center justify-center rounded-[7px]" style={{ borderWidth: 1.6, borderColor: checked ? c.ink : c.muted, backgroundColor: checked ? c.ink : 'transparent' }}>
        {checked ? <Check size={12} color={c.paper} strokeWidth={3} /> : null}
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  );
}

/** The quiet text link under the main button ("I already have an account"). */
export function TextLink({ title, onPress, underline }: { title: string; onPress: () => void; underline?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="min-h-11 items-center justify-center p-1">
      <Text className="text-muted" style={{ fontSize: 13.5, textDecorationLine: underline ? 'underline' : 'none' }}>{title}</Text>
    </Pressable>
  );
}

/** "or with email" divider (design `.or`). */
export function OrRule({ label }: { label: string }) {
  return (
    <View className="my-4 flex-row items-center gap-2.5">
      <View className="h-px flex-1 bg-line" />
      <Text className="text-muted" style={{ fontSize: 12.5 }}>{label}</Text>
      <View className="h-px flex-1 bg-line" />
    </View>
  );
}
