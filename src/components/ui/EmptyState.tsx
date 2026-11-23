import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconCircle, type IconTone } from './IconCircle';
import { Text } from './Text';

/** v2 empty / all-clear / error state (flow 8): a big icon circle in a soft card halo, Title/M, one muted line, optional action. */
export function Empty({ icon, tone = 'lime', title, body, children }: { icon: LucideIcon; tone?: IconTone; title: string; body?: string; children?: ReactNode }) {
  return (
    <View className="items-center gap-4 px-6 py-8">
      <View className="h-[150px] w-[150px] items-center justify-center rounded-full bg-white">
        <IconCircle icon={icon} tone={tone} size={100} />
      </View>
      <View className="gap-1.5 self-stretch">
        <Text variant="title-m" className="text-center">{title}</Text>
        {body ? <Text variant="body-sm" className="text-center text-muted">{body}</Text> : null}
      </View>
      {children}
    </View>
  );
}
