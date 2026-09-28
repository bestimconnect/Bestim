import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { shadows, useColors } from '@/lib/theme';
import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string };

export const Field = forwardRef<TextInput, Props>(function Field({ label, error, ...rest }, ref) {
  const c = useColors();
  return (
    <View className="gap-2">
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={c.muted}
        className={`h-14 rounded-field border bg-white px-4 text-body text-ink ${error ? 'border-danger' : 'border-line'}`}
        style={{ boxShadow: shadows.field, textAlign: 'auto' }}
        {...rest}
      />
      {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
    </View>
  );
});
