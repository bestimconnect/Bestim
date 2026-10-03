// Picks the odometer reading out of everything the phone's text reader saw on a dashboard (decisions Q71).
// Pure (no RN imports) so `node --experimental-strip-types src/lib/odometerScan.check.ts` can run it.
//
// A dashboard is full of numbers: speed marks, RPM, temperature, the trip counter. What tells the odometer apart
// is the reading we already have: it can only be at or above it, and not absurdly far above it.
// A clear number outside that range is never taken silently: the scanner shows it and asks (decisions Q73).
// ponytail: digital segment displays are the weak spot of on-device reading. Upgrade path: send the picture to Gemini.

const MAX_DIGITS = 7;

/** A number seen on the dashboard; `digits` counts leading zeros too ("000001" is a six-digit display). */
export type Seen = { value: number; digits: number };

/** Every whole number on the dashboard that could be a reading. */
export function candidates(lines: string[]): Seen[] {
  const out: Seen[] = [];
  for (const raw of lines) {
    // Mechanical wheels are often read as separate digits: "0 3 1 3 0 8". Only single digits are joined;
    // "100 120" stays two speed marks.
    const line = raw.replace(/(?<![\d.,])\d(?: \d){3,}(?![\d.,])/g, (m) => m.replace(/ /g, ''));
    for (const m of line.matchAll(/\d[\d.,]*\d|\d/g)) {
      const before = line[m.index - 1] ?? ' ';
      const after = line[m.index + m[0].length] ?? ' ';
      if (/[\p{L}°%:/]/u.test(before) || /[\p{L}°%:/]/u.test(after)) continue; // "74°F", "x1000r/min", "12:45"
      let token = m[0];
      if (/^\d{1,3}([.,]\d{3})+$/.test(token)) token = token.replace(/[.,]/g, ''); // 20,000 / 20.000
      if (!/^\d+$/.test(token)) continue; // 412.6 is a trip counter
      if (token.length <= MAX_DIGITS) out.push({ value: Number(token), digits: token.length });
    }
  }
  return out;
}

/**
 * The reading, or null when nothing on the dashboard can be it.
 * `maxJump` = how far above the current reading is still believable (see `maxJump()`).
 */
export function pickReading(lines: string[], current: number, jump: number): number | null {
  const fits = candidates(lines).map((s) => s.value).filter((n) => n >= current && n <= current + jump);
  return fits.length ? Math.min(...fits) : null;
}

/**
 * When nothing fits: the number that still looks like an odometer display (the longest one, four digits or more),
 * for the scanner to offer instead of ignoring. Lower than the saved reading, or far above it.
 */
export function pickOutlier(lines: string[]): number | null {
  const long = candidates(lines).filter((s) => s.digits >= 4).sort((a, b) => b.digits - a.digits || b.value - a.value);
  return long.length ? long[0].value : null;
}

/** 1,000 km (24 h) a day since the last update, never less than 5,000 km (100 h): the same pace Q9 flags. */
export const maxJump = (unit: string, daysSinceUpdate: number) =>
  unit === 'h' ? Math.max(100, daysSinceUpdate * 24) : Math.max(5000, daysSinceUpdate * 1000);
