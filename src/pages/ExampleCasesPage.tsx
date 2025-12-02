/**
 * ExampleCasesPage Component
 *
 * Shows available mock cases for testing and demonstration.
 * Useful for GitHub Pages preview and development without backend.
 */

import { useNavigate } from 'react-router-dom';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { mockCaseList } from '../mocks/mockData';
import { USE_MOCK_API } from '../api/client';

export function ExampleCasesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-oslo-beige-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-oslo-blue">
        <div className="max-w-7xl mx-auto px-pkt-06 py-pkt-05">
          <h1 className="text-heading-lg font-bold text-oslo-blue">
            Eksempler - Endringsmeldinger
          </h1>
          <p className="mt-pkt-02 text-body-md text-gray-600">
            {USE_MOCK_API
              ? 'Velg en eksempelsak for å se Event Sourcing-arkitekturen i aksjon'
              : 'Mock API er deaktivert - koble til backend for ekte data'}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-pkt-06 py-pkt-08">
        {!USE_MOCK_API && (
          <div className="mb-pkt-06 p-pkt-04 bg-warning-100 border border-warning-500 rounded-pkt-md">
            <p className="text-sm text-warning-700">
              <strong>Merk:</strong> Mock API er deaktivert. Sett{' '}
              <code className="bg-white px-2 py-1 rounded">VITE_USE_MOCK_API=true</code> i .env
              filen for å bruke eksempeldata.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-pkt-06">
          {mockCaseList.map((mockCase) => (
            <Card key={mockCase.id} variant="elevated" padding="lg">
              <div className="flex flex-col h-full">
                <h2 className="text-heading-md font-bold text-oslo-blue mb-pkt-03">
                  {mockCase.id}
                </h2>
                <p className="text-body-md text-gray-700 mb-pkt-04 flex-1">
                  {mockCase.title}
                </p>
                <div className="mb-pkt-04">
                  <span
                    className={`inline-block px-pkt-03 py-pkt-02 rounded-pkt-sm text-sm font-medium ${
                      mockCase.status === 'Klar for EO'
                        ? 'bg-success-100 text-success-700'
                        : mockCase.status === 'Under behandling'
                        ? 'bg-warning-100 text-warning-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {mockCase.status}
                  </span>
                </div>
                <Button
                  variant="primary"
                  onClick={() => navigate(`/saker/${mockCase.id}`)}
                  className="w-full"
                >
                  Vis sak
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-pkt-10">
          <Card variant="outlined" padding="lg">
            <h3 className="text-heading-sm font-bold text-oslo-blue mb-pkt-04">
              Om eksempelsakene
            </h3>
            <div className="space-y-pkt-03 text-body-md text-gray-700">
              <p>
                <strong>SAK-2025-001:</strong> Demonstrerer et aktivt krav med grunnlag godkjent,
                vederlag under behandling, og delvis godkjent frist. Viser kompleks
                forhandlingssituasjon.
              </p>
              <p>
                <strong>SAK-2025-002:</strong> Viser en ny sak i utkast-status. Alle spor er klare
                for innsending. Ideell for å teste innsendingsskjemaer.
              </p>
              <p>
                <strong>SAK-2024-089:</strong> En fullstendig godkjent sak som er klar for
                utstedelse av endringsordre (EO). Demonstrerer suksessfull gjennomføring.
              </p>
            </div>
          </Card>
        </div>

        {/* Technical Info */}
        <div className="mt-pkt-06">
          <Card variant="default" padding="md">
            <h4 className="text-sm font-semibold text-gray-700 mb-pkt-03">
              Teknisk informasjon
            </h4>
            <ul className="text-sm text-gray-600 space-y-pkt-02">
              <li>
                • <strong>Mock Mode:</strong> {USE_MOCK_API ? 'Aktivert' : 'Deaktivert'}
              </li>
              <li>• Alle skjemainnsendinger simuleres med 800ms forsinkelse</li>
              <li>• Status oppdateres lokalt (ingen backend-persistering)</li>
              <li>• Perfekt for utvikling og demonstrasjon</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
