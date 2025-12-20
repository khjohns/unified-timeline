/**
 * ExampleCasesPage Component
 *
 * Shows available mock cases for testing and demonstration.
 * Useful for GitHub Pages preview and development without backend.
 */

import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../components/primitives';
import { mockCaseList } from '../mocks';
import { USE_MOCK_API } from '../api/client';

export function ExampleCasesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-pkt-bg-default">
      {/* Header */}
      <header className="bg-pkt-bg-card shadow-sm border-b-2 border-oslo-blue">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-heading-lg font-bold text-oslo-blue">
                Eksempler - Endringsmeldinger
              </h1>
              <p className="mt-2 text-body-md text-pkt-grays-gray-600">
                {USE_MOCK_API
                  ? 'Velg en eksempelsak for å se Event Sourcing-arkitekturen i aksjon'
                  : 'Mock API er deaktivert - koble til backend for ekte data'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/showcase')}
              className="ml-4"
            >
              Komponentvisning
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {!USE_MOCK_API && (
          <div className="mb-6 p-4 bg-pkt-brand-yellow-500 border border-pkt-border-yellow rounded-none text-alert-warning-text">
            <p className="text-sm">
              <strong>Merk:</strong> Mock API er deaktivert. Sett{' '}
              <code className="bg-pkt-bg-subtle px-2 py-1 rounded">VITE_USE_MOCK_API=true</code> i .env
              filen for å bruke eksempeldata.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mockCaseList.map((mockCase) => (
            <Card key={mockCase.id} variant="elevated" padding="lg">
              <div className="flex flex-col h-full">
                <h2 className="text-heading-md font-bold text-oslo-blue mb-3">
                  {mockCase.id}
                </h2>
                <p className="text-body-md text-pkt-grays-gray-700 mb-4 flex-1">
                  {mockCase.title}
                </p>
                <div className="mb-4">
                  <span
                    className={`inline-block px-3 py-2 rounded-none text-sm font-medium ${
                      mockCase.sakstype === 'forsering'
                        ? 'bg-pkt-brand-yellow-500 text-alert-warning-text border-2 border-pkt-border-yellow'
                        : mockCase.sakstype === 'endringsordre'
                        ? 'bg-badge-info-bg text-badge-info-text border-2 border-pkt-border-info'
                        : mockCase.status === 'Klar for EO'
                        ? 'bg-badge-success-bg text-badge-success-text'
                        : mockCase.status === 'Under behandling'
                        ? 'bg-badge-warning-bg text-badge-warning-text'
                        : 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700'
                    }`}
                  >
                    {mockCase.status}
                  </span>
                </div>
                <Button
                  variant={mockCase.sakstype === 'forsering' || mockCase.sakstype === 'endringsordre' ? 'secondary' : 'primary'}
                  onClick={() =>
                    navigate(
                      mockCase.sakstype === 'forsering'
                        ? `/forsering/${mockCase.id}`
                        : mockCase.sakstype === 'endringsordre'
                        ? `/endringsordre/${mockCase.id}`
                        : `/saker/${mockCase.id}`
                    )
                  }
                  className="w-full"
                >
                  {mockCase.sakstype === 'forsering'
                    ? 'Vis forseringssak'
                    : mockCase.sakstype === 'endringsordre'
                    ? 'Vis endringsordre'
                    : 'Vis sak'}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-10">
          <Card variant="outlined" padding="lg">
            <h3 className="text-heading-sm font-bold text-oslo-blue mb-4">
              Om eksempelsakene
            </h3>
            <div className="space-y-3 text-body-md text-pkt-grays-gray-700">
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
              <p>
                <strong>SAK-2025-012:</strong> 🔶 <em>Forseringssak</em> - Demonstrerer den nye
                relasjonelle modellen der forsering er en egen sak med relasjoner til avslåtte
                fristforlengelser. Viser kombinert tidslinje fra 3 relaterte saker.
              </p>
              <p>
                <strong>SAK-2025-013:</strong> Sak med avslått fristforlengelse som kan utløse
                opprettelse av forseringssak. Tryk på &quot;Opprett forseringssak&quot; for å teste flyten.
              </p>
              <p>
                <strong>SAK-EO-001:</strong> 📋 <em>Endringsordre</em> - Utstedt endringsordre som
                samler to KOE-saker (SAK-2025-010 og SAK-2024-089). Demonstrerer EO-visning med
                relaterte saker og oppgjørsoversikt.
              </p>
            </div>
          </Card>
        </div>

        {/* Technical Info */}
        <div className="mt-6">
          <Card variant="default" padding="md">
            <h4 className="text-sm font-semibold text-pkt-grays-gray-700 mb-3">
              Teknisk informasjon
            </h4>
            <ul className="text-sm text-pkt-grays-gray-600 space-y-2">
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

export default ExampleCasesPage;
