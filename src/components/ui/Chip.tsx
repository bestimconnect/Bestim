import type { LucideIcon } from 'lucide-react-native';

import { useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** One pill for filters and choices (Q124): selected = ink, otherwise white with a hairline. */
export function Chip({ label, selected, onPress, icon: Icon }: { label: string; selected?: boolean; onPress: () => void; icon?: LucideIcon }) {
  const c = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={`h-10 flex-row items-center gap-1.5 rounded-full px-4 ${selected ? 'bg-ink' : 'border border-line bg-white'}`}>
      {Icon ? <Icon size={16} color={selected ? c.paper : c.teal} /> : null}
      <Text variant="caption" className={selected ? 'text-paper' : 'text-ink'} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}
