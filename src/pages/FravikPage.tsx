/**
 * FravikPage Component
 *
 * Page for viewing and managing a fravik-søknad.
 * Shows søknad details, maskin list, and approval status.
 * Design follows CasePage patterns for consistency.
 *
 * ROLE-BASED VIEW:
 * - SOKER (Entreprenør): See søknad, edit if utkast, see final decision
 * - BH (Byggherre): See søknad read-only, access 4-step approval workflow
 */

import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ReloadIcon } from '@radix-ui/react-icons';
import { Alert, Badge, Button, Card, DataList, DataListItem } from '../components/primitives';
import { useUserRole } from '../hooks/useUserRole';
import { PageHeader } from '../components/PageHeader';
import { STALE_TIME } from '../constants/queryConfig';
import { fetchFravikState, fetchFravikEvents } from '../api/fravik';
import {
  AvbotendeTiltakModal,
  FravikDashboard,
  LeggTilMaskinModal,
  OpprettFravikModal,
  SendInnModal,
  MiljoVurderingModal,
  PLVurderingModal,
  ArbeidsgruppeModal,
  EierBeslutningModal,
} from '../components/fravik';
import type { FravikState, FravikEvent } from '../types/fravik';
import {
  FRAVIK_STATUS_LABELS,
  getFravikStatusColor,
} from '../types/fravik';
import { formatDateShort } from '../utils/formatters';

// ============================================================================
// HOOKS
// ============================================================================

function useFravikState(sakId: string, enabled: boolean = true) {
  return useQuery<FravikState, Error>({
    queryKey: ['fravik', sakId, 'state'],
    queryFn: () => fetchFravikState(sakId),
    staleTime: STALE_TIME.DEFAULT,
    enabled: !!sakId && enabled,
  });
}

function useFravikEvents(sakId: string, enabled: boolean = true) {
  return useQuery<FravikEvent[], Error>({
    queryKey: ['fravik', sakId, 'events'],
    queryFn: () => fetchFravikEvents(sakId),
    staleTime: STALE_TIME.DEFAULT,
    enabled: !!sakId && enabled,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map fravik status to Badge variant
 */
function getStatusBadgeVariant(status: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  const color = getFravikStatusColor(status as any);
  switch (color) {
    case 'green':
      return 'success';
    case 'red':
      return 'danger';
    case 'yellow':
      return 'warning';
    case 'blue':
      return 'info';
    default:
      return 'neutral';
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FravikPage() {
  const { sakId } = useParams<{ sakId: string }>();

  // User role management (same as CasePage)
  const { userRole, setUserRole } = useUserRole();

  // Søker modal state
  const [showRedigerSoknad, setShowRedigerSoknad] = useState(false);
  const [showLeggTilMaskin, setShowLeggTilMaskin] = useState(false);
  const [showAvbotendeTiltak, setShowAvbotendeTiltak] = useState(false);
  const [showSendInn, setShowSendInn] = useState(false);

  // BH vurdering modal state
  const [showMiljoVurdering, setShowMiljoVurdering] = useState(false);
  const [showPLVurdering, setShowPLVurdering] = useState(false);
  const [showArbeidsgruppeVurdering, setShowArbeidsgruppeVurdering] = useState(false);
  const [showEierBeslutning, setShowEierBeslutning] = useState(false);

  const {
    data: state,
    isLoading,
    error,
    refetch,
  } = useFravikState(sakId || '');

  const { data: events = [] } = useFravikEvents(sakId || '');

  // Demo aktor name based on role (TE = Totalentreprenør/Søker, BH = Byggherre)
  const demoAktor = userRole === 'TE' ? 'Entreprenør Demo' : 'Byggherre Demo';

  // Callback to refetch after modal actions
  const handleModalSuccess = () => {
    refetch();
  };

  // Beregn om søknaden kan sendes inn (alle tre spor må være utfylt)
  const kanSendesInn = useMemo(() => {
    if (!state) return false;
    const harSoknadInfo = !!state.prosjekt_navn && !!state.soker_navn;
    const harMaskiner = state.soknad_type === 'machine'
      ? Object.keys(state.maskiner).length > 0
      : true;
    const harAvbotende = !!state.avbotende_tiltak && !!state.konsekvenser_ved_avslag;
    return harSoknadInfo && harMaskiner && harAvbotende;
  }, [state]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle">
        <PageHeader title="Laster søknad..." subtitle="Vennligst vent" />
        <main className="max-w-3xl mx-auto px-2 py-4 sm:px-4 sm:py-6">
          <Card variant="outlined" padding="md">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-sm text-pkt-text-body-subtle">Laster søknad...</span>
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
        <PageHeader title="Feil ved lasting" subtitle="Kunne ikke laste søknad" />
        <main className="max-w-3xl mx-auto px-2 py-4 sm:px-4 sm:py-6">
          <Card variant="outlined" padding="md">
            <div className="text-center py-8">
              <p className="text-sm text-alert-danger-text mb-4">
                Kunne ikke laste søknad: {error?.message || 'Ukjent feil'}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="secondary" size="sm" onClick={() => refetch()}>
                  Prøv igjen
                </Button>
                <Link to="/fravik">
                  <Button variant="primary" size="sm">Tilbake til oversikt</Button>
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
        subtitle={`Fravik-søknad • ${state.sak_id}`}
        userRole={userRole}
        onToggleRole={setUserRole}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(state.status)}>
              {state.visningsstatus || FRAVIK_STATUS_LABELS[state.status]}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <ReloadIcon className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      <main className="max-w-3xl mx-auto px-2 py-4 sm:px-4 sm:py-6 space-y-4">
        {/* Endelig beslutning banner (kun når ferdig) */}
        {state.er_ferdigbehandlet && state.endelig_beslutning && (
          <Alert
            variant={
              state.endelig_beslutning === 'godkjent'
                ? 'success'
                : state.endelig_beslutning === 'avslatt'
                ? 'danger'
                : 'warning'
            }
            title={
              state.endelig_beslutning === 'godkjent'
                ? 'Godkjent'
                : state.endelig_beslutning === 'avslatt'
                ? 'Avslått'
                : 'Delvis godkjent'
            }
          >
            <div className="flex items-center gap-2 text-sm">
              {state.endelig_beslutning_av && (
                <span>av {state.endelig_beslutning_av}</span>
              )}
              {state.endelig_beslutning_tidspunkt && (
                <span>{formatDateShort(state.endelig_beslutning_tidspunkt)}</span>
              )}
            </div>
            {state.endelig_beslutning_kommentar && (
              <p className="text-sm mt-1">{state.endelig_beslutning_kommentar}</p>
            )}
          </Alert>
        )}

        {/* Send inn-alert (kun for TE i utkast) */}
        {userRole === 'TE' && state.status === 'utkast' && (
          <Alert
            variant={kanSendesInn ? 'info' : 'warning'}
            title={kanSendesInn ? 'Klar til innsending' : 'Søknaden er ikke komplett'}
          >
            <p className="text-sm">
              {kanSendesInn
                ? 'Alle påkrevde felter er fylt ut. Du kan nå sende inn søknaden til behandling.'
                : 'Fyll ut alle påkrevde felter før du kan sende inn søknaden.'}
            </p>
            {kanSendesInn && (
              <div className="mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowSendInn(true)}
                >
                  Send inn søknad
                </Button>
              </div>
            )}
          </Alert>
        )}

        {/* Hovedkort: Fravik Dashboard */}
        <section aria-labelledby="fravik-dashboard-heading">
          <Card variant="outlined" padding="md">
            <h2
              id="fravik-dashboard-heading"
              className="text-base font-semibold text-pkt-text-body-dark mb-3"
            >
              Fravik-søknad
            </h2>
            <FravikDashboard
              state={state}
              userRole={userRole}
              // TE actions
              onRedigerSoknad={() => setShowRedigerSoknad(true)}
              onLeggTilMaskin={() => setShowLeggTilMaskin(true)}
              onRedigerAvbotende={() => setShowAvbotendeTiltak(true)}
              // BH actions
              onMiljoVurdering={() => setShowMiljoVurdering(true)}
              onPLVurdering={() => setShowPLVurdering(true)}
              onArbeidsgruppeVurdering={() => setShowArbeidsgruppeVurdering(true)}
              onEierBeslutning={() => setShowEierBeslutning(true)}
            />
          </Card>
        </section>

        {/* Metadata */}
        <section aria-labelledby="metadata-heading">
          <Card variant="outlined" padding="md">
            <h2
              id="metadata-heading"
              className="text-base font-semibold text-pkt-text-body-dark mb-3"
            >
              Metadata
            </h2>
            <DataList variant="grid">
              <DataListItem label="Opprettet">
                {state.opprettet ? formatDateShort(state.opprettet) : '-'}
              </DataListItem>
              <DataListItem label="Sendt inn">
                {state.sendt_inn_tidspunkt ? formatDateShort(state.sendt_inn_tidspunkt) : '-'}
              </DataListItem>
              <DataListItem label="Sist oppdatert">
                {state.siste_oppdatert ? formatDateShort(state.siste_oppdatert) : '-'}
              </DataListItem>
              <DataListItem label="Hendelser">
                {state.antall_events}
              </DataListItem>
            </DataList>
          </Card>
        </section>
      </main>

      {/* TE (Søker) Modals */}
      {sakId && userRole === 'TE' && (
        <>
          <OpprettFravikModal
            open={showRedigerSoknad}
            onOpenChange={setShowRedigerSoknad}
            editMode
            sakId={sakId}
            currentVersion={state.antall_events}
            initialData={{
              prosjekt_navn: state.prosjekt_navn,
              prosjekt_nummer: state.prosjekt_nummer,
              rammeavtale: state.rammeavtale,
              entreprenor: state.entreprenor,
              soker_navn: state.soker_navn,
              soker_epost: state.soker_epost,
              soknad_type: state.soknad_type,
              er_haste: state.er_haste,
              haste_begrunnelse: state.haste_begrunnelse,
              frist_for_svar: state.frist_for_svar,
            }}
            onSuccess={handleModalSuccess}
          />
          <LeggTilMaskinModal
            open={showLeggTilMaskin}
            onOpenChange={setShowLeggTilMaskin}
            sakId={sakId}
            currentVersion={state.antall_events}
            onSuccess={handleModalSuccess}
          />
          <AvbotendeTiltakModal
            open={showAvbotendeTiltak}
            onOpenChange={setShowAvbotendeTiltak}
            sakId={sakId}
            currentVersion={state.antall_events}
            initialData={{
              avbotende_tiltak: state.avbotende_tiltak,
              konsekvenser_ved_avslag: state.konsekvenser_ved_avslag,
            }}
            onSuccess={handleModalSuccess}
          />
          <SendInnModal
            open={showSendInn}
            onOpenChange={setShowSendInn}
            sakId={sakId}
            state={state}
            onSuccess={handleModalSuccess}
          />
        </>
      )}

      {/* BH Vurdering Modals */}
      {sakId && userRole === 'BH' && (
        <>
          <MiljoVurderingModal
            open={showMiljoVurdering}
            onOpenChange={setShowMiljoVurdering}
            sakId={sakId}
            state={state}
            currentVersion={state.antall_events}
            aktor={demoAktor}
            onSuccess={handleModalSuccess}
          />
          <PLVurderingModal
            open={showPLVurdering}
            onOpenChange={setShowPLVurdering}
            sakId={sakId}
            state={state}
            currentVersion={state.antall_events}
            aktor={demoAktor}
            onSuccess={handleModalSuccess}
          />
          <ArbeidsgruppeModal
            open={showArbeidsgruppeVurdering}
            onOpenChange={setShowArbeidsgruppeVurdering}
            sakId={sakId}
            state={state}
            currentVersion={state.antall_events}
            aktor={demoAktor}
            onSuccess={handleModalSuccess}
          />
          <EierBeslutningModal
            open={showEierBeslutning}
            onOpenChange={setShowEierBeslutning}
            sakId={sakId}
            state={state}
            currentVersion={state.antall_events}
            aktor={demoAktor}
            onSuccess={handleModalSuccess}
          />
        </>
      )}
    </div>
  );
}

export default FravikPage;
