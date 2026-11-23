import { router } from 'expo-router';
import { Camera, Image as ImageIcon, Trash2, X } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Card, IconCircle, PressableScale, Text } from '@/components/ui';
import { useSheet, type SheetAction } from '@/lib/sheet';
import { useColors } from '@/lib/theme';

// Confirmations (formSheet, same frame as screen 13). Opened with `sheet()` from src/lib/sheet.ts.
export default function Sheet() {
  const c = useColors();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { title, body, actions } = useSheet();
  const choices = actions.filter((a) => a.style !== 'cancel');
  const cancel = actions.find((a) => a.style === 'cancel');
  const run = (a: SheetAction) => {
    router.back();
    a.onPress?.();
  };

  // v2 flow 13 "photo source": icon-circle rows (camera, library, red bin) and a quiet cancel, no close button. Recognised by its title
  // because lib/sheet.ts (the SheetAction type) is shared with the confirm sheets.
  if (title === t('account.photo.title') && !body) {
    return (
      <View className="gap-2.5 rounded-t-screen bg-sheet px-6 pt-6" style={{ paddingBottom: bottom + 16 }}>
        <Text variant="heading" className="pb-1">{title}</Text>
        {choices.map((a, i) => {
          const bad = a.style === 'destructive';
          return (
            <Card key={i} onPress={() => run(a)} className="min-h-[70px] flex-row items-center gap-3 !rounded-row px-3.5 py-[13px]">
              <IconCircle icon={bad ? Trash2 : i === 0 ? Camera : ImageIcon} tone={bad ? 'late' : 'neutral'} size={44} />
              <Text variant="label" className={`flex-1 ${bad ? 'text-danger' : ''}`}>{a.text}</Text>
            </Card>
          );
        })}
        {cancel ? (
          <PressableScale accessibilityRole="button" onPress={() => run(cancel)} className="min-h-11 items-center justify-center">
            <Text className="text-muted" style={{ fontSize: 14 }}>{cancel.text}</Text>
          </PressableScale>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-4 rounded-t-screen border-t border-line bg-sheet px-6 pt-6" style={{ paddingBottom: bottom + 16 }}>
      <View className="min-h-11 flex-row items-center gap-3">
        <Text variant="heading" className="flex-1">{title}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
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
