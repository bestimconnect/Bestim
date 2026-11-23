import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';

export type TrustKind = 'workshop' | 'receipt' | 'matched' | 'self';

const look = {
  workshop: { box: 'bg-ink', dot: 'bg-lime', text: 'text-paper' },
  receipt: { box: 'bg-paper', dot: 'bg-ok', text: 'text-muted' },
  matched: { box: 'bg-okTint', dot: 'bg-ok', text: 'text-ok' },
  self: { box: 'bg-paper', dot: 'bg-muted', text: 'text-muted' },
} as const;

/** Who vouches for a record (v2 `.trust`, Figma Trust tag): signed by a workshop, a receipt photo, matched, or self-reported. */
export function TrustTag({ kind, label }: { kind: TrustKind; label?: string }) {
  const { t } = useTranslation();
  const l = look[kind];
  return (
    <View className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${l.box}`}>
      <View className={`h-[7px] w-[7px] rounded-full ${l.dot}`} />
      <Text variant="caption" className={`!text-[11.5px] !leading-[16px] ${l.text}`}>{label ?? t(`tl.trust.${kind}`)}</Text>
    </View>
  );
}
