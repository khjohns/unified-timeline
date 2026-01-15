/**
 * FravikPage Component
 *
 * Page for viewing and managing a fravik-søknad.
 * Shows søknad details, maskin list, and approval status.
 */

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, ReloadIcon, PlusIcon } from '@radix-ui/react-icons';
import { Alert, Badge, Button, Card } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { STALE_TIME } from '../constants/queryConfig';
import { fetchFravikState, fetchFravikEvents } from '../api/fravik';
import { LeggTilMaskinModal, SendInnModal } from '../components/fravik';
import type { FravikState, FravikEvent, MaskinTilstand } from '../types/fravik';
import {
  FRAVIK_STATUS_LABELS,
  FRAVIK_ROLLE_LABELS,
  MASKIN_TYPE_LABELS,
  getFravikStatusColor,
} from '../types/fravik';
import { formatDateShort } from '../utils/formatters';

// ============================================================================
// HOOKS
// ============================================================================

function useFravikState(soknadId: string, enabled: boolean = true) {
  return useQuery<FravikState, Error>({
    queryKey: ['fravik', soknadId, 'state'],
    queryFn: () => fetchFravikState(soknadId),
    staleTime: STALE_TIME.DEFAULT,
    enabled: !!soknadId && enabled,
  });
}

function useFravikEvents(soknadId: string, enabled: boolean = true) {
  return useQuery<FravikEvent[], Error>({
    queryKey: ['fravik', soknadId, 'events'],
    queryFn: () => fetchFravikEvents(soknadId),
    staleTime: STALE_TIME.DEFAULT,
    enabled: !!soknadId && enabled,
  });
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const DEFAULT_STATUS_CLASS = 'bg-pkt-bg-subtle text-pkt-text-body-subtle';
const STATUS_COLOR_CLASSES: Record<string, string> = {
  gray: DEFAULT_STATUS_CLASS,
  blue: 'bg-oslo-blue-light text-oslo-blue',
  yellow: 'bg-amber-100 text-amber-800',
  green: 'bg-alert-success-light text-alert-success-text',
  red: 'bg-alert-danger-light text-alert-danger-text',
};

function getStatusBadgeClass(color: string): string {
  return STATUS_COLOR_CLASSES[color] ?? DEFAULT_STATUS_CLASS;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const color = getFravikStatusColor(status as any);
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(color)}`}>
      {label}
    </span>
  );
}

function GodkjenningskjedeStepper({ state }: { state: FravikState }) {
  const steps = [
    { key: 'boi', label: 'BOI-rådgiver', steg: state.godkjenningskjede.boi_vurdering },
    { key: 'pl', label: 'Prosjektleder', steg: state.godkjenningskjede.pl_vurdering },
    { key: 'arbeidsgruppe', label: 'Arbeidsgruppe', steg: state.godkjenningskjede.arbeidsgruppe_vurdering },
    { key: 'eier', label: 'Eier', steg: state.godkjenningskjede.eier_beslutning },
  ];

  const gjeldende = state.godkjenningskjede.gjeldende_steg;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, index) => {
        const isActive = step.key === gjeldende;
        const isComplete = step.steg.fullfort;
        const isPending = !isComplete && !isActive;

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap
                ${isComplete ? 'bg-alert-success-light text-alert-success-text' : ''}
                ${isActive ? 'bg-oslo-blue-light text-oslo-blue font-medium' : ''}
                ${isPending ? 'bg-pkt-bg-subtle text-pkt-text-body-subtle' : ''}
              `}
            >
              <span
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                  ${isComplete ? 'bg-alert-success-text text-white' : ''}
                  ${isActive ? 'bg-oslo-blue text-white' : ''}
                  ${isPending ? 'bg-pkt-border-default text-pkt-text-body-subtle' : ''}
                `}
              >
                {isComplete ? '✓' : index + 1}
              </span>
              {step.label}
            </div>
            {index < steps.length - 1 && (
              <div className="w-8 h-0.5 bg-pkt-border-default mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MaskinKort({ maskin }: { maskin: MaskinTilstand }) {
  const statusLabel = maskin.samlet_status === 'ikke_vurdert'
    ? 'Ikke vurdert'
    : maskin.samlet_status === 'godkjent'
    ? 'Godkjent'
    : maskin.samlet_status === 'avslatt'
    ? 'Avslått'
    : 'Delvis godkjent';

  const statusColor = maskin.samlet_status === 'godkjent'
    ? 'green'
    : maskin.samlet_status === 'avslatt'
    ? 'red'
    : maskin.samlet_status === 'delvis_godkjent'
    ? 'yellow'
    : 'gray';

  return (
    <Card variant="outlined" padding="md">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-medium text-pkt-text-heading">
            {MASKIN_TYPE_LABELS[maskin.maskin_type] || maskin.maskin_type}
            {maskin.annet_type && `: ${maskin.annet_type}`}
          </h4>
          {maskin.registreringsnummer && (
            <p className="text-sm text-pkt-text-body-subtle">
              Reg.nr: {maskin.registreringsnummer}
            </p>
          )}
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(statusColor)}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-pkt-text-body-subtle">Periode</p>
          <p className="text-pkt-text-body">
            {formatDateShort(maskin.start_dato)} - {formatDateShort(maskin.slutt_dato)}
          </p>
        </div>
        <div>
          <p className="text-pkt-text-body-subtle">Markedsundersøkelse</p>
          <p className="text-pkt-text-body">{maskin.markedsundersokelse ? 'Ja' : 'Nei'}</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-pkt-text-body-subtle text-sm">Begrunnelse</p>
        <p className="text-pkt-text-body text-sm mt-1">{maskin.begrunnelse}</p>
      </div>

      {maskin.erstatningsmaskin && (
        <div className="mt-3 p-2 bg-pkt-bg-subtle rounded">
          <p className="text-pkt-text-body-subtle text-xs">Erstatningsmaskin</p>
          <p className="text-pkt-text-body text-sm">
            {maskin.erstatningsmaskin}
            {maskin.erstatningsdrivstoff && ` (${maskin.erstatningsdrivstoff})`}
          </p>
        </div>
      )}
    </Card>
  );
}

function SoknadOversikt({ state }: { state: FravikState }) {
  return (
    <Card variant="outlined" padding="md">
      <h3 className="text-lg font-semibold text-pkt-text-heading mb-4">Søknadsoversikt</h3>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-pkt-text-body-subtle">Prosjekt</dt>
          <dd className="text-pkt-text-body font-medium">{state.prosjekt_navn}</dd>
          {state.prosjekt_nummer && (
            <dd className="text-pkt-text-body-subtle text-xs">{state.prosjekt_nummer}</dd>
          )}
        </div>

        <div>
          <dt className="text-pkt-text-body-subtle">Søker</dt>
          <dd className="text-pkt-text-body">{state.soker_navn}</dd>
          {state.soker_epost && (
            <dd className="text-pkt-text-body-subtle text-xs">{state.soker_epost}</dd>
          )}
        </div>

        {state.hovedentreprenor && (
          <div>
            <dt className="text-pkt-text-body-subtle">Hovedentreprenør</dt>
            <dd className="text-pkt-text-body">{state.hovedentreprenor}</dd>
          </div>
        )}

        {state.rammeavtale && (
          <div>
            <dt className="text-pkt-text-body-subtle">Rammeavtale</dt>
            <dd className="text-pkt-text-body">{state.rammeavtale}</dd>
          </div>
        )}

        <div>
          <dt className="text-pkt-text-body-subtle">Type søknad</dt>
          <dd className="text-pkt-text-body">
            {state.soknad_type === 'machine' ? 'Maskin' : 'Infrastruktur'}
          </dd>
        </div>

        {state.frist_for_svar && (
          <div>
            <dt className="text-pkt-text-body-subtle">Ønsket frist</dt>
            <dd className="text-pkt-text-body">{formatDateShort(state.frist_for_svar)}</dd>
          </div>
        )}

        {state.er_haste && (
          <div className="sm:col-span-2">
            <dt className="text-pkt-text-body-subtle">Hastebehandling</dt>
            <dd className="text-alert-danger-text">
              Ja{state.haste_begrunnelse && `: ${state.haste_begrunnelse}`}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}

function NesteHandlingKort({ state }: { state: FravikState }) {
  if (state.er_ferdigbehandlet) {
    return null;
  }

  const { rolle, handling } = state.neste_handling;

  return (
    <Alert variant="info" className="mb-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">Neste handling:</span>
        <span>
          {rolle && FRAVIK_ROLLE_LABELS[rolle]} - {handling}
        </span>
      </div>
    </Alert>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FravikPage() {
  const { soknadId } = useParams<{ soknadId: string }>();
  const queryClient = useQueryClient();

  // Modal state
  const [showLeggTilMaskin, setShowLeggTilMaskin] = useState(false);
  const [showSendInn, setShowSendInn] = useState(false);

  const {
    data: state,
    isLoading,
    error,
    refetch,
  } = useFravikState(soknadId || '');

  const { data: events = [] } = useFravikEvents(soknadId || '');

  const maskiner = useMemo(() => {
    if (!state) return [];
    return Object.values(state.maskiner);
  }, [state]);

  // Callback to refetch after modal actions
  const handleMaskinAdded = () => {
    refetch();
  };

  const handleSendtInn = () => {
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle">
        <PageHeader title="Laster søknad..." subtitle="Vennligst vent" maxWidth="wide" />
        <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-pkt-text-body-subtle">Laster søknad...</span>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Error state
  if (error || !state) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle">
        <PageHeader title="Feil ved lasting" subtitle="Kunne ikke laste søknad" maxWidth="wide" />
        <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <Card variant="outlined" padding="lg">
            <div className="text-center py-12">
              <p className="text-alert-danger-text mb-4">
                Kunne ikke laste søknad: {error?.message || 'Ukjent feil'}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="secondary" onClick={() => refetch()}>
                  Prøv igjen
                </Button>
                <Link to="/fravik">
                  <Button variant="primary">Tilbake til oversikt</Button>
                </Link>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title={state.prosjekt_navn}
        subtitle={`Fravik-søknad • ${state.soknad_id}`}
        maxWidth="wide"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge
              status={state.status}
              label={state.visningsstatus || FRAVIK_STATUS_LABELS[state.status]}
            />
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <ReloadIcon className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Tilbake-lenke */}
        <Link
          to="/fravik"
          className="inline-flex items-center gap-1 text-sm text-oslo-blue hover:underline"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Tilbake til oversikt
        </Link>

        {/* Neste handling */}
        <NesteHandlingKort state={state} />

        {/* Godkjenningskjede */}
        <Card variant="outlined" padding="md">
          <h3 className="text-lg font-semibold text-pkt-text-heading mb-4">Godkjenningskjede</h3>
          <GodkjenningskjedeStepper state={state} />
        </Card>

        {/* Søknadsoversikt */}
        <SoknadOversikt state={state} />

        {/* Maskiner */}
        {state.soknad_type === 'machine' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-pkt-text-heading">
                Maskiner ({maskiner.length})
              </h3>
              {state.status === 'utkast' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowLeggTilMaskin(true)}
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Legg til maskin
                </Button>
              )}
            </div>
            {maskiner.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {maskiner.map((maskin) => (
                  <MaskinKort key={maskin.maskin_id} maskin={maskin} />
                ))}
              </div>
            ) : (
              <Card variant="outlined" padding="md">
                <p className="text-pkt-text-body-subtle text-center">
                  Ingen maskiner lagt til ennå.
                  {state.status === 'utkast' && ' Klikk "Legg til maskin" for å starte.'}
                </p>
              </Card>
            )}
          </section>
        )}

        {/* Handlinger for utkast */}
        {state.status === 'utkast' && (
          <Card variant="outlined" padding="md" className="bg-oslo-blue-light/10">
            <h3 className="text-lg font-semibold text-pkt-text-heading mb-3">Handlinger</h3>
            <div className="flex flex-wrap gap-3">
              {state.soknad_type === 'machine' && (
                <Button
                  variant="secondary"
                  onClick={() => setShowLeggTilMaskin(true)}
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Legg til maskin
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => setShowSendInn(true)}
                disabled={!state.kan_sendes_inn}
              >
                Send inn søknad
              </Button>
            </div>
            {!state.kan_sendes_inn && state.antall_maskiner === 0 && (
              <p className="text-sm text-pkt-text-body-subtle mt-3">
                Du må legge til minst én maskin før du kan sende inn søknaden.
              </p>
            )}
          </Card>
        )}

        {/* Endelig beslutning */}
        {state.er_ferdigbehandlet && state.endelig_beslutning && (
          <Card
            variant="outlined"
            padding="md"
            className={
              state.endelig_beslutning === 'godkjent'
                ? 'border-alert-success-text'
                : state.endelig_beslutning === 'avslatt'
                ? 'border-alert-danger-text'
                : 'border-amber-500'
            }
          >
            <h3 className="text-lg font-semibold text-pkt-text-heading mb-2">
              Endelig beslutning
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge
                status={state.endelig_beslutning}
                label={
                  state.endelig_beslutning === 'godkjent'
                    ? 'Godkjent'
                    : state.endelig_beslutning === 'avslatt'
                    ? 'Avslått'
                    : 'Delvis godkjent'
                }
              />
              {state.endelig_beslutning_av && (
                <span className="text-sm text-pkt-text-body-subtle">
                  av {state.endelig_beslutning_av}
                </span>
              )}
              {state.endelig_beslutning_tidspunkt && (
                <span className="text-sm text-pkt-text-body-subtle">
                  {formatDateShort(state.endelig_beslutning_tidspunkt)}
                </span>
              )}
            </div>
            {state.endelig_beslutning_kommentar && (
              <p className="text-sm text-pkt-text-body mt-2">
                {state.endelig_beslutning_kommentar}
              </p>
            )}
          </Card>
        )}

        {/* Metadata */}
        <Card variant="outlined" padding="md">
          <h3 className="text-lg font-semibold text-pkt-text-heading mb-3">Metadata</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-pkt-text-body-subtle">Opprettet</dt>
              <dd className="text-pkt-text-body">
                {state.opprettet ? formatDateShort(state.opprettet) : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-pkt-text-body-subtle">Sendt inn</dt>
              <dd className="text-pkt-text-body">
                {state.sendt_inn_tidspunkt ? formatDateShort(state.sendt_inn_tidspunkt) : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-pkt-text-body-subtle">Sist oppdatert</dt>
              <dd className="text-pkt-text-body">
                {state.siste_oppdatert ? formatDateShort(state.siste_oppdatert) : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-pkt-text-body-subtle">Antall hendelser</dt>
              <dd className="text-pkt-text-body">{state.antall_events}</dd>
            </div>
          </dl>
        </Card>
      </main>

      {/* Modals */}
      {soknadId && (
        <>
          <LeggTilMaskinModal
            open={showLeggTilMaskin}
            onOpenChange={setShowLeggTilMaskin}
            soknadId={soknadId}
            onSuccess={handleMaskinAdded}
          />
          <SendInnModal
            open={showSendInn}
            onOpenChange={setShowSendInn}
            soknadId={soknadId}
            state={state}
            onSuccess={handleSendtInn}
          />
        </>
      )}
    </div>
  );
}

export default FravikPage;
