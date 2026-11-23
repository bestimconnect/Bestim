import { View } from 'react-native';

import { Text } from './Text';

/** v2 `.kv`: a muted key and a Medium value on one line (receipts, visit details). */
export function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row justify-between gap-3 px-0.5 py-[3px]">
      <Text variant="body" className="!text-[14px] text-muted">{k}</Text>
      <Text variant="body" className="shrink !text-[14px] font-medium" numberOfLines={1}>{v}</Text>
    </View>
  );
}
