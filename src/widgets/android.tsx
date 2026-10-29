import { Directory, File, Paths } from 'expo-file-system';
import {
  FlexWidget, ImageWidget, OverlapWidget, registerWidgetTaskHandler, requestWidgetUpdate, SvgWidget, TextWidget,
  type WidgetTaskHandlerProps,
} from 'react-native-android-widget';

import { emptySnapshot, type WidgetCar, type WidgetSnapshot } from '@/lib/widgetSnapshot';

import { SNAPSHOT_FILE } from './sync';

// Android widgets (react-native-android-widget): the same set and the same buttons as iOS, in the "A light card" look.
// They draw from the snapshot file written by sync.ts; pictures are inlined as data URIs because a widget cannot read
// app files. A button runs in the app's background JS even when the app is closed: it calls the same limited
// widget_action function as on iOS, then rewrites the file and redraws. Names must match app.config.js.
export const ANDROID_WIDGETS = ['BestimNext', 'BestimKm', 'BestimDashboard', 'BestimQuick', 'BestimSpend'] as const;
type Name = (typeof ANDROID_WIDGETS)[number];
type State = WidgetSnapshot & { pend?: number; flash?: 'saved' | 'error' | null }; // pend/flash: widget-side only, like iOS

const C = { bg: '#FFFFFF', ink: '#222E29', muted: '#5B6860', chip: '#F5F7F5', lime: '#D3F53D', ring: '#08736F', track: '#E8EDE8', red: '#F96A83' } as const;
const DOT = { ok: '#5BBE7B', soon: '#FFC95C', overdue: '#F96A83' } as const;
const dir = () => new Directory(Paths.document, 'widget');

async function readState(): Promise<State> {
  try {
    return await new File(dir(), SNAPSHOT_FILE).json();
  } catch {
    return emptySnapshot('ar');
  }
}
function writeState(st: State) {
  const f = new File(dir(), SNAPSHOT_FILE);
  f.create({ overwrite: true });
  f.write(JSON.stringify(st));
}

async function dataUri(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    return `data:image/${path.endsWith('.png') ? 'png' : 'webp'};base64,${await new File(path).base64()}`;
  } catch {
    return null;
  }
}

const fmt = (x: number) => Math.round(x).toLocaleString('en-US');
const link = (uri: string) => ({ clickAction: 'OPEN_URI' as const, clickActionData: { uri } });
const tap = (clickAction: string, data: Record<string, unknown> = {}) => ({ clickAction, clickActionData: data });
const t = (text: string, fontSize: number, fontWeight: '400' | '600' | '700' | '800', color: string = C.ink) => (
  <TextWidget text={text} style={{ fontSize, fontWeight, color: color as `#${string}` }} maxLines={1} truncate="END" />
);
const icon = (d: string, color: string, size: number) => (
  <SvgWidget svg={`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`} style={{ width: size, height: size }} />
);
const ICON = {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  fuel: '<path d="M5 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M4 20h12M15 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="M8 8h4"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
};

function ring(score: number | null, size: number) {
  const r = 20;
  const len = 2 * Math.PI * r;
  const on = ((score ?? 0) / 100) * len;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48"><circle cx="24" cy="24" r="${r}" fill="none" stroke="${C.track}" stroke-width="5"/><circle cx="24" cy="24" r="${r}" fill="none" stroke="${C.ring}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${on} ${len}" transform="rotate(-90 24 24)"/></svg>`;
  return <SvgWidget svg={svg} style={{ width: size, height: size }} />;
}

const card = (children: React.ReactNode, uri: string, extra: Record<string, unknown> = {}) => (
  <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: C.bg, borderRadius: 28, padding: 16, flexDirection: 'column', ...extra }} {...link(uri)}>
    {children}
  </FlexWidget>
);
const gap = (w = 6) => <FlexWidget style={{ width: w, height: 1 }} />;
const button = (label: string, a: ReturnType<typeof tap>, fill: string, height = 34, fontSize = 13) => (
  <FlexWidget style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: fill as `#${string}`, alignItems: 'center', justifyContent: 'center' }} {...a}>
    {t(label, fontSize, '700')}
  </FlexWidget>
);
const dot = (state: 'ok' | 'soon' | 'overdue') => <FlexWidget style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: DOT[state] }} />;

const left = (st: State, car: WidgetCar, x: WidgetCar['parts'][number]) => {
  const useKm = x.by === 'km' && x.kmLeft != null;
  const v = useKm ? (x.kmLeft as number) : (x.daysLeft ?? 0);
  const u = useKm ? car.unit : st.s.days;
  const ar = st.lang === 'ar';
  if (v <= 0) return ar ? `${st.s.late} ${fmt(-v)} ${u}` : `${fmt(-v)} ${u} ${st.s.late}`;
  return ar ? `${st.s.left} ${fmt(v)} ${u}` : `${fmt(v)} ${u} ${st.s.left}`;
};

function switcher(st: State) {
  if (st.cars.length < 2) return <FlexWidget style={{ width: 1, height: 1 }} />;
  return (
    <FlexWidget style={{ flexDirection: 'row' }}>
      <FlexWidget {...tap('SWITCH', { by: -1 })}>{icon(ICON.left, C.muted, 18)}</FlexWidget>
      <FlexWidget {...tap('SWITCH', { by: 1 })}>{icon(ICON.right, C.muted, 18)}</FlexWidget>
    </FlexWidget>
  );
}

function draw(name: Name, st: State, carPic: string | null, partPics: (string | null)[]) {
  const s = st.s;
  const car = st.cars[st.sel] ?? st.cars[0];
  if (!car) return card(<FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>{t(s.open, 15, '700')}</FlexWidget>, 'bestim://');
  const id = encodeURIComponent(car.id);
  const kmUrl = `bestim://update-odometer?vehicleId=${id}`;
  const partUrl = (pid: string) => `bestim://part?vehicleId=${id}&serviceTypeId=${encodeURIComponent(pid)}`;
  const top = car.parts[0];
  const pend = st.pend ?? 0;
  const canAct = !!st.api;
  const flash = st.flash === 'saved' ? s.saved : st.flash === 'error' ? s.offline : car.ageLabel;
  const act = (a: ReturnType<typeof tap>, url: string) => (canAct ? a : link(url));

  if (name === 'BestimNext')
    return card(
      <>
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
          {t(s.next, 11, '600', C.muted)}
          {switcher(st)}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 4 }}>
          <FlexWidget style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}>
            {(partPics[0] ?? carPic) && <ImageWidget image={(partPics[0] ?? carPic) as `data:image${string}`} imageWidth={34} imageHeight={34} />}
          </FlexWidget>
          <FlexWidget style={{ flex: 1, paddingLeft: 8, paddingRight: 8 }}>
            {t(top ? top.name : s.allOk, 15, '800')}
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
              {top && dot(top.state)}
              {gap(5)}
              {t(top ? left(st, car, top) : flash, 11, '400')}
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1, width: 'match_parent' }} />
        {top && (
          <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
            {button(s.done, act(tap('DONE', { id: top.id }), partUrl(top.id)), C.lime, 34, 12)}
            {gap(6)}
            {button(s.snooze, act(tap('SNOOZE', { id: top.id }), partUrl(top.id)), C.chip, 34, 11)}
          </FlexWidget>
        )}
      </>,
      top ? partUrl(top.id) : kmUrl,
    );

  if (name === 'BestimKm')
    return card(
      <>
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
          {t(`${s.odometer} ${car.name}`, 11, '600', C.muted)}
          {switcher(st)}
        </FlexWidget>
        {t(fmt(car.km + pend), 30, '700', pend > 0 ? C.ring : C.ink)}
        {t(st.flash === 'error' ? s.offline : st.flash === 'saved' ? s.saved : pend > 0 ? `+${fmt(pend)} ${car.unit}` : `${car.unit} · ${car.ageLabel}`, 11, '400', st.flash === 'error' ? C.red : C.muted)}
        <FlexWidget style={{ flex: 1, width: 'match_parent' }} />
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
          {[10, 50, 100].flatMap((d, i) => [i ? gap(4) : null, button(`+${d}`, act(tap('ADD', { d }), kmUrl), C.chip, 32, 12)])}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 5 }}>
          {pend > 0 ? button(`${s.save} ${fmt(car.km + pend)}`, act(tap('SAVE'), kmUrl), C.lime, 36) : button(s.edit, link(kmUrl), C.chip, 36)}
        </FlexWidget>
      </>,
      kmUrl,
    );

  if (name === 'BestimSpend') {
    const sp = car.spend;
    const seg = (share: number, color: string) => <FlexWidget style={{ flex: Math.max(share, 0.02), height: 10, borderRadius: 5, backgroundColor: color as `#${string}` }} />;
    return card(
      <>
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
          {t(sp.label, 11, '600', C.muted)}
          {switcher(st)}
        </FlexWidget>
        {t(sp.total, 30, '700')}
        {t(sp.currency, 12, '400', C.muted)}
        <FlexWidget style={{ flex: 1, width: 'match_parent' }} />
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
          {seg(sp.fuel, C.ring)}
          {seg(sp.maintenance, DOT.soon)}
          {seg(sp.other, DOT.overdue)}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
          {t(s.fuelOther, 10, '400', C.muted)}
          {t(s.maint, 10, '400', C.muted)}
          {t(s.other, 10, '400', C.muted)}
        </FlexWidget>
      </>,
      'bestim://expenses',
    );
  }

  if (name === 'BestimDashboard')
    return card(
      <FlexWidget style={{ flexDirection: 'row', flex: 1, width: 'match_parent', alignItems: 'center' }}>
        <FlexWidget style={{ width: 108, alignItems: 'center', justifyContent: 'center' }}>
          <OverlapWidget style={{ width: 76, height: 76 }}>
            {ring(car.health, 76)}
            <FlexWidget style={{ width: 'match_parent', height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>{t(String(car.health ?? '–'), 22, '700')}</FlexWidget>
          </OverlapWidget>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
            {t(car.name, 12, '700')}
            {switcher(st)}
          </FlexWidget>
          {t(`${fmt(car.km)} ${car.unit}`, 11, '400', C.muted)}
        </FlexWidget>
        <FlexWidget style={{ flex: 1, justifyContent: 'center' }}>
          {car.parts.length === 0 && t(flash, 13, '700')}
          {car.parts.slice(0, 3).map((x, i) => (
            <FlexWidget key={x.id} style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', backgroundColor: C.chip, borderRadius: 18, paddingVertical: 4, paddingHorizontal: 8, marginVertical: 3 }} {...link(partUrl(x.id))}>
              {partPics[i] ? <ImageWidget image={partPics[i] as `data:image${string}`} imageWidth={26} imageHeight={26} /> : <FlexWidget style={{ width: 26, height: 26 }} />}
              <FlexWidget style={{ flex: 1, paddingHorizontal: 8 }}>
                {t(x.name, 12, '700')}
                {t(left(st, car, x), 10, '400', C.muted)}
              </FlexWidget>
              <FlexWidget {...act(tap('DONE', { id: x.id }), partUrl(x.id))}>{icon(ICON.check, DOT[x.state], 26)}</FlexWidget>
            </FlexWidget>
          ))}
        </FlexWidget>
      </FlexWidget>,
      kmUrl,
      { padding: 14 },
    );

  const tile = (d: string, label: string, uri: string, primary: boolean) => (
    <FlexWidget style={{ flex: 1, height: 'match_parent', borderRadius: 24, backgroundColor: primary ? C.lime : C.chip, alignItems: 'center', justifyContent: 'center', marginHorizontal: 5 }} {...link(uri)}>
      {icon(d, C.ink, 34)}
      {t(label, 15, '700')}
    </FlexWidget>
  );
  const row = (a: React.ReactNode, b: React.ReactNode) => <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'row', marginVertical: 5 }}>{a}{b}</FlexWidget>;
  return card(
    <>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        {carPic && <ImageWidget image={carPic as `data:image${string}`} imageWidth={80} imageHeight={40} />}
        <FlexWidget style={{ flex: 1, paddingHorizontal: 10 }}>
          {t(car.name, 17, '800')}
          {t(s.quick, 12, '400', C.muted)}
        </FlexWidget>
        {switcher(st)}
      </FlexWidget>
      {row(tile(ICON.mic, s.voice, 'bestim://capture/voice', true), tile(ICON.camera, s.scan, kmUrl, false))}
      {row(tile(ICON.fuel, s.fuel, 'bestim://capture', false), tile(ICON.card, s.expense, 'bestim://expenses', false))}
      {t(`${car.ageLabel} · ${fmt(car.km)} ${car.unit}`, 11, '400', C.muted)}
    </>,
    kmUrl,
  );
}

async function render(name: Name) {
  const st = await readState();
  const car = st.cars[st.sel] ?? st.cars[0];
  return draw(name, st, await dataUri(car?.img ?? null), car ? await Promise.all(car.parts.map((x) => dataUri(x.img))) : []);
}

/** One server call through the limited widget key; true when the server answered {"ok": true}. */
async function call(st: State, car: WidgetCar, body: Record<string, unknown>) {
  if (!st.api) return false;
  try {
    const res = await fetch(st.api.url, {
      method: 'POST',
      headers: { apikey: st.api.anon, Authorization: `Bearer ${st.api.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: st.api.key, p_vehicle: car.id, ...body }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok && (await res.json())?.ok === true;
  } catch {
    return false;
  }
}

/** A button press: change the widget's own state, or save through the server, then write the file back. */
async function onClick(action: string, data: Record<string, unknown>) {
  const st = await readState();
  const car = st.cars[st.sel] ?? st.cars[0];
  if (!car) return;
  const setCar = (patch: Partial<WidgetCar>) => (st.cars[st.sel] = { ...car, ...patch });
  const finish = (ok: boolean, apply: () => void) => {
    st.pend = 0;
    st.flash = ok ? 'saved' : 'error';
    if (ok) apply();
  };
  if (action === 'SWITCH') {
    st.sel = (st.sel + (data.by as number) + st.cars.length) % st.cars.length;
    st.pend = 0;
    st.flash = null;
  } else if (action === 'ADD') {
    st.pend = Math.min((st.pend ?? 0) + (data.d as number), 5000);
    st.flash = null;
  } else if (action === 'SAVE') {
    const pend = st.pend ?? 0;
    const km = car.km + pend;
    finish(await call(st, car, { p_action: 'set_km', p_km: km }), () =>
      setCar({
        km,
        parts: car.parts.map((x) => {
          if (x.by !== 'km' || x.kmLeft == null) return x;
          const k = x.kmLeft - pend;
          return { ...x, kmLeft: k, state: k <= 0 ? 'overdue' : k <= st.soonKm ? 'soon' : 'ok' };
        }),
      }),
    );
  } else if (action === 'DONE' || action === 'SNOOZE') {
    const x = car.parts.find((y) => y.id === data.id);
    if (!x) return;
    finish(await call(st, car, { p_action: action === 'DONE' ? 'mark_done' : 'snooze', p_service: x.id, p_title: x.name }), () => setCar({ parts: car.parts.filter((y) => y.id !== x.id) }));
  }
  writeState(st);
}

registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && clickAction) {
    await onClick(clickAction, clickActionData ?? {});
    await refreshAndroidWidgets(); // the other widgets show the same car and numbers
    return;
  }
  renderWidget(await render(widgetInfo.widgetName as Name));
});

/** Redraw every placed widget from the latest file. */
export async function refreshAndroidWidgets() {
  await Promise.all(ANDROID_WIDGETS.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: () => render(widgetName) })));
}
