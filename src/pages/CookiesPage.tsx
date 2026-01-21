/**
 * CookiesPage Component
 *
 * Information about cookies and local storage usage.
 * Required for ePrivacy directive compliance.
 */

import { Link } from 'react-router-dom';
import { Card } from '../components/primitives';

export function CookiesPage() {
  return (
    <div className="min-h-screen bg-pkt-bg-subtle py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/saker"
          className="text-sm text-pkt-brand-warm-blue-1000 hover:underline mb-4 inline-block"
        >
          &larr; Tilbake til saksoversikt
        </Link>

        <Card className="p-8">
          <h1 className="text-2xl font-bold text-pkt-brand-dark-blue-1000 mb-6">
            Informasjonskapsler og lokal lagring
          </h1>

          <div className="space-y-6 text-pkt-grays-gray-700">
            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Hva er informasjonskapsler?
              </h2>
              <p>
                Informasjonskapsler (cookies) er små tekstfiler som lagres på din
                enhet når du besøker nettsider. Vi bruker også lokal lagring
                (localStorage) for lignende formål.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Hvilke informasjonskapsler bruker vi?
              </h2>
              <p>Denne tjenesten bruker kun nødvendige informasjonskapsler:</p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-pkt-border-gray">
                      <th className="text-left py-2 pr-4 font-semibold">Navn</th>
                      <th className="text-left py-2 pr-4 font-semibold">Formål</th>
                      <th className="text-left py-2 font-semibold">Varighet</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-pkt-border-subtle">
                      <td className="py-2 pr-4 font-mono text-xs">
                        sb-*-auth-token
                      </td>
                      <td className="py-2 pr-4">
                        Autentisering og påloggingsstatus
                      </td>
                      <td className="py-2">Sesjon</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Lokal lagring (localStorage)
              </h2>
              <p>Vi bruker lokal lagring til:</p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-pkt-border-gray">
                      <th className="text-left py-2 pr-4 font-semibold">Nøkkel</th>
                      <th className="text-left py-2 pr-4 font-semibold">Formål</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-pkt-border-subtle">
                      <td className="py-2 pr-4 font-mono text-xs">
                        unified-timeline-user-email
                      </td>
                      <td className="py-2 pr-4">
                        Huske brukerens e-postadresse for revisjonslogg
                      </td>
                    </tr>
                    <tr className="border-b border-pkt-border-subtle">
                      <td className="py-2 pr-4 font-mono text-xs">
                        koe_form_backup_*
                      </td>
                      <td className="py-2 pr-4">
                        Midlertidig lagring av skjemadata for å forhindre datatap
                      </td>
                    </tr>
                    <tr className="border-b border-pkt-border-subtle">
                      <td className="py-2 pr-4 font-mono text-xs">theme</td>
                      <td className="py-2 pr-4">
                        Huske valgt fargetema (lys/mørk modus)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Tredjeparts informasjonskapsler
              </h2>
              <p>
                Denne tjenesten bruker ikke tredjeparts informasjonskapsler for
                sporing eller markedsføring.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Administrere informasjonskapsler
              </h2>
              <p>
                Du kan slette informasjonskapsler og lokal lagring via
                nettleserinnstillingene. Merk at dette vil logge deg ut og fjerne
                lagrede skjemadata.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default CookiesPage;
