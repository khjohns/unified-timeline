/**
 * CategoryAccordion Component
 *
 * Viser hovedkategori og underkategori(er) med KontraktsregelInline
 * for å gi juridisk kontekst fra NS 8407 inline i dashboard.
 *
 * Layout:
 * - 1 underkategori: "Hovedkategori → Underkategori (§hjemmel)"
 * - Flere underkategorier: Hovedkategori som label, stacked accordions under
 * - Kun hovedkategori (f.eks. Force Majeure): "Hovedkategori (§hjemmel)"
 */

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { KontraktsregelInline } from './KontraktsregelInline';
import {
  getHovedkategori,
  getUnderkategoriObj,
  type Hovedkategori,
  type Underkategori,
} from '../../constants/categories';

interface CategoryAccordionProps {
  /** Hovedkategori-kode (f.eks. "ENDRING", "SVIKT") */
  hovedkategori: string;
  /** Underkategori-kode(r) - kan være string eller array */
  underkategori?: string | string[];
}

/** Konverter hjemmel_basis til KontraktsregelInline-format */
function toHjemmelFormat(hjemmelBasis: string): string {
  // Håndterer formater som "32.1", "24.2.2", "38.1 annet ledd"
  const base = hjemmelBasis.split(' ')[0]; // Fjern "annet ledd" etc.
  return `§${base}`;
}

/** Sjekk om hjemmel er støttet av KontraktsregelInline */
const SUPPORTED_HJEMLER = new Set([
  '§10.2', '§14.4', '§14.6', '§15.2', '§19.1', '§21.4', '§22', '§23.1',
  '§23.3', '§24.1', '§24.2.2', '§25.1.2', '§25.2', '§26.3', '§29.2',
  '§32.1', '§32.2', '§32.3', '§38.1',
  '§33.1', '§33.3', '§33.4', '§33.5', '§33.6.1', '§33.6.2', '§33.7', '§33.8',
]);

function isHjemmelSupported(hjemmel: string): boolean {
  return SUPPORTED_HJEMLER.has(hjemmel);
}

/** Enkelt accordion-item for én underkategori */
function UnderkategoriAccordion({
  underkategori,
  title,
  defaultOpen = false,
}: {
  underkategori: Underkategori;
  title: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hjemmel = toHjemmelFormat(underkategori.hjemmel_basis);
  const hjemmelSupported = isHjemmelSupported(hjemmel);

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 text-left text-sm font-medium text-pkt-text-body-dark hover:text-pkt-text-interactive transition-colors py-1"
        >
          <ChevronRightIcon
            className={`h-4 w-4 shrink-0 text-pkt-text-body-muted transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
          <span>{title}</span>
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="mt-2 ml-6">
        {hjemmelSupported ? (
          <KontraktsregelInline hjemmel={hjemmel as any} />
        ) : (
          <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
            <p className="text-sm text-pkt-text-body">
              {underkategori.beskrivelse}
            </p>
            <p className="text-xs text-pkt-text-body-subtle mt-2">
              Hjemmel: {hjemmel} · Varselkrav: §{underkategori.varselkrav_ref}
            </p>
          </div>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function CategoryAccordion({
  hovedkategori: hovedkategoriKode,
  underkategori: underkategoriInput,
}: CategoryAccordionProps) {
  const hovedkat = getHovedkategori(hovedkategoriKode);

  if (!hovedkat) {
    return <span className="text-sm text-pkt-text-body-subtle">-</span>;
  }

  // Normaliser underkategorier til array
  const underkategorier: Underkategori[] = [];
  if (underkategoriInput) {
    const koder = Array.isArray(underkategoriInput)
      ? underkategoriInput
      : [underkategoriInput];
    for (const kode of koder) {
      const uk = getUnderkategoriObj(kode);
      if (uk) underkategorier.push(uk);
    }
  }

  // Case 1: Ingen underkategorier (f.eks. Force Majeure)
  if (underkategorier.length === 0) {
    return (
      <SingleCategoryAccordion
        title={`${hovedkat.label} (§${hovedkat.hjemmel_frist})`}
        hovedkategori={hovedkat}
      />
    );
  }

  // Case 2: Én underkategori - kompakt visning
  if (underkategorier.length === 1) {
    const uk = underkategorier[0];
    const title = `${hovedkat.label} → ${uk.label} (§${uk.hjemmel_basis})`;
    return <UnderkategoriAccordion underkategori={uk} title={title} />;
  }

  // Case 3: Flere underkategorier - stacked
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-pkt-text-body-dark">
        {hovedkat.label}
      </span>
      <div className="space-y-1 ml-1">
        {underkategorier.map((uk) => (
          <UnderkategoriAccordion
            key={uk.kode}
            underkategori={uk}
            title={`${uk.label} (§${uk.hjemmel_basis})`}
          />
        ))}
      </div>
    </div>
  );
}

/** For hovedkategorier uten underkategorier */
function SingleCategoryAccordion({
  title,
  hovedkategori,
}: {
  title: string;
  hovedkategori: Hovedkategori;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hjemmel = `§${hovedkategori.hjemmel_frist}`;
  const hjemmelSupported = isHjemmelSupported(hjemmel);

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 text-left text-sm font-medium text-pkt-text-body-dark hover:text-pkt-text-interactive transition-colors py-1"
        >
          <ChevronRightIcon
            className={`h-4 w-4 shrink-0 text-pkt-text-body-muted transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
          <span>{title}</span>
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="mt-2 ml-6">
        {hjemmelSupported ? (
          <KontraktsregelInline hjemmel={hjemmel as any} />
        ) : (
          <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
            <p className="text-sm text-pkt-text-body">
              {hovedkategori.beskrivelse}
            </p>
            <p className="text-xs text-pkt-text-body-subtle mt-2">
              Fristhjemmel: §{hovedkategori.hjemmel_frist}
              {hovedkategori.hjemmel_vederlag && ` · Vederlagshjemmel: §${hovedkategori.hjemmel_vederlag}`}
            </p>
          </div>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
