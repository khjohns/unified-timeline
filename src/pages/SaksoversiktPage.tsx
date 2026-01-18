/**
 * SaksoversiktPage Component
 *
 * Shows an overview of all cases fetched from Supabase.
 * Allows filtering by case type and navigating to individual cases.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Card, DropdownMenuItem } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { useCaseList } from '../hooks/useCaseList';
import { useAuth } from '../context/AuthContext';
import { CaseListItem } from '../types/api';
import { getOverordnetStatusLabel } from '../constants/statusLabels';
import {
  getOverordnetStatusBadgeClass,
  getSakstypeBadgeClass,
  getSakstypeLabel,
} from '../constants/statusStyles';
import { formatDateShort } from '../utils/formatters';
import type { OverordnetStatus } from '../types/timeline';

type SakstypeFilter = 'all' | 'standard' | 'forsering' | 'endringsordre';

/**
 * Get readable status label from raw status code
 */
function getStatusLabel(status: string | null): string {
  if (!status) return 'Ukjent';
  return getOverordnetStatusLabel(status as OverordnetStatus);
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

export function SaksoversiktPage() {
  const navigate = useNavigate();
  const { isVerifying } = useAuth();
  const [filter, setFilter] = useState<SakstypeFilter>('all');

  const { data, isLoading, error } = useCaseList({
    sakstype: filter === 'all' ? undefined : filter,
    enabled: !isVerifying,
  });

  const cases = data?.cases ?? [];

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header */}
      <PageHeader
        title="Saksoversikt"
        subtitle="Oversikt over alle registrerte saker"
        maxWidth="wide"
        menuActions={
          <>
            <DropdownMenuItem asChild>
              <Link to="/saker/ny">Opprett ny sak</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/analyse">Analysedashboard</Link>
            </DropdownMenuItem>
          </>
        }
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'standard', 'forsering', 'endringsordre'] as SakstypeFilter[]).map(
            (filterOption) => (
              <Button
                key={filterOption}
                variant={filter === filterOption ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter(filterOption)}
              >
                {filterOption === 'all'
                  ? 'Alle'
                  : filterOption === 'standard'
                  ? 'KOE'
                  : filterOption === 'forsering'
                  ? 'Forsering'
                  : 'Endringsordre'}
              </Button>
            )
          )}
        </div>

        {/* Loading State */}
        {(isLoading || isVerifying) && (
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-pkt-text-body-subtle">Laster saker...</span>
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Card variant="outlined" padding="lg">
            <div className="text-center py-12">
              <p className="text-alert-danger-text mb-4">
                Kunne ikke laste saker: {error.message}
              </p>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Prøv igjen
              </Button>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && cases.length === 0 && (
          <Card variant="outlined" padding="lg">
            <div className="text-center py-12">
              <p className="text-pkt-text-body-subtle mb-4">
                Ingen saker funnet
                {filter !== 'all' && ` med type "${getSakstypeLabel(filter)}"`}
              </p>
              <Button variant="primary" onClick={() => navigate('/saker/ny')}>
                Opprett ny sak
              </Button>
            </div>
          </Card>
        )}

        {/* Case List */}
        {!isLoading && !error && cases.length > 0 && (
          <section aria-labelledby="case-list-heading">
            <Card variant="outlined" padding="md">
              <div className="flex items-center justify-between mb-4">
                <h2 id="case-list-heading" className="text-base font-semibold text-pkt-text-body-dark">
                  Saker
                </h2>
                <span className="text-sm text-pkt-text-body-subtle">
                  {cases.length} sak{cases.length !== 1 ? 'er' : ''}
                  {filter !== 'all' && ` av type "${getSakstypeLabel(filter)}"`}
                </span>
              </div>

              {/* Table Header (desktop) */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-pkt-text-body-subtle border-b border-pkt-border-subtle">
                <div className="col-span-2">Sak-ID</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-4">Tittel</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Sist oppdatert</div>
                <div className="col-span-1"></div>
              </div>

              {/* Case Rows */}
              <div className="divide-y divide-pkt-border-subtle">
                {cases.map((item) => (
                  <div
                    key={item.sak_id}
                    className="px-4 py-3 hover:bg-pkt-surface-subtle transition-colors cursor-pointer"
                    onClick={() => navigate(getCaseRoute(item))}
                  >
                    <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center">
                      {/* Sak-ID */}
                      <div className="col-span-2">
                        <span className="font-mono text-sm font-semibold text-pkt-text-action-active">
                          {item.sak_id}
                        </span>
                      </div>

                      {/* Type Badge */}
                      <div className="col-span-1 mt-2 md:mt-0">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded-sm ${getSakstypeBadgeClass(
                            item.sakstype
                          )}`}
                        >
                          {getSakstypeLabel(item.sakstype)}
                        </span>
                      </div>

                      {/* Title */}
                      <div className="col-span-4 mt-2 md:mt-0">
                        <p className="text-sm text-pkt-text-body-default line-clamp-1">
                          {item.cached_title || 'Uten tittel'}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className="col-span-2 mt-2 md:mt-0">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded-sm ${getOverordnetStatusBadgeClass(
                            item.cached_status
                          )}`}
                        >
                          {getStatusLabel(item.cached_status)}
                        </span>
                      </div>

                      {/* Last Updated */}
                      <div className="col-span-2 mt-2 md:mt-0">
                        <span className="text-sm text-pkt-text-body-subtle">
                          {formatDateShort(item.last_event_at)}
                        </span>
                      </div>

                      {/* Action */}
                      <div className="col-span-1 mt-3 md:mt-0 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(getCaseRoute(item));
                          }}
                        >
                          Vis
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}

export default SaksoversiktPage;
