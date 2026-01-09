/**
 * ForseringPage Component
 *
 * Page for viewing a forsering (acceleration) case.
 * Shows forsering status, cost calculations, related cases,
 * and a combined timeline of events from all related cases.
 */

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE_TIME } from '../constants/queryConfig';
import { useAuth } from '../context/AuthContext';
import { getAuthToken, ApiError } from '../api/client';
import { useVerifyToken } from '../hooks/useVerifyToken';
import { useCaseState } from '../hooks/useCaseState';
import { useUserRole } from '../hooks/useUserRole';
import { useStandpunktEndringer } from '../hooks/useStandpunktEndringer';
import { Timeline } from '../components/views/Timeline';
import { Alert, Badge, Button } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { TokenExpiredAlert } from '../components/alerts/TokenExpiredAlert';
import {
  ForseringDashboard,
  ForseringKostnadskort,
  RelaterteSakerListe,
  LeggTilRelatertSakModal,
  StoppForseringModal,
  BHResponsForseringModal,
  OppdaterKostnaderModal,
} from '../components/forsering';
import {
  ReloadIcon,
  ArrowLeftIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import {
  VerifyingState,
  AuthErrorState,
  LoadingState,
  ErrorState,
} from '../components/PageStateHelpers';
import type { ForseringData, TimelineEvent, SakRelasjon } from '../types/timeline';
import {
  fetchForseringKontekst,
  fetchKandidatSaker,
  leggTilRelaterteSaker,
  fjernRelatertSak,
  stoppForsering,
  oppdaterKostnader,
  type ForseringKontekstResponse,
  type KandidatSak,
} from '../api/forsering';

// ============================================================================
// HOOKS
// ============================================================================

function useForseringKontekst(sakId: string, enabled: boolean = true) {
  return useQuery<ForseringKontekstResponse, Error>({
    queryKey: ['forsering', sakId, 'kontekst'],
    queryFn: () => fetchForseringKontekst(sakId),
    staleTime: STALE_TIME.DEFAULT,
    enabled: !!sakId && enabled,
  });
}

function useKandidatSaker() {
  return useQuery<{ success: boolean; kandidat_saker: KandidatSak[] }, Error>({
    queryKey: ['forsering', 'kandidater'],
    queryFn: fetchKandidatSaker,
    staleTime: STALE_TIME.EXTENDED,
  });
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const EMPTY_FORSERING_DATA: ForseringData = {
  avslatte_fristkrav: [],
  dato_varslet: '',
  estimert_kostnad: 0,
  bekreft_30_prosent_regel: false,
  avslatte_dager: 0,
  dagmulktsats: 0,
  maks_forseringskostnad: 0,
  er_iverksatt: false,
  er_stoppet: false,
  kostnad_innenfor_grense: false,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ForseringPage() {
  const { sakId } = useParams<{ sakId: string }>();
  const { token, isVerifying, error: authError } = useAuth();
  const { userRole, setUserRole } = useUserRole();
  const queryClient = useQueryClient();
  const verifyToken = useVerifyToken();

  // Modal state
  const [leggTilModalOpen, setLeggTilModalOpen] = useState(false);
  const [stoppModalOpen, setStoppModalOpen] = useState(false);
  const [bhResponsModalOpen, setBhResponsModalOpen] = useState(false);
  const [kostnaderModalOpen, setKostnaderModalOpen] = useState(false);
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [showCatendaWarning, setShowCatendaWarning] = useState(false);

  // Fetch forsering case state (wait for auth)
  const {
    data: caseData,
    isLoading: caseLoading,
    error: caseError,
    refetch: refetchCase,
  } = useCaseState(sakId || '', { enabled: !!token && !isVerifying });

  // Fetch related cases context (wait for auth)
  const {
    data: kontekstData,
    isLoading: kontekstLoading,
    error: kontekstError,
  } = useForseringKontekst(sakId || '', !!token && !isVerifying);

  // Fetch candidate cases for adding
  const { data: kandidatData } = useKandidatSaker();

  // Mutation for adding related cases
  const leggTilMutation = useMutation({
    mutationFn: async (sakIds: string[]) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error('TOKEN_MISSING');
      const isValid = await verifyToken(currentToken);
      if (!isValid) throw new Error('TOKEN_EXPIRED');
      return leggTilRelaterteSaker({
        forsering_sak_id: sakId || '',
        relatert_sak_ids: sakIds,
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      }
    },
  });

  // Mutation for removing related cases
  const fjernMutation = useMutation({
    mutationFn: async (relatertSakId: string) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error('TOKEN_MISSING');
      const isValid = await verifyToken(currentToken);
      if (!isValid) throw new Error('TOKEN_EXPIRED');
      return fjernRelatertSak({
        forsering_sak_id: sakId || '',
        relatert_sak_id: relatertSakId,
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      }
    },
  });

  // Mutation for stopping forsering
  const stoppMutation = useMutation({
    mutationFn: async (data: { begrunnelse: string; paalopte_kostnader?: number }) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error('TOKEN_MISSING');
      const isValid = await verifyToken(currentToken);
      if (!isValid) throw new Error('TOKEN_EXPIRED');
      return stoppForsering({
        forsering_sak_id: sakId || '',
        begrunnelse: data.begrunnelse,
        paalopte_kostnader: data.paalopte_kostnader,
        expected_version: caseData?.version,
      });
    },
    onSuccess: (result) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      setStoppModalOpen(false);
      // Show warning if Catenda sync failed
      if (!result.catenda_synced) {
        setShowCatendaWarning(true);
      }
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      } else if (error instanceof ApiError && error.status === 409) {
        setShowConflict(true);
        queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      }
    },
  });

  // Mutation for updating incurred costs
  const kostnaderMutation = useMutation({
    mutationFn: async (data: { paalopte_kostnader: number; kommentar?: string }) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error('TOKEN_MISSING');
      const isValid = await verifyToken(currentToken);
      if (!isValid) throw new Error('TOKEN_EXPIRED');
      return oppdaterKostnader({
        forsering_sak_id: sakId || '',
        paalopte_kostnader: data.paalopte_kostnader,
        kommentar: data.kommentar,
        expected_version: caseData?.version,
      });
    },
    onSuccess: (result) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      setKostnaderModalOpen(false);
      // Show warning if Catenda sync failed
      if (!result.catenda_synced) {
        setShowCatendaWarning(true);
      }
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      } else if (error instanceof ApiError && error.status === 409) {
        setShowConflict(true);
        queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      }
    },
  });

  const state = caseData?.state;
  const forseringData = state?.forsering_data || EMPTY_FORSERING_DATA;

  // Check for BH position changes on related cases
  const { harEndringer: harStandpunktEndringer, endringer: standpunktEndringer } = useStandpunktEndringer(
    forseringData,
    kontekstData?.relaterte_saker || [],
    kontekstData?.sak_states || {}
  );

  // Forsering case's own events
  const forseringTimeline = useMemo((): TimelineEvent[] => {
    if (!kontekstData?.forsering_hendelser) return [];
    // Sort by timestamp descending
    return [...kontekstData.forsering_hendelser].sort((a, b) =>
      new Date(b.time || '').getTime() - new Date(a.time || '').getTime()
    );
  }, [kontekstData]);

  // Combine timeline events from all related cases
  const relatedCasesTimeline = useMemo((): TimelineEvent[] => {
    if (!kontekstData?.hendelser) return [];

    const allEvents: TimelineEvent[] = [];

    // Add events from each related case with source info
    Object.entries(kontekstData.hendelser).forEach(([relatedSakId, events]) => {
      const sakState = kontekstData.sak_states[relatedSakId];
      const sakTittel = sakState?.sakstittel || `Sak ${relatedSakId.slice(0, 8)}`;

      events.forEach((event: TimelineEvent) => {
        allEvents.push({
          ...event,
          // Prepend source case info to summary
          summary: `[${sakTittel}] ${event.summary || ''}`,
        });
      });
    });

    // Sort by timestamp descending
    return allEvents.sort((a, b) =>
      new Date(b.time || '').getTime() - new Date(a.time || '').getTime()
    );
  }, [kontekstData]);

  // Auth verification in progress
  if (isVerifying) {
    return <VerifyingState />;
  }

  // Auth error - invalid or expired token
  if (authError || !token) {
    return <AuthErrorState error={authError} />;
  }

  // Loading state
  if (caseLoading) {
    return <LoadingState message="Laster forseringssak..." />;
  }

  // Error state
  if (caseError) {
    return (
      <ErrorState
        title="Kunne ikke laste forseringssak"
        error={caseError}
        onRetry={() => refetchCase()}
      />
    );
  }

  // Check if this is actually a forsering case
  if (state && state.sakstype !== 'forsering') {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle p-8">
        <div className="max-w-2xl mx-auto">
          <Alert variant="warning" title="Ikke en forseringssak">
            <p>Denne saken er ikke en forseringssak. Gå til vanlig sakvisning.</p>
            <Link to={`/sak/${sakId}`}>
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
        title={state?.sakstittel || 'Forseringssak'}
        subtitle={`Sak #${sakId}`}
        userRole={userRole}
        onToggleRole={setUserRole}
      />

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-8 sm:py-8 bg-pkt-bg-card min-h-[calc(100vh-88px)]">
        <div className="space-y-6">
          {/* Alert for BH position changes */}
          {harStandpunktEndringer && (
            <Alert variant="warning" title="Byggherre har endret standpunkt">
              <p className="mb-2">
                Byggherren har endret sitt standpunkt på {standpunktEndringer.length}{' '}
                {standpunktEndringer.length === 1 ? 'relatert sak' : 'relaterte saker'}
                {' '}etter at forseringen ble varslet.
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {standpunktEndringer.map(endring => (
                  <li key={endring.sakId}>
                    <strong>{endring.sakTittel}</strong>:{' '}
                    {endring.endringType === 'frist_godkjent' && 'Frist godkjent'}
                    {endring.endringType === 'frist_delvis' && `Frist delvis godkjent (${endring.naaGodkjenteDager} av ${endring.opprinneligAvslatteDager} dager)`}
                    {endring.endringType === 'grunnlag_godkjent' && 'Grunnlag godkjent'}
                    {endring.endringType === 'grunnlag_delvis' && 'Grunnlag delvis godkjent'}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-pkt-text-body-subtle">
                Per NS 8407 §33.8 kan entreprenøren ha krav på kompensasjon for
                forseringskostnader påløpt før standpunktendringen.
              </p>
            </Alert>
          )}

          {/* Status and costs section */}
          <section>
            <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Status og kostnader
            </h2>
            <div className="space-y-4">
              <ForseringDashboard
                forseringData={forseringData}
                userRole={userRole}
                onStoppForsering={() => setStoppModalOpen(true)}
                onOppdaterKostnader={() => setKostnaderModalOpen(true)}
                onGiStandpunkt={() => setBhResponsModalOpen(true)}
              />
              <ForseringKostnadskort forseringData={forseringData} />
            </div>
          </section>

          {/* Related cases section */}
          <section>
            <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Relaterte saker
            </h2>
            <RelaterteSakerListe
            relaterteSaker={kontekstData?.relaterte_saker || []}
            sakStates={kontekstData?.sak_states}
            canRemove={userRole === 'TE'}
            onRemove={(sakId) => fjernMutation.mutate(sakId)}
            isRemoving={fjernMutation.isPending}
            headerAction={userRole === 'TE' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLeggTilModalOpen(true)}
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Legg til
              </Button>
            )}
            />
          </section>

          {/* Forsering case's own timeline */}
          <section className="mt-6 sm:mt-8">
            <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Hendelser for denne forseringen
              {kontekstLoading && (
                <ReloadIcon className="w-4 h-4 animate-spin inline ml-2" />
              )}
            </h2>

            {kontekstError && (
              <Alert variant="warning" title="Kunne ikke laste hendelser">
                {kontekstError.message}
              </Alert>
            )}

            {forseringTimeline.length > 0 ? (
              <Timeline events={forseringTimeline} />
            ) : (
              <p className="text-pkt-text-body-subtle text-sm">
                Ingen forseringshendelser ennå.
              </p>
            )}
          </section>

          {/* Timeline from related cases */}
          <section className="mt-6 sm:mt-8">
            <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Hendelser fra relaterte saker
            </h2>

            {relatedCasesTimeline.length > 0 ? (
              <Timeline events={relatedCasesTimeline} />
            ) : (
              <p className="text-pkt-text-body-subtle text-sm">
                Ingen hendelser fra relaterte saker.
              </p>
            )}
          </section>
        </div>
      </main>

      {/* Add related case modal */}
      <LeggTilRelatertSakModal
        open={leggTilModalOpen}
        onOpenChange={setLeggTilModalOpen}
        eksisterendeRelasjoner={kontekstData?.relaterte_saker || []}
        kandidatSaker={kandidatData?.kandidat_saker || []}
        onLeggTil={(sakIds) => leggTilMutation.mutate(sakIds)}
        isLoading={leggTilMutation.isPending}
      />

      {/* Stop forsering modal */}
      <StoppForseringModal
        open={stoppModalOpen}
        onOpenChange={setStoppModalOpen}
        forseringData={forseringData}
        onStopp={(data) => stoppMutation.mutate(data)}
        isLoading={stoppMutation.isPending}
      />

      {/* BH response modal */}
      <BHResponsForseringModal
        open={bhResponsModalOpen}
        onOpenChange={setBhResponsModalOpen}
        sakId={sakId || ''}
        forseringData={forseringData}
        currentVersion={caseData?.version}
        lastResponse={forseringData.bh_respons}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
          queryClient.invalidateQueries({ queryKey: ['case', sakId] });
        }}
      />

      {/* Update costs modal */}
      <OppdaterKostnaderModal
        open={kostnaderModalOpen}
        onOpenChange={setKostnaderModalOpen}
        forseringData={forseringData}
        onOppdater={(data) => kostnaderMutation.mutate(data)}
        isLoading={kostnaderMutation.isPending}
      />

      {/* Token expired alert */}
      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />

      {/* Concurrency conflict alert */}
      {showConflict && (
        <div className="fixed bottom-4 right-4 max-w-md z-50">
          <Alert variant="warning" title="Versjonskonflikt">
            Saken ble endret av en annen bruker. Siden er oppdatert med siste versjon.
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setShowConflict(false)}
            >
              Lukk
            </Button>
          </Alert>
        </div>
      )}

      {/* Catenda sync warning */}
      {showCatendaWarning && (
        <div className="fixed bottom-4 right-4 max-w-md z-50">
          <Alert variant="info" title="Ikke synkronisert til Catenda">
            Endringen er lagret lokalt, men ble ikke synkronisert til Catenda.
            Saken mangler muligens Catenda-kobling.
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setShowCatendaWarning(false)}
            >
              Lukk
            </Button>
          </Alert>
        </div>
      )}
    </div>
  );
}

export default ForseringPage;
