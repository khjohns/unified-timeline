/**
 * EndringsordePage Component
 *
 * Page for viewing an endringsordre (change order) case.
 * Shows EO status, amount details, related KOE cases,
 * and a combined timeline of events.
 *
 * Endringsordre (EO) per NS 8407 §31.3 can be:
 * - Type 1: Formal change order issued directly by BH (standalone)
 * - Type 2: Result of KOE process where parties reach agreement
 */

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCaseState } from '../hooks/useCaseState';
import { useUserRole } from '../hooks/useUserRole';
import { Timeline } from '../components/views/Timeline';
import { Button } from '../components/primitives/Button';
import { Alert } from '../components/primitives/Alert';
import { PageHeader } from '../components/PageHeader';
import { EODashboard, RelatertKOEListe, LeggTilKOEModal } from '../components/endringsordre';
import {
  ReloadIcon,
  ArrowLeftIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import type {
  EndringsordreData,
  EOKonsekvenser,
  TimelineEntry,
} from '../types/timeline';
import {
  fetchEOKontekst,
  fetchKandidatKOESaker,
  leggTilKOE,
  fjernKOE,
  type EOKontekstResponse,
  type KandidatKOE,
} from '../api/endringsordre';

// ============================================================================
// HOOKS
// ============================================================================

function useEOKontekst(sakId: string) {
  return useQuery<EOKontekstResponse, Error>({
    queryKey: ['endringsordre', sakId, 'kontekst'],
    queryFn: () => fetchEOKontekst(sakId),
    staleTime: 30_000,
    enabled: !!sakId,
  });
}

function useKandidatKOESaker() {
  return useQuery<{ success: boolean; kandidat_saker: KandidatKOE[] }, Error>({
    queryKey: ['endringsordre', 'kandidater'],
    queryFn: fetchKandidatKOESaker,
    staleTime: 60_000,
  });
}

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
// MAIN COMPONENT
// ============================================================================

export function EndringsordePage() {
  const { sakId } = useParams<{ sakId: string }>();
  const { userRole, setUserRole } = useUserRole();
  const queryClient = useQueryClient();

  // Modal state
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

  // Fetch EO context (related cases, events, summary)
  const {
    data: kontekstData,
    isLoading: kontekstLoading,
    error: kontekstError,
  } = useEOKontekst(sakId || '');

  // Fetch candidate KOE cases for adding
  const { data: kandidatData } = useKandidatKOESaker();

  // Mutation for adding KOE
  const leggTilMutation = useMutation({
    mutationFn: (koeSakId: string) =>
      leggTilKOE({
        eo_sak_id: sakId || '',
        koe_sak_id: koeSakId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endringsordre', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
    },
  });

  // Mutation for removing KOE
  const fjernMutation = useMutation({
    mutationFn: (koeSakId: string) =>
      fjernKOE({
        eo_sak_id: sakId || '',
        koe_sak_id: koeSakId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endringsordre', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
    },
  });

  const state = caseData?.state;
  const eoData = state?.endringsordre_data || EMPTY_EO_DATA;

  // Check if this EO has related KOE cases (Type 2) or is standalone (Type 1)
  const harRelaterteKOE = (kontekstData?.oppsummering?.antall_koe_saker || 0) > 0;

  // EO case's own events
  const eoTimeline = useMemo((): TimelineEntry[] => {
    if (!kontekstData?.eo_hendelser) return [];
    // Sort by timestamp descending
    return [...kontekstData.eo_hendelser].sort((a, b) =>
      new Date(b.tidsstempel).getTime() - new Date(a.tidsstempel).getTime()
    );
  }, [kontekstData]);

  // Combine timeline events from all related KOE cases
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
            <EODashboard
              eoData={eoData}
              userRole={userRole}
              onAksepter={() => setAksepterModalOpen(true)}
              onBestrid={() => setBestridModalOpen(true)}
              onRevider={() => setReviderModalOpen(true)}
            />
          </section>

          {/* Related KOE cases section (only show if Type 2 or if BH can add) */}
          {(harRelaterteKOE || userRole === 'BH') && (
            <section>
              <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
                Relaterte KOE-saker
                {kontekstLoading && (
                  <ReloadIcon className="w-4 h-4 animate-spin inline ml-2" />
                )}
              </h2>
              <RelatertKOEListe
                koeOversikt={kontekstData?.oppsummering?.koe_oversikt || []}
                canRemove={userRole === 'BH' && eoData.status === 'utkast'}
                onRemove={(koeSakId) => fjernMutation.mutate(koeSakId)}
                isRemoving={fjernMutation.isPending}
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
          )}

          {/* EO case's own timeline */}
          <section className="mt-6 sm:mt-8">
            <h2 className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Hendelser for endringsordren
              {kontekstLoading && (
                <ReloadIcon className="w-4 h-4 animate-spin inline ml-2" />
              )}
            </h2>

            {kontekstError && (
              <Alert variant="warning" title="Kunne ikke laste hendelser">
                {kontekstError.message}
              </Alert>
            )}

            {eoTimeline.length > 0 ? (
              <Timeline events={eoTimeline} />
            ) : (
              <p className="text-pkt-text-body-subtle text-sm">
                Ingen hendelser ennå.
              </p>
            )}
          </section>

          {/* Timeline from related KOE cases (only show if Type 2) */}
          {harRelaterteKOE && (
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

      {/* Add KOE modal */}
      <LeggTilKOEModal
        open={leggTilKOEModalOpen}
        onOpenChange={setLeggTilKOEModalOpen}
        eksisterendeKOE={eoData.relaterte_koe_saker || []}
        kandidatSaker={kandidatData?.kandidat_saker || []}
        onLeggTil={(sakId) => leggTilMutation.mutate(sakId)}
        isLoading={leggTilMutation.isPending}
      />

      {/* TODO: Implement modals for aksepter, bestrid, revider */}
    </div>
  );
}
