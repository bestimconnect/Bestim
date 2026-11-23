import { PressableScale } from './PressableScale';
import { Text } from './Text';

/**
 * v2 `.opt` (large: 14/18 padding, 15 text, e.g. a voice question's answers) and `.ty` (small: 11 padding, 14 text, the car-type
 * grid): a paper pill; selected = ink with paper text, Medium.
 */
export function OptionPill({ label, selected, onPress, size = 'lg', className = '' }: { label: string; selected?: boolean; onPress?: () => void; size?: 'lg' | 'sm'; className?: string }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={`items-center justify-center rounded-full ${size === 'lg' ? 'px-[18px] py-3.5' : 'px-2 py-[11px]'} ${selected ? 'bg-ink' : 'bg-paper'} ${className}`}>
      <Text variant="body" className={`text-center ${size === 'sm' ? '!text-[14px]' : ''} ${selected ? 'font-medium text-paper' : 'text-ink'}`} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}
