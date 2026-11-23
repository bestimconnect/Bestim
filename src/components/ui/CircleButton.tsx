import { ChevronLeft, ChevronRight, X, type LucideIcon } from 'lucide-react-native';
import { I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';

import { shadows, useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';

/** v2 `.c` (top bar): a 50 card circle with a hairline and a 20 muted icon (bell, gear, back, close). */
export function CircleButton({ icon: Icon, onPress, label, size = 50 }: { icon: LucideIcon; onPress: () => void; label: string; size?: number }) {
  const c = useColors();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} className="items-center justify-center rounded-full bg-white" style={{ width: size, height: size, boxShadow: shadows.hair }}>
      <Icon size={20} color={c.muted} strokeWidth={1.7} />
    </PressableScale>
  );
}

/** Back circle: the chevron points to the start side (right in Arabic). */
export function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return <CircleButton icon={I18nManager.isRTL ? ChevronRight : ChevronLeft} onPress={onPress} label={t('back')} />;
}

export function CloseButton({ onPress, label }: { onPress: () => void; label: string }) {
  return <CircleButton icon={X} onPress={onPress} label={label} />;
}
