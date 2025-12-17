/**
 * EndringsordePage Component
 *
 * Page for viewing an endringsordre (change order) case.
 * Shows EO status, amount details, related KOE cases,
 * and a combined timeline of events from all related cases.
 *
 * Endringsordre (EO) is the formal document that confirms a change in the contract.
 * An EO can combine multiple KOE (Krav om Endringsordre) cases.
 */

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCaseState } from '../hooks/useCaseState';
import { useUserRole } from '../hooks/useUserRole';
import { Timeline } from '../components/views/Timeline';
import { Button } from '../components/primitives/Button';
import { Badge } from '../components/primitives/Badge';
import { Alert } from '../components/primitives/Alert';
import { PageHeader } from '../components/PageHeader';
import {
  ReloadIcon,
  ArrowLeftIcon,
  PlusIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  Pencil1Icon,
} from '@radix-ui/react-icons';
import type {
  EndringsordreData,
  EOStatus,
  EOKonsekvenser,
  TimelineEntry,
  SakRelasjon,
  VederlagsMetode,
} from '../types/timeline';

// ============================================================================
// DEFAULT STATE
// ============================================================================

const EMPTY_KONSEKVENSER: EOKonsekvenser = {
  sha: false,
  kvalitet: false,
  fremdrift: false,
  pris: false,
  annet: false,
};

const EMPTY_EO_DATA: EndringsordreData = {
  relaterte_koe_saker: [],
  eo_nummer: '',
  revisjon_nummer: 0,
  beskrivelse: '',
  konsekvenser: EMPTY_KONSEKVENSER,
  er_estimat: false,
  status: 'utkast',
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function EOStatusBadge({ status }: { status: EOStatus }) {
  const variants: Record<EOStatus, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string }> = {
    utkast: { variant: 'default', label: 'Utkast' },
    utstedt: { variant: 'warning', label: 'Utstedt' },
    akseptert: { variant: 'success', label: 'Akseptert' },
    bestridt: { variant: 'danger', label: 'Bestridt' },
    revidert: { variant: 'warning', label: 'Revidert' },
  };

  const { variant, label } = variants[status] || variants.utkast;

  return <Badge variant={variant}>{label}</Badge>;
}

function KonsekvensChips({ konsekvenser }: { konsekvenser: EOKonsekvenser }) {
  const aktive: string[] = [];
  if (konsekvenser.sha) aktive.push('SHA');
  if (konsekvenser.kvalitet) aktive.push('Kvalitet');
  if (konsekvenser.fremdrift) aktive.push('Fremdrift');
  if (konsekvenser.pris) aktive.push('Pris');
  if (konsekvenser.annet) aktive.push('Annet');

  if (aktive.length === 0) {
    return <span className="text-pkt-text-body-subtle text-sm">Ingen konsekvenser</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {aktive.map((k) => (
        <Badge key={k} variant="default" size="sm">{k}</Badge>
      ))}
    </div>
  );
}

function OppgjorsformLabel({ metode }: { metode?: VederlagsMetode }) {
  const labels: Record<VederlagsMetode, string> = {
    ENHETSPRISER: 'Enhetspriser (§34.3)',
    REGNINGSARBEID: 'Regningsarbeid (§30.2/§34.4)',
    FASTPRIS_TILBUD: 'Fastpris / Tilbud (§34.2.1)',
  };

  if (!metode) return <span className="text-pkt-text-body-subtle">Ikke angitt</span>;
  return <span>{labels[metode] || metode}</span>;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '–';
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// DASHBOARD COMPONENT
// ============================================================================

function EODashboard({
  eoData,
  userRole,
  onAksepter,
  onBestrid,
  onRevider,
}: {
  eoData: EndringsordreData;
  userRole: 'TE' | 'BH';
  onAksepter?: () => void;
  onBestrid?: () => void;
  onRevider?: () => void;
}) {
  const kanAkseptere = userRole === 'TE' && eoData.status === 'utstedt';
  const kanBestride = userRole === 'TE' && eoData.status === 'utstedt';
  const kanRevidere = userRole === 'BH' && eoData.status === 'bestridt';

  return (
    <div className="bg-pkt-bg-card border border-pkt-border-default rounded-lg p-4 sm:p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-pkt-text-body-dark">
            Endringsordre {eoData.eo_nummer}
          </h3>
          {eoData.revisjon_nummer > 0 && (
            <p className="text-sm text-pkt-text-body-subtle">
              Revisjon {eoData.revisjon_nummer}
            </p>
          )}
        </div>
        <EOStatusBadge status={eoData.status} />
      </div>

      <div className="space-y-4">
        {/* Beskrivelse */}
        <div>
          <dt className="text-sm font-medium text-pkt-text-body-subtle mb-1">Beskrivelse</dt>
          <dd className="text-sm text-pkt-text-body-dark">{eoData.beskrivelse || '–'}</dd>
        </div>

        {/* Konsekvenser */}
        <div>
          <dt className="text-sm font-medium text-pkt-text-body-subtle mb-1">Konsekvenser</dt>
          <dd>
            <KonsekvensChips konsekvenser={eoData.konsekvenser} />
          </dd>
        </div>

        {eoData.konsekvens_beskrivelse && (
          <div>
            <dt className="text-sm font-medium text-pkt-text-body-subtle mb-1">Beskrivelse av konsekvenser</dt>
            <dd className="text-sm text-pkt-text-body-dark">{eoData.konsekvens_beskrivelse}</dd>
          </div>
        )}

        {/* Dato utstedt */}
        {eoData.dato_utstedt && (
          <div>
            <dt className="text-sm font-medium text-pkt-text-body-subtle mb-1">Dato utstedt</dt>
            <dd className="text-sm text-pkt-text-body-dark">
              {new Date(eoData.dato_utstedt).toLocaleDateString('nb-NO')}
            </dd>
          </div>
        )}

        {/* TE respons */}
        {eoData.te_akseptert !== undefined && (
          <div className="pt-3 border-t border-pkt-border-subtle">
            <dt className="text-sm font-medium text-pkt-text-body-subtle mb-1">TE-respons</dt>
            <dd className="flex items-center gap-2">
              {eoData.te_akseptert ? (
                <>
                  <CheckCircledIcon className="w-4 h-4 text-pkt-status-success" />
                  <span className="text-sm text-pkt-text-body-dark">Akseptert</span>
                </>
              ) : (
                <>
                  <CrossCircledIcon className="w-4 h-4 text-pkt-status-danger" />
                  <span className="text-sm text-pkt-text-body-dark">Bestridt</span>
                </>
              )}
            </dd>
            {eoData.te_kommentar && (
              <p className="text-sm text-pkt-text-body-subtle mt-1">{eoData.te_kommentar}</p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(kanAkseptere || kanBestride || kanRevidere) && (
        <div className="mt-6 pt-4 border-t border-pkt-border-subtle flex flex-wrap gap-2">
          {kanAkseptere && (
            <Button variant="primary" size="sm" onClick={onAksepter}>
              <CheckCircledIcon className="w-4 h-4 mr-1" />
              Aksepter EO
            </Button>
          )}
          {kanBestride && (
            <Button variant="secondary" size="sm" onClick={onBestrid}>
              <CrossCircledIcon className="w-4 h-4 mr-1" />
              Bestrid EO
            </Button>
          )}
          {kanRevidere && (
            <Button variant="primary" size="sm" onClick={onRevider}>
              <Pencil1Icon className="w-4 h-4 mr-1" />
              Revider EO
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BELØPSKORT COMPONENT
// ============================================================================

function EOBelopskort({ eoData }: { eoData: EndringsordreData }) {
  const harPriskonsekvens = eoData.konsekvenser.pris || (eoData.netto_belop !== undefined && eoData.netto_belop !== 0);
  const harFristkonsekvens = eoData.konsekvenser.fremdrift || (eoData.frist_dager !== undefined && eoData.frist_dager > 0);

  if (!harPriskonsekvens && !harFristkonsekvens) {
    return null;
  }

  return (
    <div className="bg-pkt-bg-card border border-pkt-border-default rounded-lg p-4 sm:p-6">
      <h3 className="text-base font-semibold text-pkt-text-body-dark mb-4">Økonomiske konsekvenser</h3>

      <dl className="grid grid-cols-2 gap-4">
        {/* Oppgjørsform */}
        {harPriskonsekvens && (
          <div className="col-span-2">
            <dt className="text-sm font-medium text-pkt-text-body-subtle">Oppgjørsform</dt>
            <dd className="text-sm text-pkt-text-body-dark mt-1">
              <OppgjorsformLabel metode={eoData.oppgjorsform} />
            </dd>
          </div>
        )}

        {/* Kompensasjon */}
        {eoData.kompensasjon_belop !== undefined && eoData.kompensasjon_belop > 0 && (
          <div>
            <dt className="text-sm font-medium text-pkt-text-body-subtle">Kompensasjon</dt>
            <dd className="text-lg font-semibold text-pkt-status-success mt-1">
              + {formatCurrency(eoData.kompensasjon_belop)}
              {eoData.er_estimat && <span className="text-sm font-normal text-pkt-text-body-subtle ml-1">(estimat)</span>}
            </dd>
          </div>
        )}

        {/* Fradrag */}
        {eoData.fradrag_belop !== undefined && eoData.fradrag_belop > 0 && (
          <div>
            <dt className="text-sm font-medium text-pkt-text-body-subtle">Fradrag</dt>
            <dd className="text-lg font-semibold text-pkt-status-danger mt-1">
              - {formatCurrency(eoData.fradrag_belop)}
            </dd>
          </div>
        )}

        {/* Netto */}
        {eoData.netto_belop !== undefined && eoData.netto_belop !== 0 && (
          <div className="col-span-2 pt-3 border-t border-pkt-border-subtle">
            <dt className="text-sm font-medium text-pkt-text-body-subtle">Netto</dt>
            <dd className={`text-xl font-bold mt-1 ${eoData.netto_belop >= 0 ? 'text-pkt-status-success' : 'text-pkt-status-danger'}`}>
              {eoData.netto_belop >= 0 ? '+ ' : ''}{formatCurrency(eoData.netto_belop)}
            </dd>
          </div>
        )}

        {/* Fristforlengelse */}
        {harFristkonsekvens && (
          <div className="col-span-2 pt-3 border-t border-pkt-border-subtle">
            <dt className="text-sm font-medium text-pkt-text-body-subtle">Fristforlengelse</dt>
            <dd className="text-lg font-semibold text-pkt-text-body-dark mt-1">
              {eoData.frist_dager || 0} dager
              {eoData.ny_sluttdato && (
                <span className="text-sm font-normal text-pkt-text-body-subtle ml-2">
                  (ny sluttdato: {new Date(eoData.ny_sluttdato).toLocaleDateString('nb-NO')})
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// ============================================================================
// RELATERTE KOE LISTE COMPONENT
// ============================================================================

function RelatertKOEListe({
  relaterteSaker,
  sakStates,
  canRemove,
  onRemove,
  isRemoving,
  headerAction,
}: {
  relaterteSaker: SakRelasjon[];
  sakStates?: Record<string, { sakstittel?: string; overordnet_status?: string }>;
  canRemove?: boolean;
  onRemove?: (sakId: string) => void;
  isRemoving?: boolean;
  headerAction?: React.ReactNode;
}) {
  if (relaterteSaker.length === 0) {
    return (
      <div className="bg-pkt-bg-card border border-pkt-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-pkt-text-body-dark">Relaterte KOE-er</h3>
          {headerAction}
        </div>
        <p className="text-sm text-pkt-text-body-subtle">Ingen relaterte KOE-saker.</p>
      </div>
    );
  }

  return (
    <div className="bg-pkt-bg-card border border-pkt-border-default rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-pkt-text-body-dark">
          Relaterte KOE-er ({relaterteSaker.length})
        </h3>
        {headerAction}
      </div>
      <ul className="space-y-2">
        {relaterteSaker.map((relasjon) => {
          const sakState = sakStates?.[relasjon.relatert_sak_id];
          const tittel = relasjon.relatert_sak_tittel || sakState?.sakstittel || `KOE ${relasjon.relatert_sak_id.slice(0, 8)}`;

          return (
            <li
              key={relasjon.relatert_sak_id}
              className="flex items-center justify-between p-2 bg-pkt-bg-subtle rounded"
            >
              <Link
                to={`/saker/${relasjon.relatert_sak_id}`}
                className="text-sm text-pkt-text-action-active hover:underline flex-1"
              >
                {tittel}
                {relasjon.bimsync_issue_number && (
                  <span className="text-pkt-text-body-subtle ml-1">
                    (#{relasjon.bimsync_issue_number})
                  </span>
                )}
              </Link>
              {canRemove && onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(relasjon.relatert_sak_id)}
                  disabled={isRemoving}
                  className="ml-2"
                >
                  <CrossCircledIcon className="w-4 h-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EndringsordePage() {
  const { sakId } = useParams<{ sakId: string }>();
  const { userRole, setUserRole } = useUserRole();
  const queryClient = useQueryClient();

  // Modal state (for future implementation)
  const [aksepterModalOpen, setAksepterModalOpen] = useState(false);
  const [bestridModalOpen, setBestridModalOpen] = useState(false);
  const [reviderModalOpen, setReviderModalOpen] = useState(false);
  const [leggTilKOEModalOpen, setLeggTilKOEModalOpen] = useState(false);

  // Fetch EO case state
  const {
    data: caseData,
    isLoading: caseLoading,
    error: caseError,
    refetch: refetchCase,
  } = useCaseState(sakId || '');

  const state = caseData?.state;
  const eoData = state?.endringsordre_data || EMPTY_EO_DATA;

  // TODO: Fetch EO context (related KOE cases, their states and events)
  // Similar to useForseringKontekst but for EO
  const relaterteSaker = state?.relaterte_saker || [];

  // Combine timeline events (placeholder - will be populated when API is ready)
  const eoTimeline = useMemo((): TimelineEntry[] => {
    // Will be populated from kontekstData when API is implemented
    return [];
  }, []);

  const relatedCasesTimeline = useMemo((): TimelineEntry[] => {
    // Will be populated from kontekstData when API is implemented
    return [];
  }, []);

  // Loading state
  if (caseLoading) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center">
        <div className="text-center">
          <ReloadIcon className="w-8 h-8 animate-spin mx-auto mb-4 text-pkt-text-action-active" />
          <p className="text-pkt-text-body-subtle">Laster endringsordre...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (caseError) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle p-8">
        <div className="max-w-2xl mx-auto">
          <Alert variant="danger" title="Kunne ikke laste endringsordre">
            <p>{caseError.message}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetchCase()}
              className="mt-4"
            >
              <ReloadIcon className="w-4 h-4 mr-2" />
              Prøv igjen
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  // Check if this is actually an EO case
  if (state && state.sakstype !== 'endringsordre') {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle p-8">
        <div className="max-w-2xl mx-auto">
          <Alert variant="warning" title="Ikke en endringsordre">
            <p>Denne saken er ikke en endringsordre. Gå til vanlig sakvisning.</p>
            <Link to={`/saker/${sakId}`}>
              <Button variant="secondary" size="sm" className="mt-4">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Gå til sak
              </Button>
            </Link>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header */}
      <PageHeader
        title={state?.sakstittel || `Endringsordre ${eoData.eo_nummer}`}
        subtitle={`EO ${eoData.eo_nummer}${eoData.revisjon_nummer > 0 ? ` rev. ${eoData.revisjon_nummer}` : ''}`}
        userRole={userRole}
        onToggleRole={setUserRole}
      />

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-8 sm:py-8 bg-pkt-bg-card min-h-[calc(100vh-88px)]">
        <div className="space-y-6">
          {/* Status and details section */}
          <section>
            <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Status og detaljer
            </h2>
            <div className="space-y-4">
              <EODashboard
                eoData={eoData}
                userRole={userRole}
                onAksepter={() => setAksepterModalOpen(true)}
                onBestrid={() => setBestridModalOpen(true)}
                onRevider={() => setReviderModalOpen(true)}
              />
              <EOBelopskort eoData={eoData} />
            </div>
          </section>

          {/* Related KOE cases section */}
          <section>
            <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Relaterte KOE-saker
            </h2>
            <RelatertKOEListe
              relaterteSaker={relaterteSaker}
              canRemove={userRole === 'BH' && eoData.status === 'utkast'}
              headerAction={
                userRole === 'BH' && eoData.status === 'utkast' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLeggTilKOEModalOpen(true)}
                  >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Legg til KOE
                  </Button>
                )
              }
            />
          </section>

          {/* EO case's own timeline */}
          <section className="mt-6 sm:mt-8">
            <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Hendelser for denne endringsordren
            </h2>

            {eoTimeline.length > 0 ? (
              <Timeline events={eoTimeline} />
            ) : (
              <p className="text-pkt-text-body-subtle text-sm">
                Ingen hendelser ennå.
              </p>
            )}
          </section>

          {/* Timeline from related KOE cases */}
          {relaterteSaker.length > 0 && (
            <section className="mt-6 sm:mt-8">
              <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
                Hendelser fra relaterte KOE-saker
              </h2>

              {relatedCasesTimeline.length > 0 ? (
                <Timeline events={relatedCasesTimeline} />
              ) : (
                <p className="text-pkt-text-body-subtle text-sm">
                  Ingen hendelser fra relaterte saker.
                </p>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Modals (placeholder for future implementation) */}
      {/* TODO: Implement modals for aksepter, bestrid, revider, legg til KOE */}
    </div>
  );
}
