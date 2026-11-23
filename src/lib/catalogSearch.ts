import { fold } from './search.ts';

// Local catalog search (flow 14): pure, so `node --experimental-strip-types src/lib/catalogSearch.check.ts` runs it.
// Every word of the query must appear in the job's or part's names or aliases (Arabic spelling variants folded, like search_catalog on the server).
// Ranking: exact name/alias, then name/alias starting with the word, then due now on this car, then the user's recents, then jobs before parts, then A-Z.

export type CatalogJob = { id: string; name_en: string; name_ar: string; aliases: string[]; specialist_key: string; system_id: number | null; suggested_items: string[]; tracked: boolean; fuel_types: string[] | null };
export type CatalogPart = { id: string; name_en: string; name_ar: string; aliases: string[]; system_id: number | null; item_type: string; fuel_types: string[] | null };
export type Hit = { kind: 'job'; row: CatalogJob; alias?: string } | { kind: 'item'; row: CatalogPart; alias?: string };

export type Boost = { due?: Set<string>; recent?: Map<string, number> };

const labels = (r: { name_en: string; name_ar: string; aliases: string[] }) => [r.name_ar, r.name_en, ...r.aliases];
const words = (q: string) => q.split(/\s+/).map(fold).filter(Boolean);

export function searchCatalog(q: string, jobs: CatalogJob[], parts: CatalogPart[], fuel?: string | null, boost: Boost = {}, limit = 30): Hit[] {
  const w = words(q);
  if (!w.length) return [];
  const ok = (r: { fuel_types: string[] | null }) => !fuel || !r.fuel_types || r.fuel_types.includes(fuel);
  const scored: { hit: Hit; score: number; name: string }[] = [];
  const consider = (hit: Hit) => {
    const r = hit.row;
    const folded = labels(r).map(fold);
    const all = folded.join(' ');
    if (!w.every((x) => all.includes(x))) return;
    const alias = r.aliases.find((a) => w.some((x) => fold(a).includes(x) && !fold(r.name_ar).includes(x) && !fold(r.name_en).includes(x)));
    const exact = folded.some((f) => f === w.join(''));
    const starts = folded.some((f) => f.startsWith(w[0]));
    const score = (exact ? 100 : 0) + (starts ? 50 : 0) + (boost.due?.has(r.id) ? 20 : 0) + Math.min(boost.recent?.get(r.id) ?? 0, 10) + (hit.kind === 'job' ? 5 : 0);
    scored.push({ hit: { ...hit, alias } as Hit, score, name: r.name_en });
  };
  for (const j of jobs) if (ok(j)) consider({ kind: 'job', row: j });
  for (const p of parts) if (ok(p)) consider({ kind: 'item', row: p });
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit).map((s) => s.hit);
}
