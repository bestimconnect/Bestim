import { router } from 'expo-router';
import { Mic, Pencil, X } from 'lucide-react-native';
import { I18nManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { useOnline } from '@/lib/online';
import { useCurrentVehicle, useIsGuest } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';

// Screen 13 — Choose how to log (formSheet), PNG 13/اختر طريقة التسجيل.
export default function CaptureSheet() {
  const { t } = useTranslation();
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const { vehicle } = useCurrentVehicle();
  const connected = useOnline();
  const guest = useIsGuest();
  const online = connected || !guest; // Q93: full accounts can record offline (it waits on the phone); guests can't

  const pick = (source: 'voice' | 'manual') => {
    useLogDraft.getState().reset({ vehicleId: vehicle?.id ?? null, source });
    // replace() from a formSheet only closes the sheet on iOS, so close it, then push the full screen.
    router.back();
    router.push(source === 'voice' ? '/capture/voice' : '/capture/manual');
  };

  return (
    <View className="gap-5 rounded-t-screen border-t border-line bg-sheet px-6 pt-6" style={{ paddingBottom: bottom + 16 }}>
      <View className="h-11 flex-row items-center justify-between">
        <Text variant="heading">{t('capture.newRecord')}</Text>
        <PressableScale accessibilityRole="button" onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
      <View className="gap-2">
        <Text variant="title">{t('capture.index.title')}</Text>
        <Text className="text-muted">{t('capture.index.subtitle')}</Text>
      </View>
      {/* Both designs keep "by voice" on the physical left, in Arabic too. */}
      <View className="gap-4 pt-4" style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }}>
        <PressableScale
          accessibilityRole="button"
          onPress={() => pick('voice')}
          disabled={!online}
          className={`h-[152px] flex-1 items-center justify-center gap-2 rounded-item bg-panel ${online ? '' : 'opacity-50'}`}>
          <Mic size={26} color="#D3F53D" />
          <Text variant="label" className="text-onpanel">{t('capture.index.voice')}</Text>
          <Text variant="caption" className="px-2 text-center text-muted">{t(online ? 'capture.index.voiceSub' : 'feedback.offline.voiceSheet')}</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          onPress={() => pick('manual')}
          className="h-[152px] flex-1 items-center justify-center gap-2 rounded-item bg-white"
          style={{ boxShadow: shadows.soft }}>
          <View className="h-14 w-14 items-center justify-center rounded-full bg-lime">
            <Pencil size={24} color="#222E29" />
          </View>
          <Text variant="label">{t('capture.index.manual')}</Text>
          <Text variant="caption" className="text-muted">{t('capture.index.manualSub')}</Text>
        </PressableScale>
      </View>
      <View className="gap-1 rounded-field bg-mint p-4">
        <Text variant="label">{t('capture.index.noteTitle')}</Text>
        <Text variant="caption" className="text-muted">{t('capture.index.noteBody')}</Text>
      </View>
    </View>
  );
}
