import { Button, Gauge, HStack, Image, Link, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  aspectRatio, background, buttonStyle, clipShape, containerBackground, font, foregroundStyle, frame, gaugeStyle, lineLimit,
  minimumScaleFactor, padding, resizable, widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetCar, WidgetSnapshot } from '@/lib/widgetSnapshot';

// All six iOS widgets are one layout function: the widget runtime evaluates it on its own, so it cannot call
// helpers or read constants from this module, and (flattened to one line) it must contain no comments.
// `kind` (set by src/widgets/sync.ts) picks the widget, the family picks the size, and the `look` parameter
// (app.config.js, ios.configuration) picks light card or glass.
//
// Buttons work without opening the app: a button's onPress returns the widget's new props. For the ones that save
// (km, done, snooze) it also returns `__http`: the server call the patched button handler makes
// (patches/expo-widgets*.patch, WidgetHttp.swift), with the props to show if it worked (`onOk`) or not (`onFail`).
// `sel` = the car being shown, `pend` = km added on the widget but not saved yet, `flash` = last result.
type Props = WidgetSnapshot & {
  kind: 'BestimNext' | 'BestimKm' | 'BestimDashboard' | 'BestimQuick' | 'BestimSpend' | 'BestimLock';
  pend?: number;
  flash?: 'saved' | 'error' | ''; // never null: iOS cannot store null in a widget's props (the extension crashes)
};
type Env = WidgetEnvironment<{ look?: 'card' | 'glass' }>;

const render = (p: Props, env: Env) => {
  'widget';
  const glass = env.configuration?.look === 'glass';
  const dark = env.colorScheme === 'dark';
  const C = glass
    ? { ink: '#FFFFFF', muted: '#E6EEEA', chip: '#FFFFFF38', ring: '#D3F53D' }
    : dark
      ? { ink: '#F5F7F5', muted: '#9BAAA1', chip: '#2C3A32', ring: '#D3F53D' }
      : { ink: '#222E29', muted: '#5B6860', chip: '#F5F7F5', ring: '#08736F' };
  const LIME = '#D3F53D';
  const INK = '#222E29';
  const RED = '#F96A83';
  const DOT = { ok: '#5BBE7B', soon: '#FFC95C', overdue: '#F96A83' };
  const bg = glass
    ? { type: 'linearGradient' as const, colors: ['#0B6F6B', '#10201B'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }
    : dark
      ? '#1B2420'
      : '#FFFFFF';

  const s = p.s;
  const rtl = p.lang === 'ar';
  const cars = p.cars;
  const car = cars[p.sel] || cars[0];
  const pend = p.pend || 0;
  const fmt = (x: number) => Math.round(x).toLocaleString('en-US');
  const t = (text: string, size: number, weight: 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy', color: string, lines = 1) => (
    <Text modifiers={[font({ size, weight }), foregroundStyle(color), lineLimit(lines), minimumScaleFactor(0.6)]}>{text}</Text>
  );
  const pill = (text: string, size: number, color: string, fill: string, vertical: number) => (
    <Text modifiers={[font({ size, weight: 'bold' }), foregroundStyle(color), lineLimit(1), minimumScaleFactor(0.6), frame({ maxWidth: 1000 }), padding({ vertical }), background(fill), clipShape('capsule')]}>{text}</Text>
  );
  const pic = (uri: string | null, size: number, symbol: 'car.fill' | 'wrench.fill') =>
    uri ? (
      <Image uiImage={uri} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ width: size, height: size })]} />
    ) : (
      <Image systemName={symbol} size={size * 0.6} color={C.muted} />
    );
  const carUrl = (path: string) => 'bestim://' + path + (car ? '?vehicleId=' + encodeURIComponent(car.id) : '');
  const partUrl = (id: string) => 'bestim://part?vehicleId=' + encodeURIComponent(car.id) + '&serviceTypeId=' + encodeURIComponent(id);

  const press = (target: string, child: React.ReactElement, onPress: () => Record<string, unknown>, url: string) =>
    p.api ? (
      <Button target={target} onPress={onPress} modifiers={[buttonStyle('plain'), frame({ maxWidth: 1000 })]}>
        {child}
      </Button>
    ) : (
      <Link destination={url} modifiers={[frame({ maxWidth: 1000 })]}>
        {child}
      </Link>
    );
  const send = (body: Record<string, unknown>, ok: Record<string, unknown>) => ({
    url: p.api!.url,
    headers: { apikey: p.api!.anon, Authorization: 'Bearer ' + p.api!.anon, 'Content-Type': 'application/json' },
    body: Object.assign({ p_key: p.api!.key, p_vehicle: car.id }, body),
    onOk: Object.assign({ flash: 'saved', pend: 0 }, ok),
    onFail: { flash: 'error' },
  });
  const setCar = (patch: Partial<WidgetCar>) => cars.map((c, i) => (i === p.sel ? Object.assign({}, c, patch) : c));
  const bump = (d: number) =>
    car.parts.map((x) => {
      if (x.by !== 'km' || x.kmLeft == null) return x;
      const k = x.kmLeft - d;
      return Object.assign({}, x, { kmLeft: k, state: k <= 0 ? 'overdue' : k <= p.soonKm ? 'soon' : 'ok' });
    });
  const left = (x: WidgetCar['parts'][number]) => {
    const useKm = x.by === 'km' && x.kmLeft != null;
    const v = useKm ? (x.kmLeft as number) : x.daysLeft == null ? 0 : x.daysLeft;
    const u = useKm ? car.unit : s.days;
    if (v <= 0) return rtl ? s.late + ' ' + fmt(-v) + ' ' + u : fmt(-v) + ' ' + u + ' ' + s.late;
    return rtl ? s.left + ' ' + fmt(v) + ' ' + u : fmt(v) + ' ' + u + ' ' + s.left;
  };
  const done = (x: WidgetCar['parts'][number], action: 'mark_done' | 'snooze') => ({
    pend: 0,
    flash: '',
    __http: send({ p_action: action, p_service: x.id, p_title: x.name }, { cars: setCar({ parts: car.parts.filter((y) => y.id !== x.id) }) }),
  });
  const flashText = () => (p.flash === 'saved' ? s.saved : p.flash === 'error' ? s.offline : car ? car.ageLabel : '');
  const switcher = () =>
    cars.length > 1 ? (
      <HStack spacing={2}>
        <Button target="prev" onPress={() => ({ sel: (p.sel + cars.length - 1) % cars.length, pend: 0, flash: '' })} modifiers={[buttonStyle('plain')]}>
          <Image systemName="chevron.left" size={12} color={C.muted} />
        </Button>
        <Button target="next" onPress={() => ({ sel: (p.sel + 1) % cars.length, pend: 0, flash: '' })} modifiers={[buttonStyle('plain')]}>
          <Image systemName="chevron.right" size={12} color={C.muted} />
        </Button>
      </HStack>
    ) : (
      <Spacer />
    );

  if (!car) {
    return (
      <VStack spacing={6} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000 }), containerBackground(bg, 'widget'), widgetURL('bestim://')]}>
        <Image systemName="car.fill" size={30} color={C.muted} />
        {t(s.open, 15, 'bold', C.ink)}
      </VStack>
    );
  }

  const top = car.parts[0];
  const family = env.widgetFamily;
  const km = fmt(car.km);

  if (family === 'accessoryCircular')
    return (
      <Gauge value={(car.health ?? 0) / 100} modifiers={[gaugeStyle('circularCapacity'), widgetURL(top ? partUrl(top.id) : carUrl('update-odometer'))]} currentValueLabel={<Text>{String(car.health ?? '–')}</Text>}>
        <Text>♥</Text>
      </Gauge>
    );
  if (family === 'accessoryRectangular')
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL(top ? partUrl(top.id) : carUrl('update-odometer'))]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>{top ? top.name : s.allOk}</Text>
        <Text modifiers={[font({ size: 12 })]}>{top ? left(top) : km + ' ' + car.unit}</Text>
      </VStack>
    );
  if (family === 'accessoryInline') return <Text modifiers={[widgetURL(top ? partUrl(top.id) : carUrl('update-odometer'))]}>{top ? top.name + ' · ' + left(top) : km + ' ' + car.unit}</Text>;

  if (p.kind === 'BestimNext')
    return (
      <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' }), containerBackground(bg, 'widget'), widgetURL(top ? partUrl(top.id) : carUrl('update-odometer'))]}>
        <HStack>
          {t(s.next, 11, 'semibold', C.muted)}
          <Spacer />
          {switcher()}
        </HStack>
        <HStack spacing={8}>
          <ZStack modifiers={[frame({ width: 46, height: 46 }), background(C.chip), clipShape('circle')]}>{pic(top ? top.img : car.img, 34, 'wrench.fill')}</ZStack>
          <VStack alignment="leading" spacing={1}>
            {t(top ? top.name : s.allOk, 15, 'heavy', C.ink, 2)}
            <HStack spacing={5}>
              <Rectangle modifiers={[frame({ width: 8, height: 8 }), foregroundStyle(top ? DOT[top.state] : DOT.ok), clipShape('circle')]} />
              {t(top ? left(top) : car.name, 11, 'medium', C.ink)}
            </HStack>
          </VStack>
          <Spacer />
        </HStack>
        <Spacer />
        {top ? (
          <HStack spacing={6}>
            {press('done', pill(s.done, 12, INK, LIME, 7), () => done(top, 'mark_done'), partUrl(top.id))}
            {press('snooze', pill(s.snooze, 11, C.ink, C.chip, 7), () => done(top, 'snooze'), partUrl(top.id))}
          </HStack>
        ) : (
          t(flashText(), 11, 'regular', p.flash === 'error' ? RED : C.muted)
        )}
      </VStack>
    );

  if (p.kind === 'BestimKm')
    return (
      <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' }), containerBackground(bg, 'widget'), widgetURL(carUrl('update-odometer'))]}>
        <HStack>
          {t(s.odometer + ' ' + car.name, 11, 'semibold', C.muted)}
          <Spacer />
          {switcher()}
        </HStack>
        {t(fmt(car.km + pend), 30, 'bold', pend > 0 ? C.ring : C.ink)}
        {t(p.flash === 'error' ? s.offline : p.flash === 'saved' ? s.saved : pend > 0 ? '+' + fmt(pend) + ' ' + car.unit : car.unit + ' · ' + car.ageLabel, 11, 'regular', p.flash === 'error' ? RED : C.muted)}
        <Spacer />
        <HStack spacing={4}>
          {[10, 50, 100].map((d) => press('add' + d, pill('+' + d, 12, C.ink, C.chip, 6), () => ({ pend: Math.min(pend + d, 5000), flash: '' }), carUrl('update-odometer')))}
        </HStack>
        {pend > 0
          ? press('save', pill(s.save + ' ' + fmt(car.km + pend), 13, INK, LIME, 8), () => ({ pend: 0, flash: '', __http: send({ p_action: 'set_km', p_km: car.km + pend }, { cars: setCar({ km: car.km + pend, parts: bump(pend) }) }) }), carUrl('update-odometer'))
          : press('edit', pill(s.edit, 12, C.ink, C.chip, 8), () => ({ pend: 0 }), carUrl('update-odometer'))}
      </VStack>
    );

  if (p.kind === 'BestimSpend') {
    const sp = car.spend;
    const bar = (share: number, color: string) => <Rectangle modifiers={[frame({ width: Math.max(share, 0.02) * 116, height: 10 }), foregroundStyle(color), clipShape('capsule')]} />;
    return (
      <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' }), containerBackground(bg, 'widget'), widgetURL('bestim://expenses')]}>
        <HStack>
          {t(sp.label, 11, 'semibold', C.muted)}
          <Spacer />
          {switcher()}
        </HStack>
        {t(sp.total, 32, 'bold', C.ink)}
        {t(sp.currency, 12, 'regular', C.muted)}
        <Spacer />
        <HStack spacing={2}>
          {bar(sp.fuel, C.ring)}
          {bar(sp.maintenance, '#FFC95C')}
          {bar(sp.other, RED)}
        </HStack>
        <HStack>
          {t(s.fuelOther, 10, 'regular', C.muted)}
          <Spacer />
          {t(s.maint, 10, 'regular', C.muted)}
          <Spacer />
          {t(s.other, 10, 'regular', C.muted)}
        </HStack>
      </VStack>
    );
  }

  if (p.kind === 'BestimDashboard')
    return (
      <HStack spacing={12} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000 }), containerBackground(bg, 'widget'), widgetURL(carUrl('update-odometer'))]}>
        <VStack spacing={3} modifiers={[frame({ width: 104 })]}>
          <Gauge value={car.health ?? 0} min={0} max={100} modifiers={[gaugeStyle('circularCapacity'), foregroundStyle(C.ring), frame({ width: 76, height: 76 })]} currentValueLabel={t(String(car.health ?? '–'), 22, 'bold', C.ink)}>
            <Text>{s.health}</Text>
          </Gauge>
          <HStack spacing={2}>
            {t(car.name, 12, 'bold', C.ink)}
            {switcher()}
          </HStack>
          {t(km + ' ' + car.unit, 11, 'regular', C.muted)}
        </VStack>
        <VStack spacing={5}>
          {car.parts.length === 0 && t(flashText(), 13, 'bold', C.ink)}
          {car.parts.slice(0, 3).map((x) => (
            <HStack key={x.id} spacing={6} modifiers={[padding({ horizontal: 8, vertical: 4 }), frame({ maxWidth: 1000 }), background(C.chip), clipShape('capsule')]}>
              {pic(x.img, 26, 'wrench.fill')}
              <VStack alignment="leading" spacing={0}>
                {t(x.name, 12, 'bold', C.ink)}
                {t(left(x), 10, 'regular', C.muted)}
              </VStack>
              <Spacer />
              {press(
                'done' + x.id,
                <Image systemName="checkmark.circle.fill" size={24} color={x.state === 'ok' ? DOT.ok : x.state === 'soon' ? DOT.soon : DOT.overdue} />,
                () => done(x, 'mark_done'),
                partUrl(x.id),
              )}
            </HStack>
          ))}
        </VStack>
      </HStack>
    );

  const tile = (symbol: 'mic.fill' | 'camera.fill' | 'fuelpump.fill' | 'creditcard.fill', label: string, link: string, primary: boolean) => (
    <Link destination={link} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000 })]}>
      <VStack spacing={8} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000 }), background(primary ? LIME : C.chip), clipShape('roundedRectangle', 22)]}>
        <Image systemName={symbol} size={34} color={primary ? INK : C.ink} />
        {t(label, 15, 'bold', primary ? INK : C.ink)}
      </VStack>
    </Link>
  );
  return (
    <VStack spacing={10} modifiers={[frame({ maxWidth: 1000, maxHeight: 1000 }), containerBackground(bg, 'widget'), widgetURL(carUrl('update-odometer'))]}>
      <HStack spacing={10}>
        {pic(car.img, 64, 'car.fill')}
        <VStack alignment="leading" spacing={0}>
          {t(car.name, 17, 'heavy', C.ink)}
          {t(s.quick, 12, 'regular', C.muted)}
        </VStack>
        <Spacer />
        {switcher()}
      </HStack>
      <HStack spacing={10}>
        {tile('mic.fill', s.voice, 'bestim://capture/voice', true)}
        {tile('camera.fill', s.scan, carUrl('update-odometer'), false)}
      </HStack>
      <HStack spacing={10}>
        {tile('fuelpump.fill', s.fuel, 'bestim://capture', false)}
        {tile('creditcard.fill', s.expense, 'bestim://expenses', false)}
      </HStack>
      {t(car.ageLabel + ' · ' + km + ' ' + car.unit, 11, 'regular', C.muted)}
    </VStack>
  );
};

// Names must match the `widgets` list in app.config.js.
export const BestimNext = createWidget<Props, { look?: 'card' | 'glass' }>('BestimNext', render);
export const BestimKm = createWidget<Props, { look?: 'card' | 'glass' }>('BestimKm', render);
export const BestimDashboard = createWidget<Props, { look?: 'card' | 'glass' }>('BestimDashboard', render);
export const BestimQuick = createWidget<Props, { look?: 'card' | 'glass' }>('BestimQuick', render);
export const BestimSpend = createWidget<Props, { look?: 'card' | 'glass' }>('BestimSpend', render);
export const BestimLock = createWidget<Props, { look?: 'card' | 'glass' }>('BestimLock', render);
