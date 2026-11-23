import { clean } from './numberInput.ts';
import type { VisitItem, VisitJob } from './saveVisit.ts';

// The one draft for a visit (flow 14): manual entry fills it, save_visit saves it. Pure helpers, so
// `node --experimental-strip-types src/lib/visitDraft.check.ts` runs them. (Voice review moves onto this draft later.)

export type DraftJob = {
  key: string;
  jobTypeId?: string;
  customName?: string;
  nameEn: string;
  nameAr: string;
  specialist: string;
  cost: string; // quick form: one total
  detailed: boolean; // "Add details" was used: labor / parts / consumables replace the single total
  labor: string;
  partsAmt: string;
  consumables: string;
  chosen: { id: string; name_en: string; name_ar: string }[]; // suggested items ticked in Details
};

// Arabic-Indic digits (٤٥٠) and ٫ are what an Arabic keyboard types: clean() turns them into a number, so a cost typed in Arabic digits is not read as 0.
export const num = (s: string) => {
  const v = clean(s, true);
  return v && !isNaN(Number(v)) ? Number(v) : 0;
};

// Quick form: "total paid" with an optional "of which labor" (the labor sits inside the total; a labor bigger than the total makes the total).
export const jobTotal = (j: DraftJob) => (j.detailed ? num(j.labor) + num(j.partsAmt) + num(j.consumables) : Math.max(num(j.cost), num(j.labor)));

/** save_visit wants exactly one labor line per job (0 allowed). A total-only job is labor 0 plus one "other" line holding the total (decision Q146). */
export function jobItems(j: DraftJob, arabic: boolean): VisitItem[] {
  const name = arabic ? j.nameAr : j.nameEn;
  if (!j.detailed) {
    const rest = jobTotal(j) - num(j.labor); // what was paid besides labor: parts and materials, one line named after the job
    return [{ type: 'labor', name: arabic ? 'مصنعية' : 'Labor', total: num(j.labor) }, ...(rest > 0 ? [{ type: 'other', name, total: rest }] : [])];
  }
  const items: VisitItem[] = [{ type: 'labor', name: arabic ? 'مصنعية' : 'Labor', total: num(j.labor) }];
  const rest = num(j.partsAmt); // the parts amount sits on the first ticked part (or one general line); the others are listed at 0
  if (j.chosen.length) j.chosen.forEach((c, i) => items.push({ type: 'part', catalog_item_id: c.id, name: arabic ? c.name_ar : c.name_en, total: i === 0 ? rest : 0 }));
  else if (rest > 0) items.push({ type: 'part', name: arabic ? 'قطع' : 'Parts', total: rest });
  if (num(j.consumables) > 0) items.push({ type: 'consumable', name: arabic ? 'مستهلكات' : 'Consumables', total: num(j.consumables) });
  return items;
}

export const buildJobs = (jobs: DraftJob[], arabic: boolean): VisitJob[] =>
  jobs.map((j) => ({
    specialist_key: j.specialist,
    ...(j.jobTypeId ? { job_type_id: j.jobTypeId } : { custom_name: j.customName ?? (arabic ? j.nameAr : j.nameEn) }),
    items: jobItems(j, arabic),
  }));
