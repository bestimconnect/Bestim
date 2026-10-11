import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { Redirect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Choice, Header, Note, Text, Toggle } from '@/components/ui';
import { toCsv, toHtml, toJson, type ExportLabels, type ExportLog, type ExportOptions } from '@/lib/export';
import { useCurrentVehicle, useIsGuest, useVehicleLogs, useVehicles, vehicleName } from '@/lib/queries';

// Screen 27 — Export (decisions Q42); ar-light 27/تصدير السجل.png
type Format = 'pdf' | 'csv' | 'json';
const ROWS = ['costs', 'workshops', 'identifiers', 'notes'] as const;

export default function ExportScreen() {
  const { t, i18n } = useTranslation();
  const guest = useIsGuest();
  const { vehicle } = useCurrentVehicle();
  const vehicles = useVehicles();
  const logs = useVehicleLogs(vehicle?.id);
  const [fmt, setFmt] = useState<Format>('pdf');
  const [opts, setOpts] = useState<ExportOptions>({ costs: true, workshops: true, identifiers: false, notes: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'account' } }} />;

  const empty = logs.isSuccess && logs.data.length === 0;
  const prepare = async () => {
    if (!vehicle || !logs.data) return;
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
      const rows: ExportLog[] = logs.data.map((l) => ({
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

  return (
    <SafeAreaView className="flex-1 bg-paper px-6" edges={['top']}>
      <Header title={t('export.header')} />
      <ScrollView contentContainerClassName="gap-4 pb-[120px]" showsVerticalScrollIndicator={false}>
        <Text variant="title">{t('export.title')}</Text>
        {(vehicles.data?.length ?? 0) > 1 && vehicle ? <Text variant="caption" className="text-muted">{vehicleName(vehicle)}</Text> : null}
        <Choice<Format> className="bg-line" value={fmt} onChange={setFmt} options={[{ value: 'pdf', label: 'PDF' }, { value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }]} />
        <Row title={t('export.logs.title')} subtitle={t('export.logs.sub')} value disabled />
        {ROWS.map((r) => (
          <Row key={r} title={t(`export.${r}.title`)} subtitle={t(`export.${r}.sub`)} value={opts[r]} onChange={(v) => setOpts({ ...opts, [r]: v })} />
        ))}
        <Text variant="caption" className="text-muted">{t('export.footnote')}</Text>
        {empty ? <Text variant="caption" className="text-muted">{t('export.empty')}</Text> : null}
        {error ? <Note tone="warning" text={t('export.error')} /> : null}
        <Button title={t('export.prepare')} loading={busy} disabled={!vehicle || !logs.isSuccess || empty} onPress={prepare} className="mt-4" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ title, subtitle, value, onChange, disabled }: { title: string; subtitle: string; value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View className="min-h-[72px] flex-row items-center gap-3 rounded-item bg-white p-4" style={{ opacity: disabled ? 0.7 : 1 }}>
      <View className="flex-1 gap-0.5">
        <Text variant="label">{title}</Text>
        <Text variant="caption" className="text-muted">{subtitle}</Text>
      </View>
      <Toggle value={value} onChange={disabled ? () => {} : onChange!} label={title} />
    </View>
  );
}
