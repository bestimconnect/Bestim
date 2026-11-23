import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { shadows, useColors } from '@/lib/theme';
import { useInbox } from '@/stores/notifyInbox';
import { PressableScale } from './PressableScale';

/** The notifications bell (on the green panel, like the back button): the one action every tab's green bar (and Home's hero) carries. A dot means something is unread (Q92). */
export function BellButton({ tone = 'panel' }: { tone?: 'panel' | 'paper' }) {
  const paper = tone === 'paper';
  const c = useColors();
  const { t } = useTranslation();
  const unread = useInbox((s) => s.items.some((i) => !i.read));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={unread ? `${t('home.notifications')}, ${t('inbox.unread')}` : t('home.notifications')}
      onPress={() => router.push('/notifications')}
      className={`h-11 w-11 items-center justify-center rounded-full ${paper ? 'border border-[#1018140D] bg-white' : 'bg-[#FFFFFF26]'}`}
      style={paper ? { boxShadow: shadows.lift } : undefined}>
      <Bell size={20} color={paper ? c.ink : c.onpanel} />
      {unread ? <View className={`absolute end-2 top-2 h-2.5 w-2.5 rounded-full border-2 bg-coral ${paper ? 'border-white' : 'border-panel'}`} /> : null}
    </PressableScale>
  );
}
