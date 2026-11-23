import { Plus } from 'lucide-react-native';

import { useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** v2 `.addc`: a dashed tick outline, 22 radius, "+ label" in ink Medium (Add a car). */
export function AddCard({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} className="flex-row items-center justify-center gap-2 rounded-row border-[1.5px] border-dashed border-tick p-[18px]">
      <Plus size={18} color={c.ink} />
      <Text variant="body" className="!text-[14.5px] font-medium">{label}</Text>
    </PressableScale>
  );
}
