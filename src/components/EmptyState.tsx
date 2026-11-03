import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, IconTile, Text } from '@/components/ui';
import { useColors } from '@/lib/theme';

type Tone = 'mint' | 'sky' | 'amber' | 'blush';

/** One look for "nothing here", "couldn't load" and "no results": a tinted icon tile with a soft light, a title, one line, an optional button. */
export function EmptyState({ icon: Icon, tone = 'mint', title, body, action, onAction, children }: {
  icon: LucideIcon; tone?: Tone; title: string; body?: string; action?: string; onAction?: () => void; children?: ReactNode;
}) {
  const c = useColors();
  return (
    <View className="items-center gap-5 px-6 py-10">
      <IconTile icon={Icon} tone={tone} size={80} color={tone === 'blush' ? c.danger : c.teal} />
      <View className="gap-1.5 self-stretch">
        <Text variant="heading" className="text-center">{title}</Text>
        {body ? <Text variant="body" className="text-center text-muted">{body}</Text> : null}
      </View>
      {action && onAction ? <Button title={action} onPress={onAction} className="self-stretch" /> : null}
      {children}
    </View>
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
