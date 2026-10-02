import { useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { BACK_OUT, EASE_OUT } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & { scale?: number; className?: string; style?: object };

/** `Pressable` with the app's press feedback (decisions Q57): dips while held, settles back with a small overshoot. */
export function PressableScale({ scale = 0.96, style, onPressIn, onPressOut, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  const still = useReducedMotion();
  return (
    <AnimatedPressable
      pressRetentionOffset={16}
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[
        style,
        still
          ? { opacity: pressed ? 0.8 : 1 }
          : {
              transform: [{ scale: pressed ? scale : 1 }],
              transitionProperty: 'transform',
              transitionDuration: pressed ? '120ms' : '260ms',
              transitionTimingFunction: pressed ? EASE_OUT : BACK_OUT,
            },
      ]}
    />
  );
}
