import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useAvatarUrl } from '@/lib/avatar';

/** The profile picture, or the first letter of the name on a soft green circle. */
export function Avatar({ path, name, size = 56, square }: { path?: string | null; name?: string | null; size?: number; square?: boolean }) {
  const url = useAvatarUrl(path).data;
  const h = square ? Math.round(size * 1.25) : size; // `square`: a portrait tag photo, as on the driver card
  const radius = square ? 12 : size / 2;
  const letter = (name?.trim()[0] ?? '·').toUpperCase();
  return url ? (
    <Image source={{ uri: url }} style={{ width: size, height: h, borderRadius: radius }} contentFit="cover" accessibilityLabel={name ?? undefined} />
  ) : (
    <View className="items-center justify-center bg-mint" style={{ width: size, height: h, borderRadius: radius }}>
      <Text variant="heading" className="text-teal" style={{ fontSize: size * 0.4, lineHeight: size * 0.55 }}>{letter}</Text>
    </View>
  );
}
