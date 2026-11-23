import { TriangleAlert } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { KEYBOARD_DONE_ID } from '../KeyboardDone';
import { shadows, useColors } from '@/lib/theme';
import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string; className?: string };

/**
 * v2 `.fld` (Figma Input field): a card box (18 radius, hairline ring), the label small and muted above a 16 Medium value.
 * Error: a 1.5 danger edge, the label in danger and the message under the box with a warning sign. Focus: a 1.5 ink edge.
 * `className` sizes the outer wrapper (e.g. `flex-1` in a side-by-side row).
 */
export const Field = forwardRef<TextInput, Props>(function Field({ label, error, className = '', onFocus, onBlur, style, ...rest }, ref) {
  const c = useColors();
  const { i18n } = useTranslation();
  const [focused, setFocused] = useState(false);
  const edge = error ? c.danger : focused ? c.ink : null;
  return (
    <View className={`gap-1.5 ${className}`}>
      <View className="gap-0.5 rounded-input bg-white px-4 py-[11px]" style={{ boxShadow: edge ? `0 0 0 1.5px ${edge}` : shadows.hair }}>
        <Text variant="caption" className={`!text-[11.5px] !leading-[16px] ${error ? 'text-danger' : 'text-muted'}`}>{label}</Text>
        <TextInput
          ref={ref}
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          returnKeyType={rest.multiline ? undefined : 'done'}
          placeholderTextColor={c.muted}
          className="p-0 text-ink"
          style={[{ fontSize: 16, lineHeight: 22, textAlign: 'auto', fontFamily: i18n.language === 'en' ? 'Poppins_500Medium' : 'Tajawal_500Medium' }, style]}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
      </View>
      {error ? (
        <View className="flex-row items-center gap-1.5 px-1">
          <TriangleAlert size={14}color={c.danger} />
          <Text variant="caption" className="shrink text-danger">{error}</Text>
        </View>
      ) : null}
    </View>
  );
});
