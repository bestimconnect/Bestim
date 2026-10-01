import { useTranslation } from 'react-i18next';

import { Metric } from '@/components/ui';
import type { PartStatus } from '@/lib/parts';

const n = (v: number) => Math.abs(Math.round(v)).toLocaleString('en-US');

/**
 * Lime "until the next change" card (screens 11 and 22). Overdue shows only the measure that is actually
 * past due; otherwise the distance left (and the days too when both are known, decisions Q10).
 */
export function PartMetric({ status, unit, label }: { status: PartStatus; unit: string; label: string }) {
  const { t } = useTranslation();
  const { remainingKm: km, remainingDays: days } = status;
  const [value, caption] =
    status.state === 'overdue'
      ? km != null && km <= 0
        ? [km, t('parts.overdue', { u: unit })]
        : [days!, t('parts.daysOverdue')]
      : km != null
        ? [km, days != null ? t('parts.leftBoth', { u: unit, d: n(days) }) : t('parts.left', { u: unit })]
        : [days!, t('parts.daysLeft')];
  return <Metric tone="lime" label={label} value={n(value)} caption={caption} />;
}
