/**
 * KontraktsregelInline Component
 *
 * Kompakt, inline komponent for å vise kontraktsregler fra NS 8407.
 * Bruker kontraktstekstens ordlyd og progressiv avsløring via accordion.
 *
 * Støtter:
 * - Grunnlagspor: §14.4, §25.2, §32.2, §32.3
 * - Fristspor: §33.1, §33.3, §33.4, §33.5, §33.6, §33.7, §33.8
 * - Custom mode: Dynamisk innhold med samme visuelle stil
 *
 * Struktur:
 * - Inline tekst: Kontraktstekst (alltid synlig)
 * - Accordion: Konsekvenser/detaljer (lukket som default)
 */

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRightIcon } from '@radix-ui/react-icons';

/** Støttede hjemler */
type Hjemmel =
  // Grunnlagspor
  | '§14.4'   // Lovendring
  | '§25.2'   // Krav pga BH-forhold (svikt/forsinkelse)
  | '§32.2'   // Endringsordre og irregulære endringer
  | '§32.3'   // Passivitetsrisiko (BH)
  // Fristspor
  | '§33.1' | '§33.3' | '§33.4' | '§33.5' | '§33.6.1' | '§33.6.2' | '§33.7' | '§33.8';

/** Custom innhold for dynamisk bruk */
interface CustomInnhold {
  inline: string;
  hjemmel: string;
  /** Valgfri - vises i accordion hvis angitt */
  konsekvens?: string;
  /** Valgfri accordion-label, default "Detaljer" */
  accordionLabel?: string;
}

/** Props: Enten fast hjemmel ELLER custom innhold */
type KontraktsregelInlineProps =
  | { hjemmel: Hjemmel; custom?: never }
  | { hjemmel?: never; custom: CustomInnhold };

/** Innhold per hjemmel - basert på kontraktsteksten */
const HJEMMEL_INNHOLD: Record<Hjemmel, {
  inline: string;
  konsekvens: string;
  paragraf5: { paaberoper: 'TE' | 'BH'; tekst: string };
}> = {
  // ========== GRUNNLAGSPOR ==========

  '§14.4': {
    inline: 'Lov- eller forskriftsendringer etter tilbudsfristens utløp som medfører endrede skatter, avgifter eller krav til kontraktsarbeidet, gir rett til justering av kontraktssummen og/eller fristforlengelse.',
    konsekvens: 'Bare endringer som inntrer ETTER tilbudsfristens utløp gir grunnlag. Entreprenøren bærer risikoen for endringer han burde kjent til ved tilbudet.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
  },
  '§25.2': {
    inline: 'Totalentreprenøren har krav på vederlagsjustering og/eller fristforlengelse dersom byggherrens forhold medfører økte kostnader eller forsinkelse. Dette omfatter svikt i leveranser, forsinkede avklaringer, eller andre forhold på byggherrens side.',
    konsekvens: 'Kravet forutsetter at forholdet faktisk har medført merkostnader eller forsinkelse (årsakssammenheng).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
  },
  '§32.2': {
    inline: 'Byggherren kan pålegge endringer i form av tilleggsarbeider, reduksjoner eller endret utførelse. Ved irregulære endringer (muntlige pålegg, konkludent adferd) skal totalentreprenøren varsle «uten ugrunnet opphold».',
    konsekvens: 'Ved irregulær endring: Dersom byggherren ikke svarer innen fristen, anses endringen som akseptert.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope at varselet er for sent skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
  },
  '§32.3': {
    inline: 'Byggherren skal «uten ugrunnet opphold» ta stilling til om det foreligger en endring og om den aksepteres. Ved passivitet kan endringen anses akseptert.',
    konsekvens: 'Byggherrens unnlatelse av å svare kan medføre at irregulære endringer anses akseptert.',
    paragraf5: {
      paaberoper: 'TE',
      tekst: 'Totalentreprenøren må påberope passivitet skriftlig «uten ugrunnet opphold» – ellers anses svaret gitt i tide.',
    },
  },

  // ========== FRISTSPOR ==========

  '§33.1': {
    inline: 'Fristforlengelse forutsetter at (1) fremdriften er hindret, og (2) hindringen skyldes det påberopte forholdet (årsakssammenheng).',
    konsekvens: 'Partene plikter å forebygge og begrense skadevirkningene av en fristforlengelse (§33.5).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
  },
  '§33.3': {
    inline: 'Fristforlengelse ved force majeure forutsetter at fremdriften hindres av forhold utenfor partenes kontroll (f.eks. ekstraordinære værforhold, offentlige påbud, streik). Hindringen kan ikke være noe parten burde forutsett eller kunne unngått.',
    konsekvens: 'Force majeure gir kun fristforlengelse – ikke vederlagsjustering. Partene plikter å begrense skadevirkningene (§33.5).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
  },
  '§33.4': {
    inline: 'Totalentreprenøren skal varsle «uten ugrunnet opphold» etter at forholdet oppstår, selv om han ennå ikke kan fremsette et spesifisert krav.',
    konsekvens: 'Krav på fristforlengelse tapes dersom det ikke varsles innen fristen.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses varselet gitt i tide.',
    },
  },
  '§33.5': {
    inline: 'Fristforlengelsen skal svare til den virkning på fremdriften som forholdet har forårsaket, der det blant annet tas hensyn til nødvendig avbrudd og eventuell forskyvning til ugunstigere årstid. Det skal også tas hensyn til samlet virkning av tidligere varslede forhold.',
    konsekvens: 'Partene plikter å forebygge og begrense skadevirkningene av en fristforlengelse og samarbeide om tiltak som kan iverksettes (tapsbegrensningsplikt).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '', // Ingen §5-mekanisme for beregningsregler
    },
  },
  '§33.6.1': {
    inline: 'Når totalentreprenøren har grunnlag for å beregne omfanget, skal han «uten ugrunnet opphold» angi og begrunne antall dager.',
    konsekvens: 'Bare krav på slik fristforlengelse som byggherren «måtte forstå» at han hadde krav på.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses kravet gitt i tide.',
    },
  },
  '§33.6.2': {
    inline: 'Totalentreprenøren skal svare «uten ugrunnet opphold» etter mottak av byggherrens forespørsel.',
    konsekvens: 'Krav på fristforlengelse tapes dersom totalentreprenøren ikke svarer.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses svaret gitt i tide.',
    },
  },
  '§33.7': {
    inline: 'Byggherren skal svare «uten ugrunnet opphold» etter mottak av begrunnet krav med angivelse av antall dager.',
    konsekvens: 'Innsigelser mot kravet tapes dersom de ikke fremsettes innen fristen.',
    paragraf5: {
      paaberoper: 'TE',
      tekst: 'Totalentreprenøren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses svaret gitt i tide.',
    },
  },
  '§33.8': {
    inline: 'Før forsering iverksettes, skal byggherren varsles med angivelse av hva forseringen antas å ville koste.',
    konsekvens: 'Ikke eksplisitt angitt i kontrakten.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '', // Ingen §5-mekanisme for §33.8
    },
  },
};

export function KontraktsregelInline(props: KontraktsregelInlineProps) {
  const [open, setOpen] = useState(false);

  // Bestem innhold basert på modus
  const isCustom = 'custom' in props && props.custom;
  const hjemmelInnhold = !isCustom && props.hjemmel ? HJEMMEL_INNHOLD[props.hjemmel] : null;

  // Custom modus
  if (isCustom) {
    const { inline, hjemmel, konsekvens, accordionLabel } = props.custom;
    const harAccordion = !!konsekvens;

    return (
      <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
        <p className="text-sm text-pkt-text-body">
          {inline}{hjemmel && <span className="text-pkt-text-body-subtle"> ({hjemmel})</span>}
        </p>

        {harAccordion && (
          <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-3">
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-pkt-text-interactive hover:text-pkt-text-interactive-hover transition-colors"
              >
                <ChevronRightIcon
                  className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                />
                {accordionLabel ?? 'Detaljer'}
              </button>
            </Collapsible.Trigger>

            <Collapsible.Content className="mt-2 pl-5 border-l-2 border-pkt-border-subtle">
              <p className="text-sm text-pkt-text-body whitespace-pre-line">{konsekvens}</p>
            </Collapsible.Content>
          </Collapsible.Root>
        )}
      </div>
    );
  }

  // Fast hjemmel modus
  if (!hjemmelInnhold) {
    return null;
  }

  const visParagraf5 = hjemmelInnhold.paragraf5.tekst.length > 0;

  return (
    <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
      {/* Inline tekst - alltid synlig */}
      <p className="text-sm text-pkt-text-body">
        {hjemmelInnhold.inline} <span className="text-pkt-text-body-subtle">({props.hjemmel})</span>
      </p>

      {/* Accordion for konsekvenser */}
      <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-3">
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-pkt-text-interactive hover:text-pkt-text-interactive-hover transition-colors"
          >
            <ChevronRightIcon
              className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            />
            Konsekvenser
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="mt-2 pl-5 border-l-2 border-pkt-border-subtle">
          <div className="space-y-2 text-sm text-pkt-text-body">
            {/* Konsekvens ved brudd */}
            <p>{hjemmelInnhold.konsekvens}</p>

            {/* §5-mekanismen */}
            {visParagraf5 && (
              <p className="text-pkt-text-body-subtle">
                {hjemmelInnhold.paragraf5.tekst} <span className="font-medium">(§5)</span>
              </p>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}

/** @deprecated Bruk KontraktsregelInline i stedet */
export const VarslingsregelInline = KontraktsregelInline;
