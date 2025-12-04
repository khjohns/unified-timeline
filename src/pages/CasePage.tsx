/**
 * CasePage Component
 *
 * Main page for viewing a case in the unified timeline architecture.
 * Displays status dashboard, available actions, and event timeline.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCaseState } from '../hooks/useCaseState';
import { useActionPermissions } from '../hooks/useActionPermissions';
import { useUserRole } from '../hooks/useUserRole';
import { StatusDashboard } from '../components/views/StatusDashboard';
import { Timeline } from '../components/views/Timeline';
import { ComprehensiveMetadata } from '../components/views/ComprehensiveMetadata';
import { RevisionHistory } from '../components/views/RevisionHistory';
import { Button } from '../components/primitives/Button';
import { ModeToggle } from '../components/ModeToggle';
import {
  SendGrunnlagModal,
  SendVederlagModal,
  SendFristModal,
  RespondGrunnlagModal,
  RespondVederlagModal,
  RespondFristModal,
} from '../components/actions';
import { getMockTimelineById } from '../mocks/mockData';

/**
 * CasePage renders the complete case view with dashboard and timeline
 */
export function CasePage() {
  const { sakId } = useParams<{ sakId: string }>();
  const { data, isLoading, error } = useCaseState(sakId || '');

  // Modal state management
  const [sendGrunnlagOpen, setSendGrunnlagOpen] = useState(false);
  const [sendVederlagOpen, setSendVederlagOpen] = useState(false);
  const [sendFristOpen, setSendFristOpen] = useState(false);
  const [respondGrunnlagOpen, setRespondGrunnlagOpen] = useState(false);
  const [respondVederlagOpen, setRespondVederlagOpen] = useState(false);
  const [respondFristOpen, setRespondFristOpen] = useState(false);

  // User role management for testing different modes
  const { userRole, setUserRole } = useUserRole();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-oslo-beige-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oslo-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Laster sak...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-oslo-beige-100 flex items-center justify-center">
        <div className="max-w-md p-pkt-08 bg-white rounded-pkt-lg shadow-lg" role="alert">
          <h2 className="text-heading-md font-bold text-error mb-pkt-04">
            Feil ved lasting av sak
          </h2>
          <p className="text-gray-700 mb-pkt-04">{error.message}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Prøv igjen
          </Button>
        </div>
      </div>
    );
  }

  // No data state (should not happen if no error)
  if (!data) {
    return null;
  }

  const { state } = data;
  const actions = useActionPermissions(state, userRole);

  // Get mock timeline events for display
  const mockTimelineEvents = getMockTimelineById(sakId || '');

  return (
    <div className="min-h-screen bg-oslo-beige-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-oslo-blue">
        <div className="max-w-7xl mx-auto px-pkt-06 py-pkt-05">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-heading-lg font-bold text-oslo-blue">
                {state.sakstittel}
              </h1>
              <p className="mt-pkt-02 text-body-md text-gray-600">Sak #{sakId}</p>
            </div>
            <div className="flex flex-col items-end gap-pkt-03">
              <ModeToggle userRole={userRole} onToggle={setUserRole} />
              <span className="text-xs text-gray-500">
                Viser tilgjengelige handlinger for valgt rolle
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-pkt-06 py-pkt-08">
        {/* Status Dashboard with Contextual Actions */}
        <StatusDashboard
          state={state}
          grunnlagActions={
            <>
              {/* TE Actions: "Send" and "Oppdater" are mutually exclusive */}
              {/* - Send: Only available when status is 'utkast' (not yet sent) */}
              {/* - Oppdater: Only available after sent (sendt/under_behandling/avvist) */}
              {userRole === 'TE' && actions.canSendGrunnlag && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSendGrunnlagOpen(true)}
                >
                  Send grunnlag
                </Button>
              )}
              {userRole === 'TE' && actions.canUpdateGrunnlag && (
                <Button variant="secondary" size="sm" disabled>
                  Oppdater grunnlag
                </Button>
              )}
              {/* BH Actions: Respond to TE's submission */}
              {userRole === 'BH' && actions.canRespondToGrunnlag && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRespondGrunnlagOpen(true)}
                >
                  Svar på grunnlag
                </Button>
              )}
            </>
          }
          vederlagActions={
            <>
              {/* TE Actions: "Send" and "Oppdater" are mutually exclusive */}
              {userRole === 'TE' && actions.canSendVederlag && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSendVederlagOpen(true)}
                >
                  Send vederlagskrav
                </Button>
              )}
              {userRole === 'TE' && actions.canUpdateVederlag && (
                <Button variant="secondary" size="sm" disabled>
                  Oppdater vederlag
                </Button>
              )}
              {/* BH Actions: Respond to TE's submission */}
              {userRole === 'BH' && actions.canRespondToVederlag && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRespondVederlagOpen(true)}
                >
                  Svar på vederlag
                </Button>
              )}
            </>
          }
          fristActions={
            <>
              {/* TE Actions: "Send" and "Oppdater" are mutually exclusive */}
              {userRole === 'TE' && actions.canSendFrist && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSendFristOpen(true)}
                >
                  Send fristkrav
                </Button>
              )}
              {userRole === 'TE' && actions.canUpdateFrist && (
                <Button variant="secondary" size="sm" disabled>
                  Oppdater frist
                </Button>
              )}
              {/* BH Actions: Respond to TE's submission */}
              {userRole === 'BH' && actions.canRespondToFrist && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRespondFristOpen(true)}
                >
                  Svar på frist
                </Button>
              )}
            </>
          }
        />

        {/* Timeline Section */}
        <section className="mt-pkt-08" aria-labelledby="timeline-heading">
          <h2
            id="timeline-heading"
            className="text-heading-md font-bold text-oslo-blue mb-pkt-04"
          >
            Hendelser
          </h2>
          <div className="bg-white rounded-pkt-lg shadow p-pkt-06">
            <Timeline events={mockTimelineEvents} />
          </div>
        </section>

        {/* Summary Section - Enhanced with Comprehensive Metadata and Revision History */}
        <section className="mt-pkt-08" aria-labelledby="summary-heading">
          <h2
            id="summary-heading"
            className="text-heading-md font-bold text-oslo-blue mb-pkt-04"
          >
            Sammendrag
          </h2>

          {/* Comprehensive Metadata */}
          <ComprehensiveMetadata state={state} sakId={sakId || ''} />

          {/* Revision History */}
          <div className="mt-pkt-06">
            <h3 className="text-lg font-semibold text-gray-900 mb-pkt-04">
              Revisjonshistorikk
            </h3>
            <RevisionHistory state={state} />
          </div>
        </section>
      </main>

      {/* Action Modals */}
      {sakId && (
        <>
          <SendGrunnlagModal
            open={sendGrunnlagOpen}
            onOpenChange={setSendGrunnlagOpen}
            sakId={sakId}
          />
          <SendVederlagModal
            open={sendVederlagOpen}
            onOpenChange={setSendVederlagOpen}
            sakId={sakId}
          />
          <SendFristModal
            open={sendFristOpen}
            onOpenChange={setSendFristOpen}
            sakId={sakId}
          />
          <RespondGrunnlagModal
            open={respondGrunnlagOpen}
            onOpenChange={setRespondGrunnlagOpen}
            sakId={sakId}
          />
          <RespondVederlagModal
            open={respondVederlagOpen}
            onOpenChange={setRespondVederlagOpen}
            sakId={sakId}
            krevdBelop={state.vederlag.krevd_belop}
          />
          <RespondFristModal
            open={respondFristOpen}
            onOpenChange={setRespondFristOpen}
            sakId={sakId}
            krevdDager={state.frist.krevd_dager}
            fristType={state.frist.frist_type}
          />
        </>
      )}
    </div>
  );
}
