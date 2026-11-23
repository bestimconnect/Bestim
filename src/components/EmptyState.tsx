import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Empty } from '@/components/ui';
import { useColors } from '@/lib/theme';

type Tone = 'mint' | 'sky' | 'amber' | 'blush';
const circle = { mint: 'lime', sky: 'neutral', amber: 'soon', blush: 'late' } as const;

/** "Nothing here", "couldn't load", "no results": the v2 state (components/ui Empty) with an optional button. */
export function EmptyState({ icon, tone = 'mint', title, body, action, onAction, children }: {
  icon: LucideIcon; tone?: Tone; title: string; body?: string; action?: string; onAction?: () => void; children?: ReactNode;
}) {
  return (
    <Empty icon={icon} tone={circle[tone]} title={title} body={body}>
      {action && onAction ? <Button title={action} onPress={onAction} className="self-stretch" /> : null}
      {children}
    </Empty>
  );
}

/** A page that is still loading: the spinner centred in the page, never a blank page under an empty bar. */
export function LoadingState() {
  const c = useColors();
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator color={c.teal} />
    </View>
  );
}
