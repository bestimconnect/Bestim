import { useRefresh } from '@/components/Refresh';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, parseISO, subMonths } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useState } from 'react';
import { Download } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/ErrorState';
import { openCapture } from '@/lib/reading';
import { PageHeader } from '@/components/PageHeader';
import { Button, Chip, FooterBar, Note, PressableScale, Text, Toggle } from '@/components/ui';
import { toCsv, toHtml, toJson, type ExportLabels, type ExportLog, type ExportOptions } from '@/lib/export';
import { blockFeature, useEntitlements } from '@/lib/entitlements';
import { useCurrentVehicle, useVehicleLogs, useVehicles, vehicleName } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';

// Screen 27 — Export (decisions Q42); ar-light 27/تصدير السجل.png
type Format = 'pdf' | 'csv' | 'json';
const FORMATS = ['pdf', 'csv', 'json'] as const;
type Period = 'all' | 'year' | 'half';
const PERIODS = ['all', 'year', 'half'] as const;
const ROWS = ['costs', 'workshops', 'identifiers', 'notes'] as const;

export default function ExportScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const refresh = useRefresh();
  const { vehicle } = useCurrentVehicle();
  const vehicles = useVehicles();
  const logs = useVehicleLogs(vehicle?.id);
  const [fmt, setFmt] = useState<Format>('pdf');
  const [opts, setOpts] = useState<ExportOptions>({ costs: true, workshops: true, identifiers: false, notes: false });
  const [period, setPeriod] = useState<Period>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ent = useEntitlements().data;

  const empty = logs.isSuccess && logs.data.length === 0;
  const prepare = async () => {
    if (!vehicle || !logs.data || blockFeature(ent, 'export')) return;
    setBusy(true);
    setError(false);
    try {
      const rtl = i18n.language === 'ar';
      const k = (s: string) => t(`export.file.${s}`);
      const labels: ExportLabels = {
        title: k('title'), date: k('date'), service: k('service'), odometer: k('odometer'), cost: k('cost'), workshop: k('workshop'),
        receipt: k('receipt'), notes: k('notes'), status: k('status'), plate: k('plate'), vin: k('vin'), yes: k('attached'),
        // keep the {{n}} placeholder: lib/export fills it
        excluded: t('export.file.excluded', { n: '{{n}}', interpolation: { escapeValue: false } }), rtl,
      };
      const since = period === 'all' ? null : format(subMonths(new Date(), period === 'year' ? 12 : 6), 'yyyy-MM-dd');
      const rows: ExportLog[] = logs.data.filter((l) => !since || l.service_date >= since).map((l) => ({
        service_date: fmt === 'pdf' ? format(parseISO(l.service_date), 'd MMM yyyy', { locale: rtl ? ar : enUS }) : l.service_date,
        title: l.title,
        odometer_reading: l.odometer_reading,
        cost: l.cost,
        currency: l.currency,
        location: l.location,
        description: l.description,
        status: l.status === 'needs_review' ? k('unverified') : '',
        photos: l.photos,
      }));
      const body = fmt === 'pdf' ? toHtml(vehicle, rows, opts, labels) : fmt === 'csv' ? toCsv(vehicle, rows, opts, labels) : toJson(vehicle, rows, opts);
      const base = `Bestim_${vehicle.make}_${vehicle.model}_${new Date().toLocaleDateString('en-CA')}`.replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_-]/gu, '');
      let uri: string;
      if (fmt === 'pdf') {
        // printToFileAsync names the file itself; copy it to the Q42 name.
        const printed = await Print.printToFileAsync({ html: body });
        const named = new File(Paths.cache, `${base}.pdf`);
        if (named.exists) named.delete();
        new File(printed.uri).copy(named);
        uri = named.uri;
      } else {
        const f = new File(Paths.cache, `${base}.${fmt}`);
        f.create({ overwrite: true });
        f.write(body);
        uri = f.uri;
      }
      await Sharing.shareAsync(uri, { mimeType: { pdf: 'application/pdf', csv: 'text/csv', json: 'application/json' }[fmt] });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (logs.isError && !logs.data) return <ErrorState onRetry={logs.refetch} retrying={logs.isRefetching} />;
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <PageHeader title={t('export.header')} />
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="px-6 pb-6 pt-2" showsVerticalScrollIndicator={false}>
        <Text variant="body" className="mx-1 text-muted">{t('export.intro')}</Text>
        {(vehicles.data?.length ?? 0) > 1 && vehicle ? <Text variant="caption" className="mx-1 mt-1 text-muted">{vehicleName(vehicle)}</Text> : null}
        <Text variant="body" className="mt-[18px] text-muted" style={{ fontSize: 14 }}>{t('export.format')}</Text>
        <View className="mt-2 flex-row gap-[9px]">
          {FORMATS.map((f) => (
            <PressableScale key={f} accessibilityRole="radio" accessibilityState={{ selected: fmt === f }} onPress={() => setFmt(f)} className="flex-1 rounded-[24px] bg-white p-3.5" style={{ boxShadow: fmt === f ? `0 0 0 2px ${c.ink}` : shadows.ring }}>
              <Text variant="number" style={{ fontSize: 22 }}>{f.toUpperCase()}</Text>
              <Text variant="caption" className="mt-0.5 text-muted" numberOfLines={2} style={{ fontSize: 12.5 }}>{t(`export.fmt.${f}`)}</Text>
            </PressableScale>
          ))}
        </View>
        <Text variant="body" className="mt-[18px] text-muted" style={{ fontSize: 14 }}>{t('export.period')}</Text>
        <View className="mt-2 flex-row flex-wrap gap-[7px]">
          {PERIODS.map((x) => <Chip key={x} label={t(`export.periods.${x}`)} selected={period === x} onPress={() => setPeriod(x)} />)}
        </View>
        <View className="mt-4 rounded-[24px] bg-white px-4 py-1" style={{ boxShadow: shadows.ring }}>
          <Text variant="caption" className="pt-3 text-muted">{t('export.includes')}</Text>
          {ROWS.map((r) => (
            <Row key={r} title={t(`export.${r}.title`)} subtitle={t(`export.${r}.sub`)} value={opts[r]} onChange={(v) => setOpts({ ...opts, [r]: v })} />
          ))}
        </View>
        <Text variant="caption" className="mx-1.5 mt-2 text-muted">{t('export.footnote')}</Text>
        {empty ? <Text variant="caption" className="mt-3 text-muted">{t('export.empty')}</Text> : null}
        {error ? <View className="mt-3"><Note tone="warning" text={t('export.error')} /></View> : null}
      </ScrollView>
      <FooterBar>
        {empty ? (
          <Button title={t('history.emptyCta')} onPress={() => openCapture()} />
        ) : (
          <Button title={t('export.now')} icon={<Download size={18} color={c.onbtn} />} loading={busy} disabled={!vehicle || !logs.isSuccess} onPress={prepare} />
        )}
      </FooterBar>
    </SafeAreaView>
  );
}

function Row({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="min-h-[56px] flex-row items-center gap-3 border-t border-line py-2.5">
      <View className="flex-1">
        <Text variant="body" style={{ fontSize: 14 }}>{title}</Text>
        <Text variant="caption" className="text-muted" style={{ fontSize: 12 }}>{subtitle}</Text>
      </View>
      <Toggle value={value} onChange={onChange} label={title} />
    </View>
  );
}
