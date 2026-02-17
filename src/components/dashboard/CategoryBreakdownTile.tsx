/**
 * CategoryBreakdownTile - Horizontal bar breakdown of cases by underkategori.
 * Shows the legal basis (hjemmel) for each category.
 */

import { useMemo } from 'react';
import { BentoCard } from './BentoCard';
import type { CaseListItem } from '../../types/api';
import { getUnderkategoriObj } from '../../constants/categories';

const BAR_COLORS = [
  'bg-pkt-brand-blue-1000',
  'bg-pkt-brand-warm-blue-1000',
  'bg-pkt-brand-yellow-1000',
  'bg-pkt-brand-dark-green-1000',
  'bg-pkt-grays-gray-400',
  'bg-pkt-brand-red-1000',
  'bg-pkt-brand-green-1000',
  'bg-pkt-brand-light-green-1000',
];

interface CategoryGroup {
  label: string;
  count: number;
  pct: number;
  color: string;
}

function getUnderkategoriDisplayLabel(code: string): string {
  const obj = getUnderkategoriObj(code);
  if (obj) return `${obj.label} (§${obj.hjemmel_basis})`;
  return code;
}

interface CategoryBreakdownTileProps {
  cases: CaseListItem[];
}

export function CategoryBreakdownTile({ cases }: CategoryBreakdownTileProps) {
  const categories = useMemo((): CategoryGroup[] => {
    const counts = new Map<string, number>();
    for (const c of cases) {
      const cat = c.cached_underkategori || 'Ikke kategorisert';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }

    const total = cases.length || 1;
    return Array.from(counts.entries())
      .map(([code, count], i) => ({
        label: code === 'Ikke kategorisert' ? code : getUnderkategoriDisplayLabel(code),
        count,
        pct: Math.round((count / total) * 100),
        color: BAR_COLORS[i % BAR_COLORS.length]!,
      }))
      .sort((a, b) => b.count - a.count);
  }, [cases]);

  if (categories.length === 0) {
    return (
      <BentoCard colSpan="col-span-12 lg:col-span-7" delay={350}>
        <div className="p-4 flex items-center justify-center min-h-[100px]">
          <p className="text-bento-body text-pkt-text-body-subtle">Ingen saker å kategorisere</p>
        </div>
      </BentoCard>
    );
  }

  const maxCount = categories[0]?.count ?? 1;

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-7" delay={350}>
      <div className="p-4">
        <p className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-3">
          Kategorier
        </p>

        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.label} className="flex items-center gap-3">
              <span className="text-bento-body text-pkt-text-body-default w-48 truncate shrink-0" title={cat.label}>
                {cat.label}
              </span>
              <div className="flex-1 h-4 bg-pkt-grays-gray-100 dark:bg-white/10 rounded-sm overflow-hidden">
                <div
                  className={`h-full ${cat.color} rounded-sm transition-all duration-700`}
                  style={{ width: `${(cat.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-bento-body font-mono text-pkt-text-body-subtle tabular-nums w-8 text-right shrink-0">
                {cat.count}
              </span>
              <span className="text-bento-label text-pkt-text-body-subtle tabular-nums w-8 text-right shrink-0">
                {cat.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </BentoCard>
  );
}
