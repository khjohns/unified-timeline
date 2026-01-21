/**
 * PersonvernPage Component
 *
 * Privacy policy page for GDPR compliance.
 * Describes how personal data is collected, processed, and stored.
 */

import { Link } from 'react-router-dom';
import { Card } from '../components/primitives';

export function PersonvernPage() {
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
            Personvernerklæring
          </h1>

          <div className="space-y-6 text-pkt-grays-gray-700">
            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Behandlingsansvarlig
              </h2>
              <p>
                Oslobygg KF er behandlingsansvarlig for personopplysninger som
                samles inn via denne tjenesten.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Hvilke personopplysninger behandles?
              </h2>
              <p>Vi behandler følgende personopplysninger:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>E-postadresse (for pålogging og identifisering)</li>
                <li>Navn (hvis oppgitt)</li>
                <li>Handlinger utført i systemet (for revisjonslogg)</li>
                <li>Tidspunkt for handlinger</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Formål med behandlingen
              </h2>
              <p>Personopplysningene behandles for å:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Autentisere brukere og gi tilgang til tjenesten</li>
                <li>Føre revisjonslogg over endringsordrer (KOE)</li>
                <li>Sikre sporbarhet i henhold til NS 8407:2011</li>
                <li>Forbedre tjenesten basert på bruksmønstre</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Rettslig grunnlag
              </h2>
              <p>
                Behandlingen er basert på GDPR artikkel 6 (1) bokstav b (oppfyllelse
                av avtale) og bokstav f (berettiget interesse for revisjonslogg og
                sporbarhet i entrepriseforhold).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Lagring og sletting
              </h2>
              <p>
                Personopplysninger lagres så lenge det er nødvendig for formålet,
                typisk i prosjektets levetid pluss arkiveringsperiode i henhold til
                arkivloven.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Dine rettigheter
              </h2>
              <p>Du har rett til å:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Be om innsyn i dine personopplysninger</li>
                <li>Be om retting av uriktige opplysninger</li>
                <li>Be om sletting (med forbehold om arkivplikt)</li>
                <li>Klage til Datatilsynet</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-pkt-brand-dark-blue-1000 mb-2">
                Kontakt
              </h2>
              <p>
                For spørsmål om personvern, kontakt personvernombudet hos Oslobygg KF.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default PersonvernPage;
