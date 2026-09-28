import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { shadows, useColors } from '@/lib/theme';
import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string; className?: string };

/** Figma `fresh/field`: label sits inside the white box, above the value. `className` sizes the outer wrapper (e.g. `flex-1` for a side-by-side row). */
export const Field = forwardRef<TextInput, Props>(function Field({ label, error, className = '', ...rest }, ref) {
  const c = useColors();
  return (
    <View className={`gap-2 ${className}`}>
      <View
        className={`rounded-field border bg-white px-4 pb-3 pt-2.5 ${error ? 'border-danger' : 'border-line'}`}
        style={{ boxShadow: shadows.field }}>
        <Text variant="caption" className="text-muted">{label}</Text>
        <TextInput ref={ref} placeholderTextColor={c.muted} className="p-0 text-body text-ink" style={{ textAlign: 'auto' }} {...rest} />
      </View>
      {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
    </View>
  );
});
