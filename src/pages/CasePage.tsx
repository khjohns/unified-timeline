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
import { StatusDashboard } from '../components/views/StatusDashboard';
import { Timeline } from '../components/views/Timeline';
import { Button } from '../components/primitives/Button';
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

  // TODO: Get user role from authentication context
  // For now, defaulting to 'TE' for demonstration
  const userRole = 'TE' as 'TE' | 'BH';

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
            <div className="text-right">
              <span className="inline-block px-pkt-03 py-pkt-02 bg-oslo-blue text-white text-sm font-medium rounded-pkt-sm">
                {userRole === 'TE' ? 'Totalentreprenør' : 'Byggherre'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-pkt-06 py-pkt-08">
        {/* Status Dashboard */}
        <StatusDashboard state={state} />

        {/* Actions Section */}
        <section className="mt-pkt-08" aria-labelledby="actions-heading">
          <h2
            id="actions-heading"
            className="text-heading-md font-bold text-oslo-blue mb-pkt-04"
          >
            Tilgjengelige handlinger
          </h2>

          {/* TE Actions */}
          {userRole === 'TE' && (
            <div className="space-y-pkt-04">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-pkt-03">
                  Send nye krav
                </h3>
                <div className="flex flex-wrap gap-pkt-03">
                  {actions.canSendGrunnlag && (
                    <Button variant="primary" onClick={() => setSendGrunnlagOpen(true)}>
                      Send grunnlag
                    </Button>
                  )}
                  {actions.canSendVederlag && (
                    <Button variant="primary" onClick={() => setSendVederlagOpen(true)}>
                      Send vederlagskrav
                    </Button>
                  )}
                  {actions.canSendFrist && (
                    <Button variant="primary" onClick={() => setSendFristOpen(true)}>
                      Send fristkrav
                    </Button>
                  )}
                  {!actions.canSendGrunnlag &&
                    !actions.canSendVederlag &&
                    !actions.canSendFrist && (
                      <p className="text-sm text-gray-600">
                        Ingen nye krav kan sendes akkurat nå.
                      </p>
                    )}
                </div>
              </div>

              {(actions.canUpdateGrunnlag ||
                actions.canUpdateVederlag ||
                actions.canUpdateFrist) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-pkt-03">
                    Oppdater eksisterende krav
                  </h3>
                  <div className="flex flex-wrap gap-pkt-03">
                    {actions.canUpdateGrunnlag && (
                      <Button variant="secondary" disabled>
                        Oppdater grunnlag
                      </Button>
                    )}
                    {actions.canUpdateVederlag && (
                      <Button variant="secondary" disabled>
                        Oppdater vederlag
                      </Button>
                    )}
                    {actions.canUpdateFrist && (
                      <Button variant="secondary" disabled>
                        Oppdater frist
                      </Button>
                    )}
                  </div>
                  <p className="mt-pkt-02 text-xs text-gray-500">
                    Oppdateringshandlinger kommer i en senere versjon
                  </p>
                </div>
              )}
            </div>
          )}

          {/* BH Actions */}
          {userRole === 'BH' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-pkt-03">
                Svar på krav fra TE
              </h3>
              <div className="flex flex-wrap gap-pkt-03">
                {actions.canRespondToGrunnlag && (
                  <Button variant="primary" onClick={() => setRespondGrunnlagOpen(true)}>
                    Svar på grunnlag
                  </Button>
                )}
                {actions.canRespondToVederlag && (
                  <Button variant="primary" onClick={() => setRespondVederlagOpen(true)}>
                    Svar på vederlag
                  </Button>
                )}
                {actions.canRespondToFrist && (
                  <Button variant="primary" onClick={() => setRespondFristOpen(true)}>
                    Svar på frist
                  </Button>
                )}
                {!actions.canRespondToGrunnlag &&
                  !actions.canRespondToVederlag &&
                  !actions.canRespondToFrist && (
                    <p className="text-sm text-gray-600">
                      Ingen krav venter på svar akkurat nå.
                    </p>
                  )}
              </div>
            </div>
          )}
        </section>

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

        {/* Summary Section */}
        <section className="mt-pkt-08" aria-labelledby="summary-heading">
          <h2
            id="summary-heading"
            className="text-heading-md font-bold text-oslo-blue mb-pkt-04"
          >
            Sammendrag
          </h2>
          <div className="bg-white rounded-pkt-lg shadow p-pkt-06">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-pkt-04">
              <div>
                <dt className="text-sm font-medium text-gray-500">Overordnet status</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {state.overordnet_status}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Neste handling</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {state.neste_handling.handling || 'Ingen'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Totalt krevd beløp</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {state.sum_krevd.toLocaleString('nb-NO')} NOK
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Totalt godkjent beløp
                </dt>
                <dd className="mt-1 text-lg font-semibold text-success-700">
                  {state.sum_godkjent.toLocaleString('nb-NO')} NOK
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Antall hendelser</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {state.antall_events}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Kan utstede EO</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {state.kan_utstede_eo ? 'Ja' : 'Nei'}
                </dd>
              </div>
            </dl>
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
