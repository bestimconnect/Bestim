import { TrustTag, type TrustKind } from '@/components/ui/TrustTag';

export type { TrustKind };
/** Moved to the design system (components/ui/TrustTag). */
export const Trust = TrustTag;

/** A log's trust label: a receipt photo beats self-logged (no workshop signing exists yet). */
export const trustOf = (l: { photos: string[] }): TrustKind => (l.photos.length ? 'receipt' : 'self');
