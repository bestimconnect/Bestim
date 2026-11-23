import { View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** A section title with an optional action on the other side ("View all"). 12 below it; the caller leaves 24 above. */
export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3 pb-3">
      <Text variant="heading" className="shrink" numberOfLines={1}>{title}</Text>
      {action && onAction ? (
        <PressableScale accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text variant="caption" className="text-teal" numberOfLines={1}>{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
