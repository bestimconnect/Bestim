import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { I18nManager, Pressable, View, type PressableProps } from 'react-native';

import { shadows, useColors } from '@/lib/theme';
import { Text } from './Text';

const badges = { mint: 'bg-mint', paper: 'bg-paper', sky: 'bg-sky', amber: 'bg-amber', blush: 'bg-blush' };

type Props = PressableProps & {
  icon?: LucideIcon;
  tone?: keyof typeof badges;
  title: string;
  subtitle?: string;
  chevron?: boolean;
};

/** Figma `fresh/item`: 72h, 18 radius, 44 round icon badge, 18 chevron at the end side. */
export function Item({ icon: Icon, tone = 'mint', title, subtitle, chevron = true, ...rest }: Props) {
  const c = useColors();
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-[72px] flex-row items-center gap-3 rounded-item bg-white p-3.5 active:opacity-80"
      style={{ boxShadow: shadows.soft }}
      {...rest}>
      {Icon ? (
        <View className={`h-11 w-11 items-center justify-center rounded-full ${badges[tone]}`}>
          <Icon size={20} color={c.teal} />
        </View>
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text variant="label">{title}</Text>
        {subtitle ? <Text variant="caption" className="text-muted">{subtitle}</Text> : null}
      </View>
      {chevron ? <Chevron size={18} color={c.ink} /> : null}
    </Pressable>
  );
}
