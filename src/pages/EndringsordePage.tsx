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

import { useMemo, useState, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE_TIME } from '../constants/queryConfig';
import { useAuth } from '../context/AuthContext';
import { useCaseStateSuspense } from '../hooks/useCaseState';
import { useUserRole } from '../hooks/useUserRole';
import { Alert, Button, Card } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { EODashboard, RelatertKOEListe, LeggTilKOEModal } from '../components/endringsordre';
import {
  ArrowLeftIcon,
  PlusIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import {
  VerifyingState,
  AuthErrorState,
  LoadingState,
} from '../components/PageStateHelpers';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type {
  EndringsordreData,
  EOKonsekvenser,
  TimelineEvent,
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

function useEOKontekst(sakId: string, enabled: boolean = true) {
  return useQuery<EOKontekstResponse, Error>({
    queryKey: ['endringsordre', sakId, 'kontekst'],
    queryFn: () => fetchEOKontekst(sakId),
    staleTime: STALE_TIME.DEFAULT,
    enabled: !!sakId && enabled,
  });
}

function useEOKontekstSuspense(sakId: string) {
  return useSuspenseQuery<EOKontekstResponse, Error>({
    queryKey: ['endringsordre', sakId, 'kontekst'],
    queryFn: () => fetchEOKontekst(sakId),
    staleTime: STALE_TIME.DEFAULT,
  });
}

function useKandidatKOESaker() {
  return useQuery<{ success: boolean; kandidat_saker: KandidatKOE[] }, Error>({
    queryKey: ['endringsordre', 'kandidater'],
    queryFn: fetchKandidatKOESaker,
    staleTime: STALE_TIME.EXTENDED,
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

/**
 * EndringsordePage wrapper - handles auth and Suspense boundary
 */
export function EndringsordePage() {
  const { sakId } = useParams<{ sakId: string }>();
  const { token, isVerifying, error: authError } = useAuth();

  // Auth verification in progress
  if (isVerifying) {
    return <VerifyingState />;
  }

  // Auth error - invalid or expired token
  if (authError || !token) {
    return <AuthErrorState error={authError} />;
  }

  // Auth OK - render with Suspense
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState message="Laster endringsordre..." />}>
        <EndringsordrePageContent sakId={sakId || ''} />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Inner component that uses Suspense-enabled hooks
 */
function EndringsordrePageContent({ sakId }: { sakId: string }) {
  const { userRole, setUserRole } = useUserRole();
  const queryClient = useQueryClient();

  // Modal state
  const [aksepterModalOpen, setAksepterModalOpen] = useState(false);
  const [bestridModalOpen, setBestridModalOpen] = useState(false);
  const [reviderModalOpen, setReviderModalOpen] = useState(false);
  const [leggTilKOEModalOpen, setLeggTilKOEModalOpen] = useState(false);

  // Catenda sync warning state
  const [showCatendaWarning, setShowCatendaWarning] = useState(false);

  // Suspense hooks - data guaranteed to exist
  const { data: caseData, refetch: refetchCase } = useCaseStateSuspense(sakId);
  const { data: kontekstData } = useEOKontekstSuspense(sakId);

  // Fetch candidate KOE cases for adding
  const { data: kandidatData } = useKandidatKOESaker();

  // Mutation for adding KOE
  const leggTilMutation = useMutation({
    mutationFn: (koeSakId: string) =>
      leggTilKOE({
        eo_sak_id: sakId || '',
        koe_sak_id: koeSakId,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['endringsordre', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['sak', sakId, 'state'] });
      // Show warning if Catenda sync failed
      if ('catenda_synced' in result && !result.catenda_synced) {
        setShowCatendaWarning(true);
      }
    },
  });

  // Mutation for removing KOE
  const fjernMutation = useMutation({
    mutationFn: (koeSakId: string) =>
      fjernKOE({
        eo_sak_id: sakId || '',
        koe_sak_id: koeSakId,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['endringsordre', sakId, 'kontekst'] });
      queryClient.invalidateQueries({ queryKey: ['sak', sakId, 'state'] });
      // Show warning if Catenda sync failed
      if ('catenda_synced' in result && !result.catenda_synced) {
        setShowCatendaWarning(true);
      }
    },
  });

  const state = caseData.state;
  const eoData = state.endringsordre_data || EMPTY_EO_DATA;

  // Check if this EO has related KOE cases (Type 2) or is standalone (Type 1)
  const harRelaterteKOE = (kontekstData.oppsummering?.antall_koe_saker || 0) > 0;

  // EO case's own events
  const eoTimeline = useMemo((): TimelineEvent[] => {
    if (!kontekstData.eo_hendelser) return [];
    // Sort by timestamp descending
    return [...kontekstData.eo_hendelser].sort((a, b) =>
      new Date(b.time || '').getTime() - new Date(a.time || '').getTime()
    );
  }, [kontekstData]);

  // Check if this is actually an EO case
  if (state.sakstype !== 'endringsordre') {
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
        title={state.sakstittel || `Endringsordre ${eoData.eo_nummer}`}
        subtitle={`EO ${eoData.eo_nummer}${eoData.revisjon_nummer > 0 ? ` rev. ${eoData.revisjon_nummer}` : ''}`}
        userRole={userRole}
        onToggleRole={setUserRole}
      />

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-2 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6 bg-pkt-bg-subtle min-h-[calc(100vh-88px)] space-y-4">
        {/* Status and details section */}
        <section aria-labelledby="status-heading">
          <Card variant="outlined" padding="md">
            <h2 id="status-heading" className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
              Status og detaljer
            </h2>
            <EODashboard
              eoData={eoData}
              userRole={userRole}
              eoHendelser={eoTimeline}
              onAksepter={() => setAksepterModalOpen(true)}
              onBestrid={() => setBestridModalOpen(true)}
              onRevider={() => setReviderModalOpen(true)}
            />
          </Card>
        </section>

        {/* Related KOE cases section (only show if Type 2 or if BH can add) */}
        {(harRelaterteKOE || userRole === 'BH') && (
          <section aria-labelledby="koe-heading">
            <Card variant="outlined" padding="md">
              <h2 id="koe-heading" className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4">
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
            </Card>
          </section>
        )}
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

export default EndringsordePage;
