/**
 * CaseSummaryTile - Shows open/closed cases and role-aware "your turn" count.
 */

import { useMemo } from 'react';
import { BentoCard } from './BentoCard';
import type { CaseListItem } from '../../types/api';

const CLOSED_STATUSES = new Set(['OMFORENT', 'LUKKET', 'LUKKET_TRUKKET']);
const BH_PENDING_STATUSES = new Set(['SENDT', 'UNDER_BEHANDLING']);
const TE_PENDING_STATUSES = new Set(['VENTER_PAA_SVAR']);

interface CaseSummaryTileProps {
  cases: CaseListItem[];
  userRole: 'BH' | 'TE';
}

export function CaseSummaryTile({ cases, userRole }: CaseSummaryTileProps) {
  const stats = useMemo(() => {
    const pendingStatuses = userRole === 'BH' ? BH_PENDING_STATUSES : TE_PENDING_STATUSES;
    let open = 0;
    let closed = 0;
    let pending = 0;

    for (const c of cases) {
      const status = c.cached_status?.toUpperCase() ?? '';
      if (CLOSED_STATUSES.has(status)) {
        closed++;
      } else {
        open++;
        if (pendingStatuses.has(status)) {
          pending++;
        }
      }
    }

    return { open, closed, pending, total: cases.length };
  }, [cases, userRole]);

  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 md:col-span-4" delay={200}>
      <div className="p-5">
        <p className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-3">
          Saker
        </p>

        <div className="flex items-end gap-6">
          <div>
            <p className="text-3xl font-bold font-mono text-pkt-text-body-dark tabular-nums">
              {stats.open}
            </p>
            <p className="text-bento-body text-pkt-text-body-subtle">åpne</p>
          </div>
          <div>
            <p className="text-xl font-semibold font-mono text-pkt-text-body-subtle tabular-nums">
              {stats.closed}
            </p>
            <p className="text-bento-body text-pkt-text-body-subtle">lukket</p>
          </div>
        </div>

        {stats.pending > 0 && (
          <div className="mt-3 pt-3 border-t border-pkt-border-subtle">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pkt-brand-yellow-1000 animate-pulse" />
              <span className="text-bento-body font-medium text-pkt-text-body-default">
                {stats.pending} {stats.pending === 1 ? 'venter' : 'venter'} på{' '}
                {userRole === 'BH' ? 'ditt svar' : 'svar fra BH'}
              </span>
            </div>
          </div>
        )}
      </div>
    </BentoCard>
  );
}
