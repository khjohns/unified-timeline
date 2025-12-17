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
import { useCaseState } from '../hooks/useCaseState';
import { useUserRole } from '../hooks/useUserRole';
import { Timeline } from '../components/views/Timeline';
import { Button } from '../components/primitives/Button';
import { Badge } from '../components/primitives/Badge';
import { Alert } from '../components/primitives/Alert';
import { PageHeader } from '../components/PageHeader';
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
import type { ForseringData, TimelineEntry, SakRelasjon } from '../types/timeline';
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

function useForseringKontekst(sakId: string) {
  return useQuery<ForseringKontekstResponse, Error>({
    queryKey: ['forsering', sakId, 'kontekst'],
    queryFn: () => fetchForseringKontekst(sakId),
    staleTime: 30_000,
    enabled: !!sakId,
  });
}

function useKandidatSaker() {
  return useQuery<{ success: boolean; kandidat_saker: KandidatSak[] }, Error>({
    queryKey: ['forsering', 'kandidater'],
    queryFn: fetchKandidatSaker,
    staleTime: 60_000,
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
  const { userRole, setUserRole } = useUserRole();
  const queryClient = useQueryClient();

  // Modal state
  const [leggTilModalOpen, setLeggTilModalOpen] = useState(false);
  const [stoppModalOpen, setStoppModalOpen] = useState(false);
  const [bhResponsModalOpen, setBhResponsModalOpen] = useState(false);
  const [kostnaderModalOpen, setKostnaderModalOpen] = useState(false);

  // Fetch forsering case state
  const {
    data: caseData,
    isLoading: caseLoading,
    error: caseError,
    refetch: refetchCase,
  } = useCaseState(sakId || '');

  // Fetch related cases context
  const {
    data: kontekstData,
    isLoading: kontekstLoading,
    error: kontekstError,
  } = useForseringKontekst(sakId || '');

  // Fetch candidate cases for adding
  const { data: kandidatData } = useKandidatSaker();

  // Mutation for adding related cases
  const leggTilMutation = useMutation({
    mutationFn: (sakIds: string[]) =>
      leggTilRelaterteSaker({
        forsering_sak_id: sakId || '',
        relatert_sak_ids: sakIds,
      }),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
    },
  });

  // Mutation for removing related cases
  const fjernMutation = useMutation({
    mutationFn: (relatertSakId: string) =>
      fjernRelatertSak({
        forsering_sak_id: sakId || '',
        relatert_sak_id: relatertSakId,
      }),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
    },
  });

  // Mutation for stopping forsering
  const stoppMutation = useMutation({
    mutationFn: (data: { begrunnelse: string; paalopte_kostnader?: number }) =>
      stoppForsering({
        forsering_sak_id: sakId || '',
        begrunnelse: data.begrunnelse,
        paalopte_kostnader: data.paalopte_kostnader,
      }),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      setStoppModalOpen(false);
    },
  });

  // Mutation for BH responding to forsering
  const bhResponsMutation = useMutation({
    mutationFn: (data: { aksepterer: boolean; godkjent_kostnad?: number; begrunnelse: string }) =>
      bhResponsForsering({
        forsering_sak_id: sakId || '',
        aksepterer: data.aksepterer,
        godkjent_kostnad: data.godkjent_kostnad,
        begrunnelse: data.begrunnelse,
      }),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      setBhResponsModalOpen(false);
    },
  });

  // Mutation for updating incurred costs
  const kostnaderMutation = useMutation({
    mutationFn: (data: { paalopte_kostnader: number; kommentar?: string }) =>
      oppdaterKostnader({
        forsering_sak_id: sakId || '',
        paalopte_kostnader: data.paalopte_kostnader,
        kommentar: data.kommentar,
      }),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['forsering', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      setKostnaderModalOpen(false);
    },
  });

  const state = caseData?.state;
  const forseringData = state?.forsering_data || EMPTY_FORSERING_DATA;

  // Forsering case's own events
  const forseringTimeline = useMemo((): TimelineEntry[] => {
    if (!kontekstData?.forsering_hendelser) return [];
    // Sort by timestamp descending
    return [...kontekstData.forsering_hendelser].sort((a, b) =>
      new Date(b.tidsstempel).getTime() - new Date(a.tidsstempel).getTime()
    );
  }, [kontekstData]);

  // Combine timeline events from all related cases
  const relatedCasesTimeline = useMemo((): TimelineEntry[] => {
    if (!kontekstData?.hendelser) return [];

    const allEvents: TimelineEntry[] = [];

    // Add events from each related case with source info
    Object.entries(kontekstData.hendelser).forEach(([relatedSakId, events]) => {
      const sakState = kontekstData.sak_states[relatedSakId];
      const sakTittel = sakState?.sakstittel || `Sak ${relatedSakId.slice(0, 8)}`;

      events.forEach((event: TimelineEntry) => {
        allEvents.push({
          ...event,
          // Prepend source case info to summary
          sammendrag: `[${sakTittel}] ${event.sammendrag}`,
        });
      });
    });

    // Sort by timestamp descending
    return allEvents.sort((a, b) =>
      new Date(b.tidsstempel).getTime() - new Date(a.tidsstempel).getTime()
    );
  }, [kontekstData]);

  // Loading state
  if (caseLoading) {
    return (
      <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center">
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
      <div className="min-h-screen bg-pkt-bg-default p-8">
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
      <div className="min-h-screen bg-pkt-bg-default p-8">
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
    <div className="min-h-screen bg-pkt-bg-default">
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
    </div>
  );
}
