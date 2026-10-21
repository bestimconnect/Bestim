import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useAvatarUrl } from '@/lib/avatar';

/** The profile picture, or the first letter of the name on a soft green circle. */
export function Avatar({ path, name, size = 56 }: { path?: string | null; name?: string | null; size?: number }) {
  const url = useAvatarUrl(path).data;
  const letter = (name?.trim()[0] ?? '·').toUpperCase();
  return url ? (
    <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityLabel={name ?? undefined} />
  ) : (
    <View className="items-center justify-center bg-mint" style={{ width: size, height: size, borderRadius: size / 2 }}>
      <Text variant="heading" className="text-teal" style={{ fontSize: size * 0.4, lineHeight: size * 0.55 }}>{letter}</Text>
    </View>
  );
}
