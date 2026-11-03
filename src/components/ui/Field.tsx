import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { KEYBOARD_DONE_ID } from '../KeyboardDone';
import { shadows, useColors } from '@/lib/theme';
import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string; className?: string };

/** Figma `fresh/field`: label sits inside the white box, above the value. `className` sizes the outer wrapper (e.g. `flex-1` for a side-by-side row). */
export const Field = forwardRef<TextInput, Props>(function Field({ label, error, className = '', onFocus, onBlur, ...rest }, ref) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View className={`gap-2 ${className}`}>
      <View
        className={`rounded-[16px] border bg-white px-4 pb-3 pt-2.5 ${error ? 'border-danger' : focused ? 'border-teal' : 'border-line'}`}
        style={{ boxShadow: focused && !error ? shadows.focus : shadows.field }}>
        <Text variant="caption" className={focused ? 'text-teal' : 'text-muted'}>{label}</Text>
        <TextInput ref={ref} inputAccessoryViewID={KEYBOARD_DONE_ID} returnKeyType={rest.multiline ? undefined : 'done'} placeholderTextColor={c.muted} className="p-0 text-body text-ink" style={{ textAlign: 'auto' }} onFocus={(e) => { setFocused(true); onFocus?.(e); }} onBlur={(e) => { setFocused(false); onBlur?.(e); }} {...rest} />
      </View>
      {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
    </View>
  );
});
