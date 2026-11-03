import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The pinned action area at the bottom of a page (Q124): the main button in thumb reach, an optional round button
 * beside it, no hard border. Put it last in the screen root; `inset={false}` when the root already pads the home indicator.
 */
export function FooterBar({ children, inset = true }: { children: ReactNode; inset?: boolean }) {
  const bottom = useSafeAreaInsets().bottom;
  return <View className="gap-3 px-6 pt-3" style={{ paddingBottom: (inset ? Math.max(bottom, 12) : 0) + 12 }}>{children}</View>;
}
