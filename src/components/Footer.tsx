/**
 * Footer Component
 *
 * Displays copyright, privacy policy link, cookie information, and NS 8407 disclaimer.
 * Required for GDPR compliance and good practice.
 */

import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-pkt-border-subtle bg-pkt-bg-subtle py-4 px-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* NS 8407 Disclaimer */}
        <div className="text-xs text-pkt-text-body-subtle max-w-3xl">
          <p className="font-medium text-pkt-text-body-muted mb-1">Viktig informasjon om NS 8407</p>
          <p>
            Denne løsningen er et digitalt hjelpeverktøy for håndtering av endringsordrer etter
            NS 8407:2011. Systemet erstatter ikke den offisielle kontraktsteksten og gir ingen
            juridisk rådgivning. Brukeren har selv ansvar for å påse at krav og varsler sendes
            korrekt og rettidig. Krav som ikke varsles innen fristene i NS 8407 kan gå tapt
            (preklusjon). Ved usikkerhet, les alltid den fullstendige standarden eller søk
            kvalifisert juridisk bistand.
          </p>
          <p className="mt-2">
            Ved tekniske feil som hindrer rettidig varsling eller innsending av krav, må
            brukeren umiddelbart varsle motparten på alternativ måte (e-post, brev eller
            telefon) for å ivareta kontraktuelle frister.
          </p>
        </div>

        {/* Copyright and links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-pkt-text-body-muted pt-2 border-t border-pkt-border-subtle">
          <p>&copy; {currentYear} Oslobygg KF. Alle rettigheter reservert.</p>
          <nav className="flex items-center gap-4">
            <Link
              to="/personvern"
              className="hover:text-pkt-brand-warm-blue-1000 hover:underline transition-colors"
            >
              Personvernerklæring
            </Link>
            <span className="w-px h-4 bg-pkt-border-subtle" aria-hidden="true" />
            <Link
              to="/cookies"
              className="hover:text-pkt-brand-warm-blue-1000 hover:underline transition-colors"
            >
              Informasjonskapsler
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
