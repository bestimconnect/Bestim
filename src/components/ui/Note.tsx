import { View } from 'react-native';

import { Text } from './Text';

const tones = { info: 'bg-sky', success: 'bg-mint', alert: 'bg-amber', warning: 'bg-blush' };

export function Note({ text, tone = 'success' }: { text: string; tone?: keyof typeof tones }) {
  return (
    <View className={`rounded-field p-4 ${tones[tone]}`}>
      <Text variant="caption">{text}</Text>
    </View>
  );
}
