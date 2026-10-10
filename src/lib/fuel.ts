// Fuel consumption from a car's fuel expenses. Pure, so `node --experimental-strip-types src/lib/fuel.check.ts` can run it.

type Fill = { amount: number; liters: number | null; odometer_reading: number | null };
export type Figure = { kmPerLiter: number; costPerKm: number };

/**
 * Per pair of consecutive fill-ups (by reading): distance ÷ the later fill-up's litres, and its amount ÷ distance.
 * ponytail: assumes every fill-up fills the tank. Ceiling: a partial fill-up skews that one figure; the average smooths it.
 * Upgrade path: a "full tank" switch on the fuel form, and pairs count only between full tanks.
 */
export function consumption(fills: Fill[]): { latest: Figure; average: Figure; pairs: number } | null {
  const full = fills
    .filter((f): f is Fill & { liters: number; odometer_reading: number } => !!f.liters && f.liters > 0 && f.odometer_reading != null)
    .sort((a, b) => a.odometer_reading - b.odometer_reading);
  const figures: Figure[] = [];
  for (let i = 1; i < full.length; i++) {
    const km = full[i].odometer_reading - full[i - 1].odometer_reading;
    if (km > 0) figures.push({ kmPerLiter: km / full[i].liters, costPerKm: full[i].amount / km });
  }
  if (!figures.length) return null;
  const mean = (k: keyof Figure) => figures.reduce((s, f) => s + f[k], 0) / figures.length;
  return { latest: figures[figures.length - 1], average: { kmPerLiter: mean('kmPerLiter'), costPerKm: mean('costPerKm') }, pairs: figures.length };
}
