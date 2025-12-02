/**
 * CasePage Component
 *
 * Main page for viewing a case in the unified timeline architecture.
 * Displays status dashboard, available actions, and event timeline.
 */

import { useParams } from 'react-router-dom';
import { useCaseState } from '../hooks/useCaseState';
import { StatusDashboard } from '../components/views/StatusDashboard';
import { Timeline } from '../components/views/Timeline';
import { Button } from '../components/primitives/Button';

/**
 * CasePage renders the complete case view with dashboard and timeline
 */
export function CasePage() {
  const { sakId } = useParams<{ sakId: string }>();
  const { data, isLoading, error } = useCaseState(sakId || '');

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

  return (
    <div className="min-h-screen bg-oslo-beige-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-oslo-blue">
        <div className="max-w-7xl mx-auto px-pkt-06 py-pkt-05">
          <h1 className="text-heading-lg font-bold text-oslo-blue">
            {state.sakstittel}
          </h1>
          <p className="mt-pkt-02 text-body-md text-gray-600">Sak #{sakId}</p>
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
            Handlinger
          </h2>
          <div className="flex flex-wrap gap-pkt-03">
            {/* TODO: Add action buttons based on permissions */}
            <Button variant="secondary" disabled>
              Send nytt vederlagskrav
            </Button>
            <Button variant="secondary" disabled>
              Send fristkrav
            </Button>
            <Button variant="ghost" disabled>
              Trekk krav
            </Button>
          </div>
          <p className="mt-pkt-03 text-sm text-gray-600">
            Handlinger vil være tilgjengelige basert på sakens status og din rolle.
          </p>
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
            {/* TODO: Fetch and display actual timeline events */}
            <Timeline events={[]} />
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
                <dt className="text-sm font-medium text-gray-500">
                  Overordnet status
                </dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {state.overordnet_status}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Neste handling
                </dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {state.neste_handling.handling || 'Ingen'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Totalt krevd beløp
                </dt>
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
                <dt className="text-sm font-medium text-gray-500">
                  Antall hendelser
                </dt>
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
    </div>
  );
}
