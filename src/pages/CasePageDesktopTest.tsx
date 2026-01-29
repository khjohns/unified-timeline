/**
 * CasePageDesktopTest
 *
 * Eksperimentell side for å teste ny desktop-layout med horisontale spor-seksjoner.
 * Målet er at alle tre spor skal være synlige uten scrolling på desktop.
 *
 * Tilgjengelig på: /saker/:sakId/desktop-test
 */

import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCaseState } from '../hooks/useCaseState';
import { useTimeline } from '../hooks/useTimeline';
import { useHistorikk } from '../hooks/useRevisionHistory';
import { SporSection } from '../components/views/SporSection';
import {
  transformGrunnlagHistorikk,
  transformVederlagHistorikk,
  transformFristHistorikk,
} from '../components/views/SporHistory';
import { Badge } from '../components/primitives';
import {
  VerifyingState,
  AuthErrorState,
  ErrorState,
} from '../components/PageStateHelpers';
import { PageLoadingFallback } from '../components/PageLoadingFallback';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import type { SakState, TimelineEvent } from '../types/timeline';

// Default empty state
const EMPTY_STATE: SakState = {
  sak_id: '',
  sakstittel: '',
  grunnlag: {
    status: 'utkast',
    kontraktsreferanser: [],
    laast: false,
    antall_versjoner: 0,
  },
  vederlag: {
    status: 'utkast',
    antall_versjoner: 0,
  },
  frist: {
    status: 'utkast',
    antall_versjoner: 0,
  },
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: '',
  visningsstatus_frist: '',
  overordnet_status: 'UTKAST',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: null,
    handling: '',
    spor: null,
  },
  sum_krevd: 0,
  sum_godkjent: 0,
  antall_events: 0,
};

export function CasePageDesktopTest() {
  const { sakId } = useParams<{ sakId: string }>();
  const { token, isVerifying, error: authError } = useAuth();

  // Load data
  const { data, isLoading, error } = useCaseState(sakId || '', { enabled: !!token && !isVerifying });
  const { data: timelineData } = useTimeline(sakId || '', { enabled: !!token && !isVerifying });
  const { grunnlag: grunnlagHistorikk, vederlag: vederlagHistorikk, frist: fristHistorikk } = useHistorikk(sakId || '');

  const state = data?.state ?? EMPTY_STATE;
  const timelineEvents: TimelineEvent[] = useMemo(
    () => timelineData?.events ?? [],
    [timelineData]
  );

  // Transform historikk
  const grunnlagEntries = useMemo(() => transformGrunnlagHistorikk(grunnlagHistorikk), [grunnlagHistorikk]);
  const vederlagEntries = useMemo(() => transformVederlagHistorikk(vederlagHistorikk), [vederlagHistorikk]);
  const fristEntries = useMemo(() => transformFristHistorikk(fristHistorikk), [fristHistorikk]);

  // Auth states
  if (isVerifying) return <VerifyingState />;
  if (authError || !token) return <AuthErrorState error={authError} />;
  if (isLoading) return <PageLoadingFallback />;
  if (error) return <ErrorState title="Feil ved lasting" error={error} onRetry={() => window.location.reload()} />;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header */}
      <header className="bg-pkt-bg-card border-b border-pkt-border-subtle sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/saker/${sakId}`}
                className="flex items-center gap-1 text-sm text-pkt-text-interactive hover:underline"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Tilbake til vanlig visning
              </Link>
              <div className="h-4 w-px bg-pkt-border-subtle" />
              <div>
                <h1 className="text-lg font-semibold text-pkt-text-body-dark">
                  {state.sakstittel}
                </h1>
                <p className="text-sm text-pkt-text-body-subtle">
                  Sak #{sakId}
                </p>
              </div>
            </div>
            <Badge variant="warning" size="sm">
              Desktop-test
            </Badge>
          </div>
        </div>
      </header>

      {/* Info banner */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <p className="text-sm text-amber-800">
            <strong>Eksperimentell layout:</strong> Denne siden tester en ny horisontal layout for desktop
            der alle tre spor vises med mindre vertikal høyde. Sammenlign med{' '}
            <Link to={`/saker/${sakId}`} className="underline">
              vanlig visning
            </Link>.
          </p>
        </div>
      </div>

      {/* Main content - Wider container for desktop */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tre-spor seksjoner */}
        <div className="space-y-3">
          <SporSection
            spor="grunnlag"
            state={state}
            historyEntries={grunnlagEntries}
            events={timelineEvents}
          />

          <SporSection
            spor="vederlag"
            state={state}
            historyEntries={vederlagEntries}
            events={timelineEvents}
          />

          <SporSection
            spor="frist"
            state={state}
            historyEntries={fristEntries}
            events={timelineEvents}
          />
        </div>

        {/* Sammenligning info */}
        <div className="mt-8 p-4 bg-pkt-bg-card rounded-lg border border-pkt-border-subtle">
          <h2 className="text-sm font-semibold text-pkt-text-body-dark mb-2">
            Om denne testen
          </h2>
          <ul className="text-sm text-pkt-text-body space-y-1">
            <li>
              <span className="font-medium">Desktop (lg+):</span> Horisontal 3-kolonne layout per spor
              (Hjemmel | Krav/Data | Historikk)
            </li>
            <li>
              <span className="font-medium">Mobil:</span> Vertikal stacking som vanlig
            </li>
            <li>
              <span className="font-medium">Mål:</span> Alle tre spor synlige uten scrolling på
              1080p+ skjermer
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default CasePageDesktopTest;
