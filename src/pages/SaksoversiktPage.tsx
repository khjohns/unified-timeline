/**
 * SaksoversiktPage Component
 *
 * Shows an overview of all cases fetched from Supabase.
 * Allows filtering by case type and navigating to individual cases.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../components/primitives';
import { useCaseList } from '../hooks/useCaseList';
import { useAuth } from '../context/AuthContext';
import { CaseListItem } from '../types/api';

type SakstypeFilter = 'all' | 'standard' | 'forsering' | 'endringsordre';

function formatDate(isoString: string | null): string {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

function getStatusBadgeClass(status: string | null): string {
  if (!status) return 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700';

  const statusLower = status.toLowerCase();

  if (statusLower.includes('godkjent') || statusLower.includes('klar for eo')) {
    return 'bg-badge-success-bg text-badge-success-text';
  }
  if (statusLower.includes('avslått') || statusLower.includes('avvist')) {
    return 'bg-badge-error-bg text-badge-error-text';
  }
  if (statusLower.includes('behandling') || statusLower.includes('sendt')) {
    return 'bg-badge-warning-bg text-badge-warning-text';
  }
  if (statusLower.includes('utkast')) {
    return 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700';
  }
  if (statusLower.includes('forsering')) {
    return 'bg-pkt-brand-yellow-500 text-alert-warning-text border border-pkt-border-yellow';
  }

  return 'bg-badge-info-bg text-badge-info-text';
}

function getSakstypeLabel(sakstype: string): string {
  switch (sakstype) {
    case 'forsering':
      return 'Forsering';
    case 'endringsordre':
      return 'Endringsordre';
    default:
      return 'KOE';
  }
}

function getSakstypeBadgeClass(sakstype: string): string {
  switch (sakstype) {
    case 'forsering':
      return 'bg-pkt-brand-yellow-500 text-alert-warning-text';
    case 'endringsordre':
      return 'bg-badge-info-bg text-badge-info-text';
    default:
      return 'bg-oslo-blue text-white';
  }
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
    <div className="min-h-screen bg-pkt-bg-default">
      {/* Header */}
      <header className="bg-pkt-bg-card shadow-sm border-b-2 border-oslo-blue">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-heading-lg font-bold text-oslo-blue">
                Sakoversikt
              </h1>
              <p className="mt-2 text-body-md text-pkt-grays-gray-600">
                Oversikt over alle registrerte saker
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/saker/ny')}
              >
                Opprett ny sak
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
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
          <Card variant="default" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-pkt-grays-gray-600">Laster saker...</span>
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Card variant="default" padding="lg">
            <div className="text-center py-12">
              <p className="text-badge-error-text mb-4">
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
          <Card variant="default" padding="lg">
            <div className="text-center py-12">
              <p className="text-pkt-grays-gray-600 mb-4">
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
          <div className="space-y-4">
            {/* Table Header (desktop) */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-pkt-grays-gray-600 border-b border-pkt-border-default">
              <div className="col-span-2">Sak-ID</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-4">Tittel</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Sist oppdatert</div>
              <div className="col-span-1"></div>
            </div>

            {/* Case Rows */}
            {cases.map((item) => (
              <Card
                key={item.sak_id}
                variant="outlined"
                padding="md"
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(getCaseRoute(item))}
              >
                <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center">
                  {/* Sak-ID */}
                  <div className="col-span-2">
                    <span className="font-mono text-sm font-semibold text-oslo-blue">
                      {item.sak_id}
                    </span>
                  </div>

                  {/* Type Badge */}
                  <div className="col-span-1 mt-2 md:mt-0">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded ${getSakstypeBadgeClass(
                        item.sakstype
                      )}`}
                    >
                      {getSakstypeLabel(item.sakstype)}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="col-span-4 mt-2 md:mt-0">
                    <p className="text-body-md text-pkt-grays-gray-800 line-clamp-1">
                      {item.cached_title || 'Uten tittel'}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-2 mt-2 md:mt-0">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusBadgeClass(
                        item.cached_status
                      )}`}
                    >
                      {item.cached_status || 'Ukjent'}
                    </span>
                  </div>

                  {/* Last Updated */}
                  <div className="col-span-2 mt-2 md:mt-0">
                    <span className="text-sm text-pkt-grays-gray-600">
                      {formatDate(item.last_event_at)}
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
              </Card>
            ))}
          </div>
        )}

        {/* Stats */}
        {!isLoading && !error && cases.length > 0 && (
          <div className="mt-6 text-sm text-pkt-grays-gray-600">
            Viser {cases.length} sak{cases.length !== 1 ? 'er' : ''}
            {filter !== 'all' && ` av type "${getSakstypeLabel(filter)}"`}
          </div>
        )}
      </main>
    </div>
  );
}

export default SaksoversiktPage;
