/**
 * SaksoversiktPage Component
 *
 * Project dashboard with branded hero section, KPI cards, and rich case list.
 * Visual language matches AuthLanding: dark hero, grid overlay, gradient accents.
 */

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Button,
  Card,
  Alert,
  Input,
  Badge,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  DropdownMenuItem,
} from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { useCaseListSuspense } from '../hooks/useCaseList';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { useUserRole } from '../context/UserRoleContext';
import { CaseListItem } from '../types/api';
import { getOverordnetStatusLabel } from '../constants/statusLabels';
import {
  getOverordnetStatusStyle,
  getSakstypeBadgeClass,
  getSakstypeLabel,
} from '../constants/statusStyles';
import {
  formatDateShort,
  formatCurrencyCompact,
  formatDaysCompact,
  formatCurrency,
} from '../utils/formatters';
import type { OverordnetStatus } from '../types/timeline';
import { LoadingState, VerifyingState } from '../components/PageStateHelpers';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { downloadAllCasesExcel } from '../utils/excelExport';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  RocketIcon,
  TimerIcon,
  BarChartIcon,
} from '@radix-ui/react-icons';

// ========== Types ==========

type SakstypeFilter = 'all' | 'standard' | 'forsering' | 'endringsordre';
type GroupBy = 'status' | 'kategori' | 'ingen';
type SortBy = 'dato' | 'belop' | 'saksnummer';

// ========== Helpers ==========

const CLOSED_STATUSES = new Set(['OMFORENT', 'LUKKET', 'LUKKET_TRUKKET']);
const BH_PENDING_STATUSES = new Set(['SENDT', 'UNDER_BEHANDLING']);
const TE_PENDING_STATUSES = new Set(['VENTER_PAA_SVAR']);

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

function sortCases(cases: CaseListItem[], sortBy: SortBy): CaseListItem[] {
  return [...cases].sort((a, b) => {
    switch (sortBy) {
      case 'dato':
        return (b.last_event_at ?? '').localeCompare(a.last_event_at ?? '');
      case 'belop':
        return (b.cached_sum_krevd ?? 0) - (a.cached_sum_krevd ?? 0);
      case 'saksnummer':
        return a.sak_id.localeCompare(b.sak_id);
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
        : (c.cached_hovedkategori ?? 'Ikke kategorisert');
    const existing = groups.get(key);
    if (existing) {
      existing.push(c);
    } else {
      groups.set(key, [c]);
    }
  }

  const entries = Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: groupBy === 'status' ? getStatusLabel(key) : key,
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

// ========== KPI Card ==========

function KPICard({
  label,
  value,
  sub,
  accentColor,
  delay,
  mounted,
}: {
  label: string;
  value: string;
  sub?: string;
  accentColor: string;
  delay: number;
  mounted: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-pkt-bg-card border border-pkt-grays-gray-200
                  dark:border-white/10 dark:bg-white/5
                  transition-all duration-500 ease-out
                  ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
      <div className="pl-4 pr-4 py-3.5">
        <p className="text-xs font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-pkt-text-body-dark font-mono tabular-nums">
          {value}
        </p>
        {sub && (
          <p className="text-xs text-pkt-text-body-subtle mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function SaksoversiktPage() {
  const { isVerifying } = useAuth();
  const [filter, setFilter] = useState<SakstypeFilter>('all');

  if (isVerifying) {
    return <VerifyingState />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState />}>
        <SaksoversiktContent filter={filter} setFilter={setFilter} />
      </Suspense>
    </ErrorBoundary>
  );
}

function SaksoversiktContent({
  filter,
  setFilter,
}: {
  filter: SakstypeFilter;
  setFilter: (f: SakstypeFilter) => void;
}) {
  const navigate = useNavigate();
  const { userRole } = useUserRole();
  const { activeProject } = useProject();

  // Mount animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [sortBy, setSortBy] = useState<SortBy>('dato');
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  // Data
  const { data } = useCaseListSuspense({
    sakstype: filter === 'all' ? undefined : filter,
  });
  const allCases = data.cases;

  const { data: allData } = useCaseListSuspense({});
  const unfilteredCases = allData.cases;

  // ========== Computed ==========

  const pendingStatuses = userRole === 'BH' ? BH_PENDING_STATUSES : TE_PENDING_STATUSES;
  const pendingCount = useMemo(
    () =>
      unfilteredCases.filter((c) =>
        pendingStatuses.has(c.cached_status?.toUpperCase() ?? '')
      ).length,
    [unfilteredCases, pendingStatuses]
  );

  const typeCounts = useMemo(() => {
    const counts = { all: unfilteredCases.length, standard: 0, forsering: 0, endringsordre: 0 };
    for (const c of unfilteredCases) {
      if (c.sakstype in counts) {
        counts[c.sakstype as keyof typeof counts]++;
      }
    }
    return counts;
  }, [unfilteredCases]);

  const kpi = useMemo(() => {
    const openCount = allCases.filter(
      (c) => !CLOSED_STATUSES.has(c.cached_status?.toUpperCase() ?? '')
    ).length;
    const totalKrevd = allCases.reduce((sum, c) => sum + (c.cached_sum_krevd ?? 0), 0);
    const totalGodkjent = allCases.reduce(
      (sum, c) => sum + (c.cached_sum_godkjent ?? 0),
      0
    );
    const totalDagerKrevd = allCases.reduce(
      (sum, c) => sum + (c.cached_dager_krevd ?? 0),
      0
    );
    return {
      total: allCases.length,
      open: openCount,
      totalKrevd,
      totalGodkjent,
      totalDagerKrevd,
    };
  }, [allCases]);

  // Godkjent-andel for progress bar
  const godkjentPct = kpi.totalKrevd > 0
    ? Math.round((kpi.totalGodkjent / kpi.totalKrevd) * 100)
    : 0;

  // Search filter
  const searchedCases = useMemo(() => {
    let cases = allCases;
    if (showPendingOnly) {
      cases = cases.filter((c) =>
        pendingStatuses.has(c.cached_status?.toUpperCase() ?? '')
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cases = cases.filter(
        (c) =>
          c.sak_id.toLowerCase().includes(q) ||
          (c.cached_title ?? '').toLowerCase().includes(q)
      );
    }
    return cases;
  }, [allCases, searchQuery, showPendingOnly, pendingStatuses]);

  const grouped = useMemo(() => {
    const sorted = sortCases(searchedCases, sortBy);
    return groupCases(sorted, groupBy);
  }, [searchedCases, sortBy, groupBy]);

  const totalFiltered = searchedCases.length;

  function clearFilters() {
    setSearchQuery('');
    setShowPendingOnly(false);
    setFilter('all');
  }

  // ========== Render ==========

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Prosjektoversikt"
        subtitle={activeProject.name}
        maxWidth="wide"
        menuActions={
          <>
            <DropdownMenuItem asChild>
              <Link to="/saker/ny">Opprett ny sak</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/analyse">Analysedashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadAllCasesExcel(allCases)}>
              Eksporter til Excel
            </DropdownMenuItem>
          </>
        }
      />

      {/* ===== Hero Section ===== */}
      <div className="relative overflow-hidden bg-pkt-brand-dark-blue-1000 dark:bg-pkt-brand-dark-blue-1000">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Gradient accents */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 opacity-20 blur-3xl pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, var(--color-pkt-brand-blue-1000) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-64 h-64 opacity-15 blur-3xl pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, var(--color-pkt-brand-green-1000) 0%, transparent 70%)',
          }}
        />

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
          {/* Project identity */}
          <div
            className={`transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-pkt-brand-green-1000 animate-pulse" />
              <span className="text-xs font-medium text-white/50 uppercase tracking-widest">
                NS 8407 Endringsregister
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              {activeProject.name}
            </h2>
          </div>

          {/* KPI Cards */}
          {kpi.total > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <KPICard
                label="Saker"
                value={`${kpi.total}`}
                sub={`${kpi.open} åpne`}
                accentColor="bg-pkt-brand-warm-blue-1000"
                delay={100}
                mounted={mounted}
              />
              <KPICard
                label="Krevd"
                value={formatCurrencyCompact(kpi.totalKrevd)}
                sub={kpi.totalKrevd > 0 ? formatCurrency(kpi.totalKrevd) : undefined}
                accentColor="bg-pkt-brand-yellow-1000"
                delay={175}
                mounted={mounted}
              />
              <KPICard
                label="Godkjent"
                value={formatCurrencyCompact(kpi.totalGodkjent)}
                sub={kpi.totalKrevd > 0 ? `${godkjentPct}% av krevd` : undefined}
                accentColor="bg-pkt-brand-green-1000"
                delay={250}
                mounted={mounted}
              />
              <KPICard
                label="Fristforlengelse"
                value={kpi.totalDagerKrevd > 0 ? `${kpi.totalDagerKrevd}d` : '—'}
                sub="dager krevd totalt"
                accentColor="bg-pkt-brand-blue-1000"
                delay={325}
                mounted={mounted}
              />
            </div>
          )}
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 -mt-0 pb-8">
        <div className="space-y-4 pt-6">
          {/* Action Bar */}
          {pendingCount > 0 && !showPendingOnly && (
            <Alert
              variant="warning"
              size="sm"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPendingOnly(true)}
                >
                  Vis
                </Button>
              }
            >
              <span className="font-medium">
                {pendingCount}{' '}
                {pendingCount === 1 ? 'sak venter' : 'saker venter'} på{' '}
                {userRole === 'BH' ? 'ditt svar som BH' : 'svar fra BH'}
              </span>
            </Alert>
          )}

          {showPendingOnly && (
            <Alert
              variant="info"
              size="sm"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPendingOnly(false)}
                >
                  Vis alle
                </Button>
              }
            >
              <span className="font-medium">
                Viser {pendingCount}{' '}
                {pendingCount === 1 ? 'sak' : 'saker'} som venter på{' '}
                {userRole === 'BH' ? 'ditt svar' : 'svar fra BH'}
              </span>
            </Alert>
          )}

          {/* Toolbar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pkt-text-body-subtle pointer-events-none" />
                <Input
                  placeholder="Søk saker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  width="full"
                  className="!pl-9 !py-2 !min-h-[36px] !text-sm"
                />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-pkt-text-body-subtle hidden sm:inline">
                  Gruppér:
                </span>
                <Select
                  value={groupBy}
                  onValueChange={(v) => setGroupBy(v as GroupBy)}
                >
                  <SelectTrigger className="w-[130px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="kategori">Kategori</SelectItem>
                    <SelectItem value="ingen">Ingen</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-pkt-text-body-subtle hidden sm:inline">
                  Sortér:
                </span>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as SortBy)}
                >
                  <SelectTrigger className="w-[130px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dato">Dato</SelectItem>
                    <SelectItem value="belop">Beløp</SelectItem>
                    <SelectItem value="saksnummer">Saksnummer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { key: 'all', label: 'Alle' },
                  { key: 'standard', label: 'KOE' },
                  { key: 'forsering', label: 'Forsering' },
                  { key: 'endringsordre', label: 'EO' },
                ] as { key: SakstypeFilter; label: string }[]
              ).map(({ key, label }) => (
                <Button
                  key={key}
                  variant={filter === key ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilter(key)}
                >
                  {label}
                  <Badge
                    variant={filter === key ? 'default' : 'neutral'}
                    size="sm"
                    className="ml-1.5"
                  >
                    {typeCounts[key]}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* ===== Empty State: No cases at all ===== */}
          {unfilteredCases.length === 0 && (
            <div className="relative overflow-hidden rounded-lg border border-pkt-grays-gray-200 bg-pkt-bg-card">
              {/* Subtle radial glow */}
              <div
                className="absolute top-0 right-0 w-64 h-64 opacity-10 blur-3xl pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, var(--color-pkt-brand-blue-1000) 0%, transparent 70%)',
                }}
              />
              <div className="relative z-10 text-center py-16 px-6 max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-pkt-surface-light-blue flex items-center justify-center">
                  <RocketIcon className="w-8 h-8 text-pkt-brand-warm-blue-1000" />
                </div>
                <h3 className="text-xl font-bold text-pkt-text-body-dark mb-2">
                  Kom i gang med {activeProject.name}
                </h3>
                <p className="text-sm text-pkt-text-body-subtle mb-8 leading-relaxed">
                  Opprett din første KOE-sak for å starte digital håndtering av
                  endringsordrer etter NS 8407.
                </p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/saker/ny')}
                >
                  <PlusIcon className="w-4 h-4 mr-1.5" />
                  Opprett første sak
                </Button>

                {/* Feature hints */}
                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-pkt-border-subtle">
                  <div className="flex-1 h-px bg-pkt-border-subtle" />
                  <span className="text-xs text-pkt-text-body-subtle">
                    NS 8407:2011
                  </span>
                  <div className="flex-1 h-px bg-pkt-border-subtle" />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                  {[
                    { icon: BarChartIcon, label: 'Grunnlag' },
                    { icon: TimerIcon, label: 'Frist' },
                    { icon: RocketIcon, label: 'Vederlag' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-pkt-bg-subtle flex items-center justify-center">
                        <Icon className="w-4 h-4 text-pkt-text-body-subtle" />
                      </div>
                      <span className="text-xs text-pkt-text-body-subtle">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== Empty State: Filters returned nothing ===== */}
          {unfilteredCases.length > 0 && totalFiltered === 0 && (
            <Card variant="outlined" padding="md">
              <div className="text-center py-8">
                <p className="text-sm text-pkt-text-body-subtle mb-2">
                  Ingen saker matcher søket
                </p>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Vis alle saker
                </Button>
              </div>
            </Card>
          )}

          {/* ===== Case List ===== */}
          {totalFiltered > 0 && (
            <section aria-labelledby="case-list-heading">
              <h2 id="case-list-heading" className="sr-only">
                Saksliste
              </h2>

              {/* Table Header (desktop) */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-pkt-text-body-subtle uppercase tracking-wide">
                <div className="col-span-2">Sak-ID</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-3">Tittel</div>
                <div className="col-span-2 text-right">Vederlag</div>
                <div className="col-span-2 text-right">Frist</div>
                <div className="col-span-2 text-right">Dato</div>
              </div>

              {/* Grouped sections */}
              <div className="space-y-1">
                {grouped.map((group) => (
                  <div key={group.key}>
                    {groupBy !== 'ingen' && (
                      <div className="flex items-center gap-2 px-4 py-2 mt-2 first:mt-0">
                        <span className="text-xs font-semibold text-pkt-text-body-subtle uppercase tracking-wide">
                          {group.label}
                        </span>
                        <span className="text-xs text-pkt-text-body-subtle">
                          ({group.cases.length})
                        </span>
                        <div className="flex-1 border-t border-pkt-border-subtle" />
                      </div>
                    )}

                    <Card variant="outlined" padding="none">
                      <div className="divide-y divide-pkt-border-subtle">
                        {group.cases.map((item, i) => (
                          <div
                            key={item.sak_id}
                            className="px-4 py-3 hover:bg-pkt-surface-subtle transition-all duration-200 cursor-pointer
                                       animate-fade-in-up"
                            style={{
                              animationDelay: `${Math.min(i * 30, 300)}ms`,
                            }}
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
                            {/* Line 1 */}
                            <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center">
                              <div className="col-span-2">
                                <span className="font-mono text-sm font-semibold text-pkt-text-action-active">
                                  {item.sak_id}
                                </span>
                              </div>
                              <div className="col-span-1 mt-1 md:mt-0">
                                <span
                                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-sm ${getSakstypeBadgeClass(
                                    item.sakstype
                                  )}`}
                                >
                                  {getSakstypeLabel(item.sakstype)}
                                </span>
                              </div>
                              <div className="col-span-3 mt-1 md:mt-0">
                                <p className="text-sm text-pkt-text-body-default line-clamp-1">
                                  {item.cached_title || 'Uten tittel'}
                                </p>
                              </div>
                              <div className="col-span-2 mt-1 md:mt-0 text-right">
                                <span className="font-mono text-sm text-pkt-text-body-default">
                                  {formatCurrencyCompact(item.cached_sum_krevd)}
                                </span>
                                <span className="text-pkt-text-body-subtle text-xs mx-1">
                                  /
                                </span>
                                <span className="font-mono text-sm text-pkt-text-body-subtle">
                                  {formatCurrencyCompact(item.cached_sum_godkjent)}
                                </span>
                              </div>
                              <div className="col-span-2 mt-1 md:mt-0 text-right">
                                <span className="font-mono text-sm text-pkt-text-body-default">
                                  {formatDaysCompact(item.cached_dager_krevd)}
                                </span>
                                <span className="text-pkt-text-body-subtle text-xs mx-1">
                                  /
                                </span>
                                <span className="font-mono text-sm text-pkt-text-body-subtle">
                                  {formatDaysCompact(item.cached_dager_godkjent)}
                                </span>
                              </div>
                              <div className="col-span-2 mt-1 md:mt-0 text-right hidden md:block">
                                <span className="text-sm text-pkt-text-body-subtle">
                                  {formatDateShort(item.last_event_at)}
                                </span>
                              </div>
                            </div>

                            {/* Line 2 */}
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-pkt-text-body-subtle line-clamp-1">
                                {item.cached_hovedkategori || ''}
                              </span>
                              <span className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                                <span
                                  className={`inline-block w-2 h-2 rounded-full ${getStatusDotColor(
                                    item.cached_status
                                  )}`}
                                />
                                <span className="text-xs text-pkt-text-body-subtle">
                                  {getStatusLabel(item.cached_status)}
                                </span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default SaksoversiktPage;
