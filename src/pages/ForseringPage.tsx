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
import { getAuthToken } from '../api/client';
import { useVerifyToken } from '../hooks/useVerifyToken';
import { useCaseState } from '../hooks/useCaseState';
import { useUserRole } from '../hooks/useUserRole';
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
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import type { ForseringData, TimelineEvent, SakRelasjon } from '../types/timeline';
import {
  fetchForseringKontekst,
  fetchKandidatSaker,
  leggTilRelaterteSaker,
  fjernRelatertSak,
  stoppForsering,
  bhResponsForsering,
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
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      setStoppModalOpen(false);
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      }
    },
  });

  // Mutation for BH responding to forsering
  const bhResponsMutation = useMutation({
    mutationFn: async (data: { aksepterer: boolean; godkjent_kostnad?: number; begrunnelse: string }) => {
      const currentToken = getAuthToken();
      if (!currentToken) throw new Error('TOKEN_MISSING');
      const isValid = await verifyToken(currentToken);
      if (!isValid) throw new Error('TOKEN_EXPIRED');
      return bhResponsForsering({
        forsering_sak_id: sakId || '',
        aksepterer: data.aksepterer,
        godkjent_kostnad: data.godkjent_kostnad,
        begrunnelse: data.begrunnelse,
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      setBhResponsModalOpen(false);
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
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
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      setKostnaderModalOpen(false);
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      }
    },
  });

  const state = caseData?.state;
  const forseringData = state?.forsering_data || EMPTY_FORSERING_DATA;

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
    return (
      <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center px-4">
        <div className="text-center">
          <ReloadIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-pkt-grays-gray-400 animate-spin" />
          <p className="text-sm sm:text-base text-pkt-grays-gray-500">Verifiserer tilgang...</p>
        </div>
      </div>
    );
  }

  // Auth error - invalid or expired token
  if (authError || !token) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center px-4">
        <div className="max-w-md w-full p-4 sm:p-8 bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200" role="alert">
          <ExclamationTriangleIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-pkt-brand-red-1000" />
          <h2 className="text-lg sm:text-xl font-semibold text-pkt-brand-red-1000 mb-3 sm:mb-4 text-center">
            Tilgang nektet
          </h2>
          <p className="text-sm sm:text-base text-pkt-text-body-default mb-4 text-center">
            {authError || 'Ugyldig eller utløpt lenke. Vennligst bruk lenken du mottok på nytt.'}
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (caseLoading) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center">
        <div className="text-center">
          <ReloadIcon className="w-8 h-8 animate-spin mx-auto mb-4 text-pkt-text-action-active" />
          <p className="text-pkt-text-body-subtle">Laster forseringssak...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (caseError) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle p-8">
        <div className="max-w-2xl mx-auto">
          <Alert variant="danger" title="Kunne ikke laste forseringssak">
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
        forseringData={forseringData}
        onRespons={(data) => bhResponsMutation.mutate(data)}
        isLoading={bhResponsMutation.isPending}
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
    </div>
  );
}

export default ForseringPage;
