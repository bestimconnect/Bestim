// Picks the odometer reading out of everything the phone's text reader saw on a dashboard (decisions Q71, Q97).
// Pure (no RN imports) so `node --experimental-strip-types src/lib/odometerScan.check.ts` can run it.
//
// A dashboard is full of numbers: speed marks, RPM, temperature, the trip counter. What tells the odometer apart
// is the reading we already have: it can only be at or above it, and not absurdly far above it.
// A clear number outside that range is never taken silently: the scanner shows it and asks (decisions Q73).
//
// The text reader is a general one, so on segment and LCD digits it often sees look-alike letters ("1345S0",
// "O31308"), glues the unit on ("134550km") or splits the number ("134 550"). Each line is cleaned for that first.

const MAX_DIGITS = 7;

/** A number seen on the dashboard; `digits` counts leading zeros too ("000001" is a six-digit display). */
export type Seen = { value: number; digits: number; joined?: boolean };

// Letters a segment or LCD digit is often read as.
const LOOKALIKE: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', i: '1', Z: '2', z: '2', S: '5', s: '5', G: '6', b: '6', B: '8', g: '9', q: '9' };
const LOOKALIKE_WORD = /^[0-9OoDQIl|iZzSsGbBgq.,]+$/;

/** One line as a cleaner list of words: labels and units dropped, look-alike letters turned back into digits. */
export function cleanLine(raw: string): string {
  let line = raw
    .replace(/\b(?:ODO(?:METER)?|TOTAL|TOT)(?=[\s\d:.]|$)/gi, ' ') // labels next to the reading, even glued on
    .replace(/(\d)\s*(?:km|kms|mi|miles?|كم)(?![\p{L}/])/giu, '$1 '); // a unit glued on (not "km/h", a speed)
  line = line
    .split(/\s+/)
    .map((word) => {
      if (!LOOKALIKE_WORD.test(word)) return word;
      const digits = (word.match(/\d/g) ?? []).length;
      // Only a word that is mostly digits already: "1345S0" yes, "ODO" or "D3" (a gear) no.
      if (digits < 2 || digits * 2 < word.replace(/[.,]/g, '').length) return word;
      return word.replace(/[^\d.,]/g, (ch) => LOOKALIKE[ch] ?? ch);
    })
    .join(' ');
  return line;
}

/** Every whole number on the dashboard that could be a reading. */
export function candidates(lines: string[]): Seen[] {
  const out: Seen[] = [];
  for (const raw of lines) {
    // Mechanical wheels are often read as separate digits: "0 3 1 3 0 8". Only single digits are joined;
    // "100 120" stays two speed marks.
    const line = cleanLine(raw).replace(/(?<![\d.,])\d(?: \d){3,}(?![\d.,])/g, (m) => m.replace(/ /g, ''));
    const found: Seen[] = [];
    for (const m of line.matchAll(/\d[\d.,]*\d|\d/g)) {
      const before = line[m.index - 1] ?? ' ';
      const after = line[m.index + m[0].length] ?? ' ';
      if (/[\p{L}°%:/]/u.test(before) || /[\p{L}°%:/]/u.test(after)) continue; // "74°F", "x1000r/min", "12:45"
      let token = m[0];
      if (/^\d{1,3}([.,]\d{3})+$/.test(token)) token = token.replace(/[.,]/g, ''); // 20,000 / 20.000
      if (!/^\d+$/.test(token)) continue; // 412.6 is a trip counter
      if (token.length <= MAX_DIGITS) found.push({ value: Number(token), digits: token.length });
    }
    out.push(...found);
    // A reading split in two by the reader ("134 550"): offered joined too, but only on a short line (a speed scale
    // has many numbers) and only ever matched against the expected range, never offered on its own (`joined`).
    if (found.length >= 2 && found.length <= 3) {
      for (let i = 0; i + 1 < found.length; i++) {
        const [a, b] = [found[i], found[i + 1]];
        if (a.digits <= 3 && b.digits === 3) {
          const digits = a.digits + 3;
          if (digits <= MAX_DIGITS) out.push({ value: a.value * 1000 + b.value, digits, joined: true });
        }
      }
    }
  }
  return out;
}

/**
 * The reading, or null when nothing on the dashboard can be it.
 * `jump` = how far above the current reading is still believable (see `maxJump()`).
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
  const long = candidates(lines)
    .filter((s) => s.digits >= 4 && !s.joined)
    .sort((a, b) => b.digits - a.digits || b.value - a.value);
  return long.length ? long[0].value : null;
}

/** 1,000 km (24 h) a day since the last update, never less than 5,000 km (100 h): the same pace Q9 flags. */
export const maxJump = (unit: string, daysSinceUpdate: number) =>
  unit === 'h' ? Math.max(100, daysSinceUpdate * 24) : Math.max(5000, daysSinceUpdate * 1000);

export const SAMPLE_MS = 200; // the readers finish about five reads a second; faster samples are the same read again
export const KEEP = 6; // the last reads with a number that are combined
export const NEED = 3; // reads that must support a combined number
export const SETTLE_MS = 400;

/**
 * The number several reads agree on, digit by digit (decisions Q97). Segment and LCD digits flicker: one read says
 * 134559, the next 134550. Reads of the most common length are lined up and each position takes its most common
 * digit; the result counts when at least NEED reads are lined up and every position has a 2/3 majority.
 */
export function consensus(values: number[]): number | null {
  const byLength = new Map<number, string[]>();
  for (const v of values) {
    const s = String(v);
    byLength.set(s.length, [...(byLength.get(s.length) ?? []), s]);
  }
  const group = [...byLength.values()].sort((a, b) => b.length - a.length || b[0].length - a[0].length)[0];
  if (!group || group.length < NEED) return null;
  let out = '';
  for (let i = 0; i < group[0].length; i++) {
    const counts = new Map<string, number>();
    for (const s of group) counts.set(s[i], (counts.get(s[i]) ?? 0) + 1);
    const [digit, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n * 3 < group.length * 2) return null;
    out += digit;
  }
  return Number(out);
}

/** The recent reads with a number, oldest first; `last` = the previous sample (null when it had no number). */
export type Reads = { values: number[]; last: number | null; at: number };
export const NO_READS: Reads = { values: [], last: null, at: 0 };

/**
 * Whether the reads so far give a number (Q97). Sampled at most every SAMPLE_MS. Fast path: the same number twice
 * in a row, five digits or more, and believable (`fits`: at or just above the saved reading) counts at once.
 * Otherwise the digit-by-digit consensus of the last KEEP reads decides. Nothing counts for SETTLE_MS after the
 * camera starts looking again (`since`).
 */
export function decide(
  reads: Reads,
  reading: number | null,
  now: number,
  since: number,
  fits: (n: number) => boolean,
): { reads: Reads; accept: number | null } {
  if (now - since < SETTLE_MS) return { reads: { ...NO_READS, at: now }, accept: null };
  if (reads.at && now - reads.at < SAMPLE_MS) return { reads, accept: null };
  if (reading == null) return { reads: { ...reads, last: null, at: now }, accept: null };
  const values = [...reads.values, reading].slice(-KEEP);
  const next = { values, last: reading, at: now };
  if (reading === reads.last && String(reading).length >= 5 && fits(reading)) return { reads: next, accept: reading };
  return { reads: next, accept: consensus(values) };
}
