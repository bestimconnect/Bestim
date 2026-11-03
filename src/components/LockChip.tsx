import { Lock } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/components/ui';

/** The small "🔒 Pro" tag next to a feature the user's plan doesn't include. */
export function LockChip({ name }: { name?: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-lime px-2.5 py-1">
      <Lock size={12} color="#222E29" />
      {name ? <Text variant="caption" className="text-[#222E29]">{name}</Text> : null}
    </View>
  );
}
