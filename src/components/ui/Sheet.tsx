import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shadows } from '@/lib/theme';

/** The sheet handle (v2 `.grab`): 38×4, tick colour. */
export const Grabber = () => <View className="h-1 w-[38px] self-center rounded-full bg-tick" />;

// ponytail: v2 blurs the page under a .18 scrim; no blur module is installed, so a darker flat scrim stands in. Add expo-blur if the founder wants the blur.
const SCRIM = 'absolute inset-0 bg-[#00000059]';

/** v2 `.sheet` (Figma Bottom sheet): card colour, 36 top radius, grabber, 20 side / 12 top padding, 14 between items. Tap the scrim to close. */
export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
        <Pressable accessibilityLabel="close" className={SCRIM} onPress={onClose} />
        <View className="gap-3.5 rounded-t-sheet bg-white px-5 pt-3" style={{ paddingBottom: Math.max(bottom, 12) + 24 }}>
          <Grabber />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The centred confirm card (flow 8 "Delete confirm"): card colour, 28 radius, dialog shadow, over the scrim. */
export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-center px-6">
        <Pressable accessibilityLabel="close" className={SCRIM} onPress={onClose} />
        <View className="items-center gap-3 rounded-[28px] bg-white p-5" style={{ boxShadow: shadows.dialog }}>{children}</View>
      </View>
    </Modal>
  );
}
