import type { ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { Sheen } from '@/components/ui';

/** The tall green block at the top of Home, car details, a part and the plan pages: the bar's colour with the same soft light. */
export function HeroBlock({ children, className = '', style, onLayout }: { children: ReactNode; className?: string; style?: StyleProp<ViewStyle>; onLayout?: (e: LayoutChangeEvent) => void }) {
  return (
    <View onLayout={onLayout} className={`gap-3 rounded-b-[28px] bg-panel px-6 pb-4 ${className}`} style={style}>
      {/* its own clip so the content (car art, shadows) is never cut off */}
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden rounded-b-[28px]">
        <Sheen opacity={0.07} />
        <Sheen color="#D3F53D" opacity={0.09} glow="tr" radius={0.8} />
      </View>
      {children}
    </View>
  );
}
