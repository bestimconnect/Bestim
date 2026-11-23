import type { LucideIcon } from 'lucide-react-native';

import { useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** v2 `.chip` (Figma Chip): a paper pill, 12.5 text, small muted icon; selected = ink pill with paper text. */
export function Chip({ label, selected, onPress, icon: Icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: LucideIcon }) {
  const c = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      disabled={!onPress}
      onPress={onPress}
      className={`flex-row items-center gap-1.5 self-start rounded-full px-3 py-2 ${selected ? 'bg-ink' : 'bg-paper'}`}>
      {Icon ? <Icon size={13} color={selected ? c.paper : c.muted} strokeWidth={1.8} /> : null}
      <Text variant="caption" className={selected ? 'font-medium text-paper' : 'text-ink'} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}
