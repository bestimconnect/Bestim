import { View } from 'react-native';

import { Text } from './Text';

/** "or" divider between the email form and social sign-in buttons. */
export function Divider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-line" />
      <Text variant="caption" className="text-muted">{label}</Text>
      <View className="h-px flex-1 bg-line" />
    </View>
  );
}
