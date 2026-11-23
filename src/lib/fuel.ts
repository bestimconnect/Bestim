// Fuel consumption from a car's fuel expenses. Pure, so `node --experimental-strip-types src/lib/fuel.check.ts` can run it.

type Fill = { id?: string; amount: number; liters: number | null; odometer_reading: number | null; full_tank?: boolean | null };
export type Figure = { kmPerLiter: number; lPer100: number; costPerKm: number };

/**
 * Measured between full tanks only: the distance from one full tank to the next ÷ every litre put in after the first
 * (partial fill-ups included), and the money spent on those litres ÷ that distance. `byFill` keys each figure by the
 * full tank that closed it, for the Car log. A fill-up with no `full_tank` value counts as full (rows saved before the switch).
 */
export function consumption(fills: Fill[]): { latest: Figure; average: Figure; pairs: number; byFill: Map<string, Figure> } | null {
  const counted = fills
    .filter((f): f is Fill & { liters: number; odometer_reading: number } => !!f.liters && f.liters > 0 && f.odometer_reading != null)
    .sort((a, b) => a.odometer_reading - b.odometer_reading);
  const figures: Figure[] = [];
  const byFill = new Map<string, Figure>();
  let start: number | null = null; // reading at the last full tank
  let liters = 0;
  let amount = 0;
  for (const f of counted) {
    const full = f.full_tank !== false;
    if (start != null) {
      liters += f.liters;
      amount += f.amount;
    }
    if (!full) continue;
    const km = start != null ? f.odometer_reading - start : 0;
    if (km > 0) {
      const figure = { kmPerLiter: km / liters, lPer100: (liters / km) * 100, costPerKm: amount / km };
      figures.push(figure);
      if (f.id) byFill.set(f.id, figure);
    }
    start = f.odometer_reading;
    liters = 0;
    amount = 0;
  }
  if (!figures.length) return null;
  const mean = (k: keyof Figure) => figures.reduce((s, f) => s + f[k], 0) / figures.length;
  return { latest: figures[figures.length - 1], average: { kmPerLiter: mean('kmPerLiter'), lPer100: mean('lPer100'), costPerKm: mean('costPerKm') }, pairs: figures.length, byFill };
}

/** Why `consumption` has no figure yet, so the card can say what to add: no fill-ups, litres missing, odometer reading missing, or fewer than two usable full tanks. */
export function fuelGap(fills: Fill[]): 'noFills' | 'noLiters' | 'noReading' | 'needMore' {
  if (!fills.length) return 'noFills';
  if (!fills.some((f) => !!f.liters && f.liters > 0)) return 'noLiters';
  if (!fills.some((f) => !!f.liters && f.liters > 0 && f.odometer_reading != null)) return 'noReading';
  return 'needMore';
}
