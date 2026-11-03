import { useRefresh } from '@/components/Refresh';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, type Href } from 'expo-router';
import { AlarmClock, BellRing, CalendarCheck, Gauge, Mic, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Backdrop, Button, Choice, FooterBar, Group, Header, Item, Section } from '@/components/ui';
import { useInbox, type InboxItem, type InboxKind } from '@/stores/notifyInbox';

// Notifications page (decisions Q92): every alert the phone has shown, newest first, grouped by day. No Figma frame;
// it follows the Car log rows. Reminders (what is due now) stays its own page.
const ICONS: Record<InboxKind, LucideIcon> = { soon: CalendarCheck, overdue: AlarmClock, odometer: Gauge, weekly: BellRing, voice: Mic };

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const refresh = useRefresh();
  const { items: all, markRead, markAllRead } = useInbox();
  const [only, setOnly] = useState<'all' | 'unread'>('all');
  const items = only === 'unread' ? all.filter((i) => !i.read) : all;
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
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <View className="px-6">
      <Header
        title={t('inbox.header')}
        below={
          all.length ? (
            <Choice
              onDark
              className="bg-[#FFFFFF1F]"
              value={only}
              onChange={setOnly}
              options={[{ value: 'all', label: t('inbox.all') }, { value: 'unread', label: t('inbox.unreadOnly') }]}
            />
          ) : undefined
        }
      />
      </View>
      {items.length === 0 ? (
        <View className="flex-1 justify-center px-6 pb-10">
          <EmptyState icon={BellRing} title={t('inbox.emptyTitle')} body={t('inbox.emptyBody')} />
        </View>
      ) : (
        <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-6 px-6 pb-6 pt-2" showsVerticalScrollIndicator={false}>
          {groups.map((g) => (
            <View key={g.day}>
              <Section title={g.day} />
              <Group>
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
              </Group>
            </View>
          ))}
        </ScrollView>
      )}
      {all.some((i) => !i.read) ? (
        <FooterBar inset={false}>
          <Button title={t('inbox.markAll')} variant="secondary" onPress={markAllRead} />
        </FooterBar>
      ) : null}
    </SafeAreaView>
  );
}
