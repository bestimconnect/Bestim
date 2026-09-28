import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { I18nManager, Pressable, View, type PressableProps } from 'react-native';

import { shadows, useColors } from '@/lib/theme';
import { Text } from './Text';

type Props = PressableProps & { icon?: LucideIcon; title: string; subtitle?: string };

export function Item({ icon: Icon, title, subtitle, ...rest }: Props) {
  const c = useColors();
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-item bg-white p-4 active:opacity-80"
      style={{ boxShadow: shadows.soft }}
      {...rest}>
      {Icon ? (
        <View className="h-11 w-11 items-center justify-center rounded-field bg-mint">
          <Icon size={22} color={c.ink} />
        </View>
      ) : null}
      <View className="flex-1">
        <Text variant="label">{title}</Text>
        {subtitle ? <Text variant="caption" className="text-muted">{subtitle}</Text> : null}
      </View>
      <Chevron size={20} color={c.muted} />
    </Pressable>
  );
}
