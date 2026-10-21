import { router, useLocalSearchParams } from 'expo-router';
import { Keyboard as KeyboardIcon, Mic, X } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { shadows, useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';

function Tile({ icon: Icon, title, body, onPress, dark }: { icon: typeof Mic; title: string; body: string; onPress: () => void; dark?: boolean }) {
  const c = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-1 items-center gap-3 rounded-item px-3 py-5 ${dark ? 'bg-panel' : 'bg-white'}`}
      style={{ boxShadow: shadows.soft }}>
      <View className={`h-16 w-16 items-center justify-center rounded-full ${dark ? 'bg-lime' : 'bg-mint'}`}>
        <Icon size={30} color={dark ? '#222E29' : c.teal} />
      </View>
      <View className="items-center gap-0.5">
        <Text variant="heading" className={dark ? 'text-onpanel' : ''}>{title}</Text>
        <Text variant="caption" className={`text-center ${dark ? 'text-onpanel' : 'text-muted'}`} style={dark ? { opacity: 0.7 } : undefined}>{body}</Text>
      </View>
    </PressableScale>
  );
}

// The "+" chooser (screen 13): say it, or type it. Say it opens the recorder; type it opens the quick-add sheet.
export default function ChooseCapture() {
  const { t } = useTranslation();
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const p = useLocalSearchParams<{ vehicleId?: string }>();

  // A formSheet's replace() only closes it on iOS, so close it, then push the next screen.
  const say = () => {
    useLogDraft.getState().reset({ vehicleId: p.vehicleId ?? null });
    router.back();
    router.push('/capture/voice');
  };
  const type = () => {
    router.back();
    router.push({ pathname: '/capture/new', params: p.vehicleId ? { vehicleId: p.vehicleId } : undefined });
  };

  return (
    <View className="gap-4 rounded-t-screen border-t border-line bg-sheet px-6 pt-6" style={{ paddingBottom: bottom + 16 }}>
      <View className="min-h-11 flex-row items-center gap-3">
        <Text variant="heading" className="flex-1">{t('capture.choose.title')}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
      <View className="flex-row gap-3">
        <Tile dark icon={Mic} title={t('capture.choose.say')} body={t('capture.choose.sayBody')} onPress={say} />
        <Tile icon={KeyboardIcon} title={t('capture.choose.type')} body={t('capture.choose.typeBody')} onPress={type} />
      </View>
    </View>
  );
}
