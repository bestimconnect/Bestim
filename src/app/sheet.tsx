import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PressableScale, Text } from '@/components/ui';
import { useSheet, type SheetAction } from '@/lib/sheet';
import { useColors } from '@/lib/theme';

// Confirmations (formSheet, same frame as screen 13). Opened with `sheet()` from src/lib/sheet.ts.
export default function Sheet() {
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const { title, body, actions } = useSheet();
  const choices = actions.filter((a) => a.style !== 'cancel');
  const cancel = actions.find((a) => a.style === 'cancel');
  const run = (a: SheetAction) => {
    router.back();
    a.onPress?.();
  };

  return (
    <View className="gap-4 rounded-t-screen border-t border-line bg-sheet px-6 pt-6" style={{ paddingBottom: bottom + 16 }}>
      <View className="min-h-11 flex-row items-center gap-3">
        <Text variant="heading" className="flex-1">{title}</Text>
        <PressableScale accessibilityRole="button" onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
      {body ? <Text className="text-muted">{body}</Text> : null}
      <View className="gap-2 pt-2">
        {choices.map((a, i) => (
          <Button key={i} title={a.text} variant={a.style === 'destructive' ? 'danger' : 'primary'} onPress={() => run(a)} />
        ))}
        {cancel ? <Button title={cancel.text} variant="secondary" onPress={() => run(cancel)} /> : null}
      </View>
    </View>
  );
}
