/**
 * RecentActivityTile - Horizontal strip showing recently active cases.
 * Designed as a thin col-span-12 row with compact activity cards in a grid.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BentoCard } from './BentoCard';
import type { CaseListItem } from '../../types/api';

const MAX_ITEMS = 5;

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Nå';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}t`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'I går';
    if (diffD < 7) return `${diffD}d`;
    const diffW = Math.floor(diffD / 7);
    if (diffW < 5) return `${diffW}u`;
    return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function formatSakIdShort(sakId: string, sakstype: string): string {
  if (sakstype === 'standard' && sakId.startsWith('SAK-')) {
    return 'KOE-' + sakId.slice(4);
  }
  if (sakstype === 'forsering' && sakId.startsWith('Forsering-')) {
    return 'FORS-' + sakId.slice(10);
  }
  return sakId;
}

function getCaseRoute(item: CaseListItem): string {
  switch (item.sakstype) {
    case 'forsering':
      return `/forsering/${item.sak_id}`;
    case 'endringsordre':
      return `/endringsordre/${item.sak_id}`;
    default:
      return `/saker/${item.sak_id}`;
  }
}

const TYPE_DOT_COLORS: Record<string, string> = {
  standard: 'bg-pkt-brand-warm-blue-1000',
  endringsordre: 'bg-emerald-500',
  forsering: 'bg-pkt-brand-yellow-1000',
};

interface RecentActivityTileProps {
  cases: CaseListItem[];
}

export function RecentActivityTile({ cases }: RecentActivityTileProps) {
  const navigate = useNavigate();

  const recentCases = useMemo(() => {
    return [...cases]
      .filter(c => c.last_event_at)
      .sort((a, b) => (b.last_event_at ?? '').localeCompare(a.last_event_at ?? ''))
      .slice(0, MAX_ITEMS);
  }, [cases]);

  if (recentCases.length === 0) return null;

  return (
    <BentoCard colSpan="col-span-12" delay={150}>
      <div className="px-5 py-3">
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide shrink-0">
            Siste aktivitet
          </p>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {recentCases.map((item) => (
              <div
                key={item.sak_id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-pkt-bg-subtle/60 transition-colors min-w-0"
                role="link"
                tabIndex={0}
                onClick={() => navigate(getCaseRoute(item))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(getCaseRoute(item));
                  }
                }}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT_COLORS[item.sakstype] ?? 'bg-pkt-grays-gray-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[11px] font-semibold text-pkt-text-body-dark shrink-0">
                      {formatSakIdShort(item.sak_id, item.sakstype)}
                    </span>
                    <span className="text-[10px] text-pkt-text-body-subtle shrink-0">
                      {formatRelativeTime(item.last_event_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-pkt-text-body-subtle truncate">
                    {item.cached_title || 'Uten tittel'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
