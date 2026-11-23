import { useRefresh } from '@/components/Refresh';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, type Href } from 'expo-router';
import { BellRing, FileCheck, Gauge, Megaphone, Mic, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { PartArt } from '@/components/PartArt';
import { PageHeader } from '@/components/PageHeader';
import { Card, PressableScale, Text } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { useInbox, type InboxItem, type InboxKind } from '@/stores/notifyInbox';

// Alerts (flow 11): New (unread, with the lime dot) and Earlier, rows with the part art, tap opens the target.
const ICONS: Partial<Record<InboxKind, LucideIcon>> = { odometer: Gauge, weekly: BellRing, voice: Mic, licence: FileCheck, insurance: ShieldCheck, record: FileCheck, announcement: Megaphone };

/** Where a row goes: a part alert opens the Part page, a licence or insurance alert its Timeline item, a saved record the record. */
function target(item: InboxItem): Href {
  const service = item.url.match(/serviceTypeId=([\w-]+)/)?.[1];
  if (item.kind === 'licence' || item.kind === 'insurance') return service ? { pathname: '/timeline', params: { item: service } } : '/timeline';
  return item.url as Href; // soon / overdue: /part?..., record: /log/<id>, odometer: /update-odometer
}

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const refresh = useRefresh();
  const { items: all, markRead, markAllRead } = useInbox();
  const locale = i18n.language === 'ar' ? ar : enUS;
  // Design flow 11 #8: New (unread, green edge, "Mark all as read") then Earlier. Read state is kept on the phone (persisted), so alerts no longer vanish (#14).
  const groups = [
    { key: 'new', items: all.filter((i) => !i.read) },
    { key: 'earlier', items: all.filter((i) => i.read) },
  ].filter((g) => g.items.length);
  const open = (item: InboxItem) => {
    markRead(item.id);
    router.push(target(item));
  };
  const art = (item: InboxItem) => {
    const Icon = ICONS[item.kind];
    return (
      <View className="h-[50px] w-[50px] items-center justify-center rounded-full bg-paper">
        {Icon ? <Icon size={22} color={c.ink} strokeWidth={1.6} /> : <PartArt size={42} state={item.kind === 'overdue' ? 'late' : item.kind === 'soon' ? 'soon' : 'ok'} />}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('inbox.header')} />
      {all.length === 0 ? (
        <View className="flex-1 justify-center px-6 pb-10">
          <EmptyState icon={BellRing} title={t('inbox.emptyTitle')} body={t('inbox.emptyBody')} />
        </View>
      ) : (
        <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-5 px-6 pb-6 pt-2" showsVerticalScrollIndicator={false}>
          {groups.map((g) => (
            <View key={g.key} className="gap-2">
              <View className="min-h-[28px] flex-row items-center justify-between px-1">
                <Text variant="caption" className="text-muted">{t(g.key === 'new' ? 'inbox.new' : 'inbox.earlier')}</Text>
                {g.key === 'new' ? (
                  <PressableScale accessibilityRole="button" onPress={markAllRead} className="min-h-[44px] justify-center">
                    <Text variant="caption" className="text-ink">{t('inbox.markAll')}</Text>
                  </PressableScale>
                ) : null}
              </View>
              {g.items.map((item) => (
                <Card
                  key={item.id}
                  accessibilityLabel={`${item.title}. ${item.body}`}
                  accessibilityHint={item.read ? undefined : t('inbox.unread')}
                  onPress={() => open(item)}
                  className="min-h-[72px] flex-row items-center gap-3 px-3.5 py-3">
                  {art(item)}
                  <View className="min-w-0 flex-1">
                    <Text variant="label" numberOfLines={2}>{item.title}</Text>
                    <Text variant="caption" numberOfLines={2} className="text-muted">{`${item.body} · ${format(parseISO(item.at), 'd MMM p', { locale })}`}</Text>
                  </View>
                  {item.read ? null : <Text variant="caption" className="text-ok">{t('inbox.new')}</Text>}
                  {item.read ? null : <View pointerEvents="none" style={{ position: 'absolute', inset: 0, borderRadius: 24, boxShadow: `0 0 0 1.5px ${c.ok}` }} />}
                </Card>
              ))}
            </View>
          ))}
          <Text variant="caption" className="pt-2 text-center text-muted">{t('inbox.nomore')}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
