import { type ReactNode, useMemo } from 'react';
import Animated from 'react-native-reanimated';

import { rise } from '@/lib/motion';

/** Entrance for a row or a line of text: fades in and rises, `index` staggers siblings (decisions Q57). Not for virtualized lists. */
export function Rise({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
  const entering = useMemo(() => rise(index), [index]);
  return <Animated.View entering={entering} className={className}>{children}</Animated.View>;
}
