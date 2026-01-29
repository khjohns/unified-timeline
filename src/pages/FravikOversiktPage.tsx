/**
 * FravikOversiktPage Component
 *
 * Shows an overview of all fravik-søknader.
 * Allows navigating to individual søknader and creating new ones.
 */

import { useState, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { PageLoadingFallback } from '../components/PageLoadingFallback';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Button, Card, Table, DropdownMenuItem, type Column } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { fetchFravikListe } from '../api/fravik';
import { OpprettFravikModal } from '../components/fravik';
import type { FravikListeItem, FravikStatus } from '../types/fravik';
import { FRAVIK_STATUS_LABELS, getFravikStatusColor } from '../types/fravik';
import { formatDateShort } from '../utils/formatters';

type StatusFilter = 'all' | 'aktive' | 'ferdig';

const DEFAULT_STATUS_CLASS = 'bg-pkt-bg-subtle text-pkt-text-body-subtle';
const STATUS_COLOR_CLASSES: Record<string, string> = {
  gray: DEFAULT_STATUS_CLASS,
  blue: 'bg-oslo-blue-light text-oslo-blue',
  yellow: 'bg-amber-100 text-amber-800',
  green: 'bg-alert-success-light text-alert-success-text',
  red: 'bg-alert-danger-light text-alert-danger-text',
};

function getStatusBadgeClass(status: FravikStatus): string {
  const color = getFravikStatusColor(status);
  return STATUS_COLOR_CLASSES[color] ?? DEFAULT_STATUS_CLASS;
}

function filterByStatus(items: FravikListeItem[], filter: StatusFilter): FravikListeItem[] {
  if (filter === 'all') return items;

  const ferdigStatuser: FravikStatus[] = ['godkjent', 'delvis_godkjent', 'avslatt', 'trukket'];

  if (filter === 'ferdig') {
    return items.filter((item) => ferdigStatuser.includes(item.status));
  }

  // aktive = not ferdig
  return items.filter((item) => !ferdigStatuser.includes(item.status));
}

const columns: Column<FravikListeItem>[] = [
  {
    key: 'prosjekt',
    label: 'Prosjekt',
    sortable: true,
    filterable: true,
    filterType: 'text',
    sortFn: (a, b, direction) => {
      const cmp = a.prosjekt_navn.localeCompare(b.prosjekt_navn, 'nb');
      return direction === 'asc' ? cmp : -cmp;
    },
    filterFn: (item, value) =>
      item.prosjekt_navn.toLowerCase().includes(value.toLowerCase()) ||
      (item.prosjekt_nummer?.toLowerCase().includes(value.toLowerCase()) ?? false),
    render: (soknad) => (
      <div>
        <div className="font-medium text-pkt-text-heading">{soknad.prosjekt_navn}</div>
        {soknad.prosjekt_nummer && (
          <div className="text-xs text-pkt-text-body-subtle">{soknad.prosjekt_nummer}</div>
        )}
      </div>
    ),
  },
  {
    key: 'soker',
    label: 'Søker',
    sortable: true,
    filterable: true,
    filterType: 'text',
    sortFn: (a, b, direction) => {
      const cmp = a.soker_navn.localeCompare(b.soker_navn, 'nb');
      return direction === 'asc' ? cmp : -cmp;
    },
    filterFn: (item, value) => item.soker_navn.toLowerCase().includes(value.toLowerCase()),
    render: (soknad) => soknad.soker_navn,
  },
  {
    key: 'type',
    label: 'Type',
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'machine', label: 'Maskin' },
      { value: 'infrastructure', label: 'Infrastruktur' },
    ],
    filterFn: (item, value) => {
      const selected = value.split(',').filter(Boolean);
      return selected.length === 0 || selected.includes(item.soknad_type);
    },
    render: (soknad) => (
      <span className="px-2 py-1 rounded-full text-xs bg-pkt-bg-subtle text-pkt-text-body-default">
        {soknad.soknad_type === 'machine' ? 'Maskin' : 'Infrastruktur'}
      </span>
    ),
  },
  {
    key: 'maskiner',
    label: 'Maskiner',
    align: 'center',
    sortable: true,
    sortFn: (a, b, direction) => {
      const cmp = a.antall_maskiner - b.antall_maskiner;
      return direction === 'asc' ? cmp : -cmp;
    },
    render: (soknad) => soknad.antall_maskiner,
  },
  {
    key: 'status',
    label: 'Status',
    render: (soknad) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(soknad.status)}`}>
        {soknad.visningsstatus || FRAVIK_STATUS_LABELS[soknad.status]}
      </span>
    ),
  },
  {
    key: 'sendt_inn',
    label: 'Sendt inn',
    sortable: true,
    sortFn: (a, b, direction) => {
      const aDate = a.sendt_inn_tidspunkt ? new Date(a.sendt_inn_tidspunkt).getTime() : 0;
      const bDate = b.sendt_inn_tidspunkt ? new Date(b.sendt_inn_tidspunkt).getTime() : 0;
      const cmp = aDate - bDate;
      return direction === 'asc' ? cmp : -cmp;
    },
    render: (soknad) => (
      <span className="text-pkt-text-body-subtle">
        {soknad.sendt_inn_tidspunkt ? formatDateShort(soknad.sendt_inn_tidspunkt) : '-'}
      </span>
    ),
  },
];

/**
 * FravikOversiktPage wrapper - handles Suspense boundary
 */
export function FravikOversiktPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback />}>
        <FravikOversiktContent />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Inner component that uses Suspense-enabled query
 */
function FravikOversiktContent() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>('aktive');
  const [showOpprettModal, setShowOpprettModal] = useState(false);

  // Suspense query - data guaranteed to exist
  const { data: soknader } = useSuspenseQuery({
    queryKey: ['fravik-liste'],
    queryFn: fetchFravikListe,
  });

  const filteredSoknader = filterByStatus(soknader, filter);

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Fravik-søknader"
        subtitle="Søknader om fravik fra utslippsfrie krav på byggeplasser"
        maxWidth="wide"
        menuActions={
          <>
            <DropdownMenuItem onClick={() => setShowOpprettModal(true)}>
              Ny søknad
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/fravik-analyse">Analyse</Link>
            </DropdownMenuItem>
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['aktive', 'ferdig', 'all'] as StatusFilter[]).map((filterOption) => (
            <Button
              key={filterOption}
              variant={filter === filterOption ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter(filterOption)}
            >
              {filterOption === 'all'
                ? 'Alle'
                : filterOption === 'aktive'
                ? 'Under behandling'
                : 'Ferdigbehandlet'}
            </Button>
          ))}
        </div>

        {/* Empty State */}
        {filteredSoknader.length === 0 && (
          <Card variant="outlined" padding="lg">
            <div className="text-center py-12">
              <p className="text-pkt-text-body-subtle mb-4">
                Ingen søknader funnet
                {filter !== 'all' && ` med status "${filter === 'aktive' ? 'under behandling' : 'ferdigbehandlet'}"`}
              </p>
              <Button variant="primary" onClick={() => navigate('/fravik/ny')}>
                Opprett ny søknad
              </Button>
            </div>
          </Card>
        )}

        {/* Søknad List */}
        {filteredSoknader.length > 0 && (
          <Card variant="outlined" padding="none">
            <Table
              columns={columns}
              data={filteredSoknader}
              keyExtractor={(soknad) => soknad.sak_id}
              onRowClick={(soknad) => navigate(`/fravik/${soknad.sak_id}`)}
            />
          </Card>
        )}
      </main>

      {/* Opprett søknad modal */}
      <OpprettFravikModal
        open={showOpprettModal}
        onOpenChange={setShowOpprettModal}
      />
    </div>
  );
}

export default FravikOversiktPage;
