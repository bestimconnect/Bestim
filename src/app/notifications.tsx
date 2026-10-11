import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, type Href } from 'expo-router';
import { AlarmClock, BellRing, CalendarCheck, Gauge, Mic, type LucideIcon } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Item, Text } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { useInbox, type InboxItem, type InboxKind } from '@/stores/notifyInbox';

// Notifications page (decisions Q92): every alert the phone has shown, newest first, grouped by day. No Figma frame;
// it follows the Car log rows. Reminders (what is due now) stays its own page.
const ICONS: Record<InboxKind, LucideIcon> = { soon: CalendarCheck, overdue: AlarmClock, odometer: Gauge, weekly: BellRing, voice: Mic };

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { items, markRead, markAllRead } = useInbox();
  const locale = i18n.language === 'ar' ? ar : enUS;

  const day = (at: string) => {
    const d = parseISO(at);
    return isToday(d) ? t('inbox.today') : isYesterday(d) ? t('inbox.yesterday') : format(d, 'd MMMM yyyy', { locale });
  };
  const groups: { day: string; items: InboxItem[] }[] = [];
  for (const item of items) {
    const label = day(item.at);
    const last = groups[groups.length - 1];
    if (last?.day === label) last.items.push(item);
    else groups.push({ day: label, items: [item] });
  }
  const open = (item: InboxItem) => {
    markRead(item.id);
    router.push(item.url as Href);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper px-6" edges={['top', 'bottom']}>
      <Header title={t('inbox.header')} />
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2">
          <BellRing size={32} color={c.muted} />
          <Text variant="heading" className="text-center">{t('inbox.emptyTitle')}</Text>
          <Text variant="body" className="text-center text-muted">{t('inbox.emptyBody')}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4 pt-2" showsVerticalScrollIndicator={false}>
          {groups.map((g) => (
            <View key={g.day} className="gap-3">
              <Text variant="label" className="text-muted">{g.day}</Text>
              {g.items.map((item) => (
                <Item
                  key={item.id}
                  icon={ICONS[item.kind] ?? BellRing}
                  tone={item.kind === 'overdue' ? 'blush' : item.kind === 'soon' ? 'amber' : 'mint'}
                  title={item.title}
                  subtitle={`${item.body} · ${format(parseISO(item.at), 'p', { locale })}`}
                  accessibilityHint={item.read ? undefined : t('inbox.unread')}
                  aside={item.read ? null : <View className="h-2.5 w-2.5 rounded-full bg-teal" />}
                  chevron={item.read}
                  onPress={() => open(item)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
      {items.some((i) => !i.read) ? (
        <View className="pb-4 pt-2">
          <Button title={t('inbox.markAll')} variant="secondary" onPress={markAllRead} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
