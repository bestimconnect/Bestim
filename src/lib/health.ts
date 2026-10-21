import { lifeFraction } from './parts';
import type { Part } from './queries';

/** How much of a part's life is left, 0 to 1 (a late part is 0). Same figure the part rows show as a percentage. */
export const partLife = (p: Part) =>
  p.status.state === 'overdue' ? 0 : Math.min(1, Math.max(0, 1 - lifeFraction(p.status, p.log.interval_km ?? p.serviceType.default_interval_km).used));

/** The car's health score (0 to 100: the average life left of its tracked parts) and how many parts sit in each state. */
export function carHealth(parts: Part[]) {
  const late = parts.filter((p) => p.status.state === 'overdue').length;
  const soon = parts.filter((p) => p.status.state === 'soon').length;
  const score = parts.length ? Math.round((parts.reduce((s, p) => s + partLife(p), 0) / parts.length) * 100) : null;
  return { score, late, soon, ok: parts.length - late - soon };
}

export const STATE_COLOR = { ok: '#7DB317', soon: '#E8A317', overdue: '#E0455F' } as const;
