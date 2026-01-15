/**
 * FravikOversiktPage Component
 *
 * Shows an overview of all fravik-søknader.
 * Allows navigating to individual søknader and creating new ones.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card } from '../components/primitives';
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

export function FravikOversiktPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>('aktive');
  const [showOpprettModal, setShowOpprettModal] = useState(false);

  const { data: soknader = [], isLoading, error } = useQuery({
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
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowOpprettModal(true)}
          >
            Ny søknad
          </Button>
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

        {/* Loading State */}
        {isLoading && (
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-pkt-text-body-subtle">Laster søknader...</span>
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Card variant="outlined" padding="lg">
            <div className="text-center py-12">
              <p className="text-alert-danger-text mb-4">
                Kunne ikke laste søknader: {error instanceof Error ? error.message : 'Ukjent feil'}
              </p>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Prøv igjen
              </Button>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredSoknader.length === 0 && (
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
        {!isLoading && !error && filteredSoknader.length > 0 && (
          <Card variant="outlined" padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pkt-border-default bg-pkt-bg-muted">
                    <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">
                      Prosjekt
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">
                      Søker
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">
                      Type
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-pkt-text-body-subtle">
                      Maskiner
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">
                      Sendt inn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSoknader.map((soknad) => (
                    <tr
                      key={soknad.sak_id}
                      className="border-b border-pkt-border-default hover:bg-pkt-bg-muted cursor-pointer transition-colors"
                      onClick={() => navigate(`/fravik/${soknad.sak_id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-pkt-text-heading">
                          {soknad.prosjekt_navn}
                        </div>
                        {soknad.prosjekt_nummer && (
                          <div className="text-xs text-pkt-text-body-subtle">
                            {soknad.prosjekt_nummer}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-pkt-text-body">
                        {soknad.soker_navn}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-full text-xs bg-pkt-bg-muted text-pkt-text-body">
                          {soknad.soknad_type === 'machine' ? 'Maskin' : 'Infrastruktur'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-pkt-text-body">
                        {soknad.antall_maskiner}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(soknad.status)}`}
                        >
                          {soknad.visningsstatus || FRAVIK_STATUS_LABELS[soknad.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-pkt-text-body-subtle">
                        {soknad.sendt_inn_tidspunkt
                          ? formatDateShort(soknad.sendt_inn_tidspunkt)
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
