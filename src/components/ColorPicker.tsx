import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { CAR_COLORS } from '@/lib/carColors';

/** A row of colour dots; tap one to choose it, tap it again to clear. */
export function ColorPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <Text variant="caption" className="text-muted">{t('vehicles.color.label')}{value ? ` · ${t(`vehicles.color.${value}`, value)}` : ''}</Text>
      <View className="flex-row flex-wrap gap-3">
        {CAR_COLORS.map((c) => {
          const on = value === c.id;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={t(`vehicles.color.${c.id}`)}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(on ? null : c.id)}
              className={`h-11 w-11 items-center justify-center rounded-full border-2 ${on ? 'border-teal' : 'border-line'}`}>
              <View className="h-8 w-8 rounded-full border border-line" style={{ backgroundColor: c.hex }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
