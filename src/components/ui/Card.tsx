import { View, type ViewProps } from 'react-native';

import { shadows } from '@/lib/theme';

export function Card({ className = '', style, ...rest }: ViewProps & { className?: string }) {
  return <View className={`rounded-item bg-white p-4 ${className}`} style={[{ boxShadow: shadows.card }, style]} {...rest} />;
}
