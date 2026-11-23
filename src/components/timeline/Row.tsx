import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';

/** The v2 list row (design `.row`): a white tile, the part picture, title + small sub-line, a note or label at the end. */
export function Row({ leading, title, sub, aside, below, onPress }: { leading: ReactNode; title: string; sub?: string; aside?: ReactNode; below?: ReactNode; onPress?: () => void }) {
  return (
    <Card onPress={onPress} disabled={!onPress} className="rounded-[22px] px-3.5 py-3">
      <View className="flex-row items-center gap-3">
        <View className="h-[50px] w-[50px] items-center justify-center">{leading}</View>
        <View className="flex-1">
          <Text variant="label" numberOfLines={1} className="font-normal">{title}</Text>
          {sub ? <Text variant="caption" numberOfLines={1} className="text-muted">{sub}</Text> : null}
          {below ? <View className="mt-1.5">{below}</View> : null}
        </View>
        {aside ? <View className="self-start">{aside}</View> : null}
      </View>
    </Card>
  );
}

/** A small group label (design `.lab`). */
export const Label = ({ children }: { children: string }) => <Text variant="label" className="mb-0.5 mt-3 px-1 font-normal text-muted" style={{ fontSize: 14 }}>{children}</Text>;
