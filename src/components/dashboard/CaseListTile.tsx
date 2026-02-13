/**
 * CaseListTile - Lightweight case list integrated into the bento grid.
 *
 * Features:
 * - Compact/expanded mode toggle (both have toolbar)
 * - Sak-ID with type prefix (KOE-, EO-, FORS-) merged with title
 * - Status column
 * - Grouped with "show more" truncation (5 per group)
 * - Ascending/descending sort toggle
 * - Borderless rows with subtle dividers
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Input,
} from '../primitives';
import { BentoCard } from './BentoCard';
import type { CaseListItem } from '../../types/api';
import type { OverordnetStatus } from '../../types/timeline';
import { getOverordnetStatusLabel } from '../../constants/statusLabels';
import { getOverordnetStatusStyle } from '../../constants/statusStyles';
import { getUnderkategoriLabel } from '../../constants/categories';
import {
  formatDateShort,
  formatCurrencyCompact,
  formatDaysCompact,
} from '../../utils/formatters';
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@radix-ui/react-icons';

// ========== Constants ==========

const COMPACT_TOTAL_ITEMS = 5;
const EXPANDED_ITEMS_PER_GROUP = 5;

// ========== Types ==========

type SakstypeFilter = 'all' | 'standard' | 'forsering' | 'endringsordre';
type GroupBy = 'status' | 'kategori' | 'ingen';
type SortBy = 'dato' | 'belop' | 'saksnummer';
type SortDir = 'desc' | 'asc';

// ========== Helpers ==========

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

/**
 * Format sak_id for display with type-aware prefix.
 * SAK-xxx → KOE-xxx, EO-xxx stays, Forsering-xxx → FORS-xxx
 */
function formatSakId(sakId: string, sakstype: string): string {
  if (sakstype === 'endringsordre' && sakId.startsWith('EO-')) return sakId;
  if (sakstype === 'forsering' && sakId.startsWith('FORS-')) return sakId;
  if (sakstype === 'standard' && sakId.startsWith('SAK-')) {
    return 'KOE-' + sakId.slice(4);
  }
  if (sakstype === 'forsering' && sakId.startsWith('Forsering-')) {
    return 'FORS-' + sakId.slice(10);
  }
  return sakId;
}

/** Get the short type tag for coloring */
function getTypeTag(sakstype: string): { label: string; className: string } {
  switch (sakstype) {
    case 'forsering':
      return { label: 'FORS', className: 'text-amber-600' };
    case 'endringsordre':
      return { label: 'EO', className: 'text-blue-600' };
    default:
      return { label: 'KOE', className: 'text-pkt-brand-dark-blue-1000' };
  }
}

function getStatusLabel(status: string | null): string {
  if (!status) return 'Ukjent';
  return getOverordnetStatusLabel(status as OverordnetStatus);
}

function getStatusDotColor(status: string | null): string {
  if (!status) return 'bg-pkt-grays-gray-400';
  const style = getOverordnetStatusStyle(status);
  switch (style.variant) {
    case 'success':
      return 'bg-badge-success-border';
    case 'warning':
      return 'bg-badge-warning-border';
    case 'danger':
      return 'bg-badge-danger-border';
    default:
      return 'bg-pkt-grays-gray-400';
  }
}

const STATUS_GROUP_ORDER: Record<string, number> = {
  SENDT: 0,
  VENTER_PAA_SVAR: 1,
  UNDER_BEHANDLING: 2,
  UNDER_FORHANDLING: 3,
  UTKAST: 4,
  OMFORENT: 5,
  LUKKET: 6,
  LUKKET_TRUKKET: 7,
};

function sortCases(cases: CaseListItem[], sortBy: SortBy, sortDir: SortDir): CaseListItem[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...cases].sort((a, b) => {
    switch (sortBy) {
      case 'dato':
        return dir * (a.last_event_at ?? '').localeCompare(b.last_event_at ?? '');
      case 'belop':
        return dir * ((a.cached_sum_krevd ?? 0) - (b.cached_sum_krevd ?? 0));
      case 'saksnummer':
        return dir * a.sak_id.localeCompare(b.sak_id);
      default:
        return 0;
    }
  });
}

function groupCases(
  cases: CaseListItem[],
  groupBy: GroupBy
): { key: string; label: string; cases: CaseListItem[] }[] {
  if (groupBy === 'ingen') {
    return [{ key: 'all', label: '', cases }];
  }

  const groups = new Map<string, CaseListItem[]>();
  for (const c of cases) {
    const key =
      groupBy === 'status'
        ? (c.cached_status?.toUpperCase() ?? 'UKJENT')
        : (c.cached_underkategori ?? 'Ikke kategorisert');
    const existing = groups.get(key);
    if (existing) {
      existing.push(c);
    } else {
      groups.set(key, [c]);
    }
  }

  const entries = Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: groupBy === 'status' ? getStatusLabel(key) : (key === 'Ikke kategorisert' ? key : getUnderkategoriLabel(key)),
    cases: items,
  }));

  if (groupBy === 'status') {
    entries.sort(
      (a, b) => (STATUS_GROUP_ORDER[a.key] ?? 99) - (STATUS_GROUP_ORDER[b.key] ?? 99)
    );
  } else {
    entries.sort((a, b) => a.label.localeCompare(b.label));
  }

  return entries;
}

// ========== Pill Toggle ==========

function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
            value === opt.key
              ? 'bg-pkt-brand-dark-blue-1000 text-white'
              : 'text-pkt-text-body-subtle hover:bg-pkt-bg-subtle'
          }`}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className={`ml-1 tabular-nums ${value === opt.key ? 'text-white/70' : 'text-pkt-text-body-subtle'}`}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ========== Sort Direction Button ==========

function SortDirButton({ dir, onClick }: { dir: SortDir; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1 rounded-full hover:bg-pkt-bg-subtle transition-colors text-pkt-text-body-subtle"
      title={dir === 'desc' ? 'Synkende' : 'Stigende'}
    >
      {dir === 'desc' ? (
        <ArrowDownIcon className="w-3 h-3" />
      ) : (
        <ArrowUpIcon className="w-3 h-3" />
      )}
    </button>
  );
}

// ========== Shared Toolbar ==========

function CaseListToolbar({
  filter,
  setFilter,
  typeCounts,
  searchQuery,
  setSearchQuery,
  groupBy,
  setGroupBy,
  sortBy,
  setSortBy,
  sortDir,
  toggleSortDir,
  expanded,
  onToggleExpand,
}: {
  filter: SakstypeFilter;
  setFilter: (f: SakstypeFilter) => void;
  typeCounts: { all: number; standard: number; forsering: number; endringsordre: number };
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  sortDir: SortDir;
  toggleSortDir: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className="px-4 py-3 space-y-2">
      {/* Row 1: Title + filter pills + search + expand/collapse */}
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide shrink-0">
          Saker
        </p>
        <PillToggle
          options={[
            { key: 'all' as SakstypeFilter, label: 'Alle', count: typeCounts.all },
            { key: 'standard' as SakstypeFilter, label: 'KOE', count: typeCounts.standard },
            { key: 'forsering' as SakstypeFilter, label: 'Forsering', count: typeCounts.forsering },
            { key: 'endringsordre' as SakstypeFilter, label: 'EO', count: typeCounts.endringsordre },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="flex-1" />
        <div className="relative w-40">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pkt-text-body-subtle pointer-events-none" />
          <Input
            placeholder="Sok..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            width="full"
            className="!pl-8 !py-1 !min-h-[28px] !text-xs !rounded-full !bg-pkt-bg-subtle !border-transparent focus:!border-pkt-border-default"
          />
        </div>
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-0.5 text-xs text-pkt-text-action-active hover:underline shrink-0"
        >
          {expanded ? 'Kompakt' : 'Utvid'}
          {expanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Row 2: group + sort controls */}
      <div className="flex items-center gap-1.5 text-[11px] text-pkt-text-body-subtle">
        <span>Grupper:</span>
        <PillToggle
          options={[
            { key: 'status' as GroupBy, label: 'Status' },
            { key: 'kategori' as GroupBy, label: 'Kategori' },
            { key: 'ingen' as GroupBy, label: 'Ingen' },
          ]}
          value={groupBy}
          onChange={setGroupBy}
        />
        <div className="flex-1" />
        <span>Sorter:</span>
        <PillToggle
          options={[
            { key: 'dato' as SortBy, label: 'Dato' },
            { key: 'belop' as SortBy, label: 'Belop' },
            { key: 'saksnummer' as SortBy, label: 'Nr' },
          ]}
          value={sortBy}
          onChange={setSortBy}
        />
        <SortDirButton dir={sortDir} onClick={toggleSortDir} />
      </div>
    </div>
  );
}

// ========== Case Row ==========

function CaseRow({
  item,
  showExtendedColumns,
  to,
}: {
  item: CaseListItem;
  showExtendedColumns: boolean;
  to: string;
}) {
  const typeTag = getTypeTag(item.sakstype);

  return (
    <Link
      to={to}
      className="block px-4 py-2 hover:bg-pkt-bg-subtle/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pkt-brand-warm-blue-1000/30 transition-colors border-t border-pkt-border-subtle/50 first:border-t-0 no-underline"
    >
      {showExtendedColumns ? (
        /* Expanded: full grid with all columns */
        <div className="md:grid md:grid-cols-12 md:gap-3 md:items-center">
          {/* Sak-ID + Title */}
          <div className="col-span-4 flex items-center gap-2 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(item.cached_status)}`}
            />
            <span className={`font-mono text-xs shrink-0 ${typeTag.className}`}>
              {formatSakId(item.sak_id, item.sakstype)}
            </span>
            <p className="text-sm font-medium text-pkt-text-body-dark truncate min-w-0">
              {item.cached_title || 'Uten tittel'}
            </p>
          </div>
          {/* Status */}
          <div className="col-span-2 mt-0.5 md:mt-0">
            <span className="text-xs text-pkt-text-body-subtle">
              {getStatusLabel(item.cached_status)}
            </span>
          </div>
          {/* Vederlag */}
          <div className="col-span-2 mt-0.5 md:mt-0 text-right">
            <span className="font-mono text-xs text-pkt-text-body-default">
              {formatCurrencyCompact(item.cached_sum_krevd)}
            </span>
            <span className="text-pkt-text-body-subtle text-[10px] mx-0.5">/</span>
            <span className="font-mono text-xs text-pkt-text-body-subtle">
              {formatCurrencyCompact(item.cached_sum_godkjent)}
            </span>
          </div>
          {/* Frist */}
          <div className="col-span-2 mt-0.5 md:mt-0 text-right">
            <span className="font-mono text-xs text-pkt-text-body-default">
              {formatDaysCompact(item.cached_dager_krevd)}
            </span>
            <span className="text-pkt-text-body-subtle text-[10px] mx-0.5">/</span>
            <span className="font-mono text-xs text-pkt-text-body-subtle">
              {formatDaysCompact(item.cached_dager_godkjent)}
            </span>
          </div>
          {/* Date */}
          <div className="col-span-2 mt-0.5 md:mt-0 text-right hidden md:block">
            <span className="text-xs text-pkt-text-body-subtle tabular-nums">
              {formatDateShort(item.last_event_at)}
            </span>
          </div>
        </div>
      ) : (
        /* Compact: ID + title + status + date */
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(item.cached_status)}`}
          />
          <span className={`font-mono text-xs shrink-0 ${typeTag.className}`}>
            {formatSakId(item.sak_id, item.sakstype)}
          </span>
          <p className="text-sm font-medium text-pkt-text-body-dark truncate min-w-0 flex-1">
            {item.cached_title || 'Uten tittel'}
          </p>
          <span className="text-[11px] text-pkt-text-body-subtle shrink-0 hidden sm:inline">
            {getStatusLabel(item.cached_status)}
          </span>
          <span className="text-xs text-pkt-text-body-subtle shrink-0 tabular-nums hidden sm:inline">
            {formatDateShort(item.last_event_at)}
          </span>
        </div>
      )}
    </Link>
  );
}

// ========== Component ==========

interface CaseListTileProps {
  cases: CaseListItem[];
  allCases: CaseListItem[];
  userRole: 'BH' | 'TE';
  expanded: boolean;
  onToggleExpand: () => void;
}

export function CaseListTile({ cases, allCases, expanded, onToggleExpand }: CaseListTileProps) {
  const [filter, setFilter] = useState<SakstypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [sortBy, setSortBy] = useState<SortBy>('dato');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleSortDir = () => setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const typeCounts = useMemo(() => {
    const counts = { all: allCases.length, standard: 0, forsering: 0, endringsordre: 0 };
    for (const c of allCases) {
      if (c.sakstype in counts) {
        counts[c.sakstype as keyof typeof counts]++;
      }
    }
    return counts;
  }, [allCases]);

  const filteredByType = useMemo(() => {
    if (filter === 'all') return cases;
    return cases.filter(c => c.sakstype === filter);
  }, [cases, filter]);

  const searchedCases = useMemo(() => {
    if (!searchQuery.trim()) return filteredByType;
    const q = searchQuery.toLowerCase();
    return filteredByType.filter(
      c =>
        c.sak_id.toLowerCase().includes(q) ||
        formatSakId(c.sak_id, c.sakstype).toLowerCase().includes(q) ||
        (c.cached_title ?? '').toLowerCase().includes(q)
    );
  }, [filteredByType, searchQuery]);

  const grouped = useMemo(() => {
    const sorted = sortCases(searchedCases, sortBy, sortDir);
    return groupCases(sorted, groupBy);
  }, [searchedCases, sortBy, sortDir, groupBy]);

  const totalFiltered = searchedCases.length;

  // In compact mode, cap total visible items across all groups
  const compactVisibleItems = useMemo(() => {
    if (expanded) return null;
    const items: CaseListItem[] = [];
    for (const group of grouped) {
      for (const c of group.cases) {
        if (items.length >= COMPACT_TOTAL_ITEMS) break;
        items.push(c);
      }
      if (items.length >= COMPACT_TOTAL_ITEMS) break;
    }
    return items;
  }, [expanded, grouped]);

  const compactHiddenCount = !expanded ? totalFiltered - (compactVisibleItems?.length ?? 0) : 0;

  return (
    <BentoCard colSpan={expanded ? 'col-span-12' : 'col-span-12 lg:col-span-7'} delay={300}>
      {/* Shared toolbar - both compact and expanded */}
      <CaseListToolbar
        filter={filter}
        setFilter={setFilter}
        typeCounts={typeCounts}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortDir={sortDir}
        toggleSortDir={toggleSortDir}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      />

      {/* Empty state */}
      {totalFiltered === 0 && allCases.length > 0 && (
        <div className="text-center py-8 px-4">
          <p className="text-xs text-pkt-text-body-subtle">
            Ingen saker matcher &mdash;{' '}
            <button
              onClick={() => { setSearchQuery(''); setFilter('all'); }}
              className="text-pkt-text-action-active hover:underline"
            >
              nullstill
            </button>
          </p>
        </div>
      )}

      {/* Case rows */}
      {totalFiltered > 0 && (
        <div>
          {expanded ? (
            /* ===== EXPANDED: grouped with per-group expand ===== */
            <>
              {/* Column header (desktop) */}
              <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-1.5 text-[10px] font-semibold text-pkt-text-body-subtle uppercase tracking-wider border-t border-pkt-border-subtle">
                <div className="col-span-4">Sak</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Vederlag</div>
                <div className="col-span-2 text-right">Frist</div>
                <div className="col-span-2 text-right">Dato</div>
              </div>

              {grouped.map((group) => {
                const isGroupExpanded = expandedGroups.has(group.key);
                const visibleCases = (groupBy !== 'ingen' && !isGroupExpanded)
                  ? group.cases.slice(0, EXPANDED_ITEMS_PER_GROUP)
                  : group.cases;
                const hiddenCount = group.cases.length - visibleCases.length;

                return (
                  <div key={group.key}>
                    {groupBy !== 'ingen' && (
                      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                        <span className="text-[10px] font-semibold text-pkt-text-body-subtle uppercase tracking-wider">
                          {group.label}
                        </span>
                        <span className="text-[10px] text-pkt-text-body-subtle tabular-nums">
                          {group.cases.length}
                        </span>
                        <div className="flex-1 border-t border-pkt-border-subtle" />
                      </div>
                    )}

                    {visibleCases.map((item) => (
                      <CaseRow
                        key={item.sak_id}
                        item={item}
                        showExtendedColumns
                        to={getCaseRoute(item)}
                      />
                    ))}

                    {hiddenCount > 0 && (
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="w-full px-4 py-2 text-xs text-pkt-text-action-active hover:bg-pkt-bg-subtle/30 transition-colors text-left"
                      >
                        Vis {hiddenCount} flere...
                      </button>
                    )}
                    {isGroupExpanded && group.cases.length > EXPANDED_ITEMS_PER_GROUP && (
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="w-full px-4 py-2 text-xs text-pkt-text-action-active hover:bg-pkt-bg-subtle/30 transition-colors text-left"
                      >
                        Vis mindre
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            /* ===== COMPACT: flat list capped at COMPACT_TOTAL_ITEMS ===== */
            <>
              {compactVisibleItems!.map((item) => (
                <CaseRow
                  key={item.sak_id}
                  item={item}
                  showExtendedColumns={false}
                  to={getCaseRoute(item)}
                />
              ))}

              {compactHiddenCount > 0 && (
                <button
                  onClick={onToggleExpand}
                  className="w-full px-4 py-2.5 text-xs text-pkt-text-action-active hover:bg-pkt-bg-subtle/30 transition-colors text-center"
                >
                  +{compactHiddenCount} flere saker
                </button>
              )}
            </>
          )}

          {/* Bottom padding */}
          <div className="h-2" />
        </div>
      )}
    </BentoCard>
  );
}
