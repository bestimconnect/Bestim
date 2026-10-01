// Mock of the partner's `process-voice-log` Edge Function (spec §8). Swap point: capture/voice.tsx.
// Pure (no RN imports) so `node --experimental-strip-types src/lib/voice.check.ts` can run it.
// ponytail: keyword + number heuristics, good enough to demo the flow; the real parser is the partner's LLM function.

export type VoiceQuestion = { kind: 'interval_or_product'; value: number; phrase: string };

export type VoiceResult = {
  service_type: string | null; // service_types.name_en
  parts: { name: string }[];
  cost: number | null;
  odometer: number | null;
  notes: string | null;
  needs_clarification: boolean;
  questions: VoiceQuestion[];
};

// Most specific first: "oil filter" must win over "oil".
const SERVICE_KEYWORDS: [string, string[]][] = [
  ['Oil Filter', ['فلتر الزيت', 'فلتر زيت', 'oil filter']],
  ['Air Filter', ['فلتر الهواء', 'فلتر هواء', 'فلتر المكيف', 'air filter']],
  ['Brake Inspection', ['فحص الفرامل', 'brake inspection', 'brake check']],
  ['Brake Pad Replacement', ['تيل', 'فرامل', 'brake']],
  ['Tire Rotation', ['تبديل الإطارات', 'rotation']],
  ['Tire Replacement', ['إطار', 'اطار', 'كاوتش', 'tire', 'tyre']],
  ['Battery Replacement', ['بطارية', 'battery']],
  ['Coolant Check', ['تبريد', 'ردياتير', 'coolant']],
  ['Spark Plug Replacement', ['بوجيه', 'شمعات', 'spark']],
  ['Transmission Check', ['فتيس', 'ناقل الحركة', 'transmission', 'gearbox']],
  ['Car Wash', ['غسيل', 'wash']],
  ['Wiper Replacement', ['مساحات', 'wiper']],
  ['Oil Change', ['زيت', 'oil']],
  ['Full Inspection', ['فحص', 'inspection', 'checkup']],
];

const BRANDS = ['موبيل', 'mobil', 'شل', 'shell', 'كاسترول', 'castrol', 'توتال', 'total', 'فالفولين', 'valvoline'];
const THOUSAND = /^(ألف|الف|آلاف|الاف|ألاف|k|thousand)$/i;
const CURRENCY = /^(جنيه|جنية|جنيهات|ج\.?م?|pounds?|egp|le)$/i;
const ODO_BEFORE = /^(عند|على|عداد|العداد|at|odometer|mileage)$/i;
const ODO_AFTER = /^(كم|كيلو|km|kilometers?|ساعة|ساعات|hours?)$/i;

const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
// Arabic joins "و" (and) / "ب" (for) onto the next word: "و1200", "بـ1200".
const stripPrefix = (w: string) => w.replace(/^(وبـ|وب|بـ|و|ب)(?=\d)/, '');

export function parseTranscript(transcript: string): VoiceResult {
  const text = toLatinDigits(transcript).replace(/(\d)[,٬](\d{3})/g, '$1$2').replace(/[«»"،,.؟?!]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).map(stripPrefix);
  const lower = text.toLowerCase();

  const service_type = SERVICE_KEYWORDS.find(([, kws]) => kws.some((k) => lower.includes(k)))?.[0] ?? null;
  const brand = words.find((w) => BRANDS.includes(w.toLowerCase())) ?? null;

  let cost: number | null = null;
  let odometer: number | null = null;
  const questions: VoiceQuestion[] = [];

  for (let i = 0; i < words.length; i++) {
    const m = words[i].match(/^(\d+(?:\.\d+)?)(k)?$/i);
    if (!m) continue;
    let value = Number(m[1]);
    let next = i + 1;
    if (m[2] || THOUSAND.test(words[next] ?? '')) {
      value *= 1000;
      if (!m[2]) next++;
    }
    const prev = words[i - 1] ?? '';
    const after = words[next] ?? '';

    if (CURRENCY.test(after)) cost ??= value;
    else if (ODO_BEFORE.test(prev) || ODO_AFTER.test(after)) odometer ??= value;
    else if (brand && prev.toLowerCase() === brand.toLowerCase() && value >= 1000 && value <= 50000)
      questions.push({ kind: 'interval_or_product', value, phrase: `${brand} ${words.slice(i, next).join(' ')}` });
    else if (value >= 1000 && odometer == null) odometer = value;
    else cost ??= value;
  }

  return {
    service_type,
    parts: brand ? [{ name: brand }] : [],
    cost,
    odometer,
    notes: null,
    needs_clarification: questions.length > 0,
    questions: questions.slice(0, 1), // decisions.md Q18: at most one question per log
  };
}
