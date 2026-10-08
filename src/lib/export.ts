// Export builders for screen 27 (CSV / JSON / HTML for the PDF). Pure (no RN imports) so
// `node --experimental-strip-types src/lib/export.check.ts` can run them. The screen passes translated labels.

export type ExportOptions = {
  costs: boolean; // amounts and currencies
  workshops: boolean; // workshop names + "receipt attached"
  identifiers: boolean; // plate number + VIN
  notes: boolean; // the user's own notes (log description)
};

export type ExportVehicle = {
  make: string;
  model: string;
  year: number;
  nickname?: string | null;
  plate_number?: string | null;
  vin?: string | null;
  current_odometer: number;
  odometer_unit: string;
};

export type ExportLog = {
  service_date: string;
  title: string;
  odometer_reading: number | null;
  cost: number | null;
  currency: string;
  location: string | null;
  description: string | null;
  status: string;
  photos: string[];
};

export type ExportLabels = {
  title: string; // "Maintenance history"
  date: string;
  service: string;
  odometer: string;
  cost: string;
  workshop: string;
  receipt: string;
  notes: string;
  status: string;
  plate: string;
  vin: string;
  yes: string;
  excluded: string; // "{{n}} details were left out of this file" — the screen fills n
  rtl: boolean;
};

type Column = { key: string; label: string; value: (l: ExportLog) => string };

function columns(o: ExportOptions, t: ExportLabels): Column[] {
  return [
    { key: 'date', label: t.date, value: (l) => l.service_date },
    { key: 'service', label: t.service, value: (l) => l.title },
    { key: 'odometer', label: t.odometer, value: (l) => (l.odometer_reading == null ? '' : String(l.odometer_reading)) },
    { key: 'status', label: t.status, value: (l) => l.status },
    ...(o.costs ? [{ key: 'cost', label: t.cost, value: (l: ExportLog) => (l.cost == null ? '' : `${l.cost} ${l.currency}`) }] : []),
    ...(o.workshops
      ? [
          { key: 'workshop', label: t.workshop, value: (l: ExportLog) => l.location ?? '' },
          { key: 'receipt', label: t.receipt, value: (l: ExportLog) => (l.photos.length ? t.yes : '') },
        ]
      : []),
    ...(o.notes ? [{ key: 'notes', label: t.notes, value: (l: ExportLog) => l.description ?? '' }] : []),
  ];
}

/** How many filled-in details the options leave out (the recipient sees the count, not the content). */
export function excludedCount(v: ExportVehicle, logs: ExportLog[], o: ExportOptions) {
  let n = 0;
  if (!o.identifiers) n += (v.plate_number ? 1 : 0) + (v.vin ? 1 : 0);
  for (const l of logs) {
    if (!o.costs && l.cost != null) n++;
    if (!o.workshops) n += (l.location ? 1 : 0) + (l.photos.length ? 1 : 0);
    if (!o.notes && l.description) n++;
  }
  return n;
}

// Text that starts like a formula (a title or note can come from someone else's shared history) gets a leading
// apostrophe, so Excel shows it instead of running it.
const csvCell = (raw: string) => {
  const s = /^[=+\-@\t\r]/.test(raw) && Number.isNaN(Number(raw)) ? `'${raw}` : raw;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(v: ExportVehicle, logs: ExportLog[], o: ExportOptions, t: ExportLabels) {
  const cols = columns(o, t);
  const n = excludedCount(v, logs, o);
  const rows = [cols.map((c) => c.label), ...logs.map((l) => cols.map((c) => c.value(l))), ...(n ? [[t.excluded.replace('{{n}}', String(n))]] : [])];
  // BOM so Excel opens Arabic as UTF-8.
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function toJson(v: ExportVehicle, logs: ExportLog[], o: ExportOptions) {
  return JSON.stringify(
    {
      vehicle: {
        make: v.make,
        model: v.model,
        year: v.year,
        nickname: v.nickname ?? null,
        odometer: v.current_odometer,
        odometer_unit: v.odometer_unit,
        ...(o.identifiers ? { plate_number: v.plate_number ?? null, vin: v.vin ?? null } : {}),
      },
      excluded_details: excludedCount(v, logs, o),
      logs: logs.map((l) => ({
        date: l.service_date,
        service: l.title,
        odometer: l.odometer_reading,
        status: l.status,
        ...(o.costs ? { cost: l.cost, currency: l.currency } : {}),
        ...(o.workshops ? { workshop: l.location, receipt_attached: l.photos.length > 0 } : {}),
        ...(o.notes ? { notes: l.description } : {}),
      })),
    },
    null,
    2,
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One printable page for expo-print. System fonts only: the PDF renderer can't load the app's fonts. */
export function toHtml(v: ExportVehicle, logs: ExportLog[], o: ExportOptions, t: ExportLabels) {
  const cols = columns(o, t);
  const n = excludedCount(v, logs, o);
  const ids = o.identifiers
    ? [v.plate_number && `${t.plate}: ${esc(v.plate_number)}`, v.vin && `${t.vin}: ${esc(v.vin)}`].filter(Boolean).join(' · ')
    : '';
  return `<!doctype html><html dir="${t.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#222E29;padding:24px}
h1{font-size:22px;margin:0 0 4px}p{margin:2px 0;color:#5B6860;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
th,td{text-align:start;padding:8px 6px;border-bottom:1px solid #DEE5DF}th{color:#5B6860;font-weight:600}
</style></head><body>
<h1>${esc(t.title)}</h1>
<p>${esc(v.nickname || `${v.make} ${v.model}`)} · ${v.year} · ${v.current_odometer.toLocaleString('en-US')} ${esc(v.odometer_unit)}</p>
${ids ? `<p>${ids}</p>` : ''}
<table><thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
<tbody>${logs.map((l) => `<tr>${cols.map((c) => `<td>${esc(c.value(l))}</td>`).join('')}</tr>`).join('')}</tbody></table>
${n ? `<p style="margin-top:16px">${esc(t.excluded.replace('{{n}}', String(n)))}</p>` : ''}
</body></html>`;
}
