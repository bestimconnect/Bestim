import { InputAccessoryView, Keyboard, Platform, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { palette } from '@/lib/palette';
import { useColors, useScheme } from '@/lib/theme';
import { Text } from './ui/Text';

/** Shared id the inputs point at (`inputAccessoryViewID`). */
export const KEYBOARD_DONE_ID = 'bestim-done';

/** iPhone number pads have no return key: a slim bar with one "Done" above every keyboard. Safe to mount on several screens (a formSheet needs its own copy). */
export function KeyboardDone() {
  const { t } = useTranslation();
  const c = useColors();
  const sheet = palette[useScheme()].sheet;
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID} backgroundColor={sheet}>
      <Pressable
        accessibilityRole="button"
        onPress={Keyboard.dismiss}
        className="h-11 items-end justify-center border-t px-5"
        style={{ backgroundColor: sheet, borderColor: c.line, borderTopWidth: 0.5 }}>
        <Text variant="label" style={{ color: c.teal }}>{t('common.done')}</Text>
      </Pressable>
    </InputAccessoryView>
  );
}
