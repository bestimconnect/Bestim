import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { shadows } from '@/lib/theme';
import { Text } from './ui/Text';

// One short confirmation at the top of the screen ("Vehicle deleted"). It survives navigation because it's
// mounted once in the root layout. Call `toast(text)` from anywhere.
const useToast = create<{ text: string | null }>(() => ({ text: null }));
export const toast = (text: string) => useToast.setState({ text });

export function Toast() {
  const text = useToast((s) => s.text);
  const { top } = useSafeAreaInsets();
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => useToast.setState({ text: null }), 2500);
    return () => clearTimeout(id);
  }, [text]);
  if (!text) return null;
  return (
    <View pointerEvents="none" className="absolute inset-x-6 items-center" style={{ top: top + 8 }} accessibilityLiveRegion="polite">
      <View className="rounded-field bg-panel px-4 py-3" style={{ boxShadow: shadows.elevated }}>
        <Text variant="caption" className="text-onpanel">{text}</Text>
      </View>
    </View>
  );
}
