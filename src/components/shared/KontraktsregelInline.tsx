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
  | '§24.2.2' // Risikoovergang - kontroll av byggherrens materiale
  | '§25.1.2' // Varslingsplikt ved forhold som forstyrrer gjennomføringen
  | '§25.2'   // Varslingsplikt ved uegnet prosjektering (funksjonskrav)
  | '§32.2'   // Irregulære endringer (pålegg uten endringsordre)
  | '§32.3'   // Passivitetsrisiko (byggherre)
  // Fristspor
  | '§33.1' | '§33.3' | '§33.4' | '§33.5' | '§33.6.1' | '§33.6.2' | '§33.7' | '§33.8';

/** Systematikk-referanse for å vise sammenhenger */
interface SystematikkRef {
  ref: string;
  tekst: string;
}

/** Systematikk-innhold for accordion */
interface Systematikk {
  label: string;
  innhold: SystematikkRef[];
}

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
  systematikk?: Systematikk;
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
  '§24.2.2': {
    inline: 'Gjelder KUN når avtalt risikoovergang etter §24.2.1. Regulerer totalentreprenørens frist for å varsle om forhold i byggherrens materiale som ikke vil oppfylle §14-kravene, samt byggherrens svarplikt.',
    konsekvens: 'Innebærer byggherrens svar en endring uten at endringsordre utstedes, må totalentreprenøren varsle etter §32.2 for å påberope seg endringen (underkategori SVAR_VARSEL).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
    systematikk: {
      label: '§24.2.2: Kontroll, varsling og svar',
      innhold: [
        { ref: 'Forutsetning', tekst: 'Bestemmelsen gjelder kun når partene har avtalt risikoovergang etter §24.2.1 (totalentreprenøren overtar risiko for byggherrens prosjektering).' },
        { ref: '1. Varslingsfrist', tekst: 'Totalentreprenøren har en frist på 5 uker fra kontraktsinngåelse til å varsle (utsettes ved senere mottak av materiale).' },
        { ref: '2. Risikoovergang', tekst: 'Rettidig varsel: totalentreprenøren overtar ikke risikoen. Manglende varsel: risikoen overtas.' },
        { ref: '3. Byggherrens svarplikt', tekst: 'Byggherren må besvare varselet «uten ugrunnet opphold».' },
        { ref: '4. Fastholdelse', tekst: 'Fastholder byggherren sin løsning, bærer byggherren risikoen for sitt valg.' },
        { ref: '5. Svaret er endring (SVAR_VARSEL)', tekst: 'Innebærer svaret en endring, skal byggherren utstede endringsordre (§31.3). Gjør han ikke det, må totalentreprenøren varsle etter §32.2.' },
      ],
    },
  },
  '§25.1.2': {
    inline: 'Totalentreprenøren skal varsle byggherren «uten ugrunnet opphold» etter at han blir eller burde ha blitt oppmerksom på forhold som vil kunne forstyrre gjennomføringen av arbeidet.',
    konsekvens: 'Erstatning – byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Merk: Kravet tapes IKKE (ingen preklusjon).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Hva er «forhold» (§25.1.1)?',
      innhold: [
        { ref: 'Generelt', tekst: 'Byggherrens ytelser og andre forhold byggherren har risikoen for, som vil kunne forstyrre gjennomføringen – særlig:' },
        { ref: 'a)', tekst: 'Ufullstendigheter, uoverensstemmelser eller svakheter i byggherrens prosjektering' },
        { ref: 'b)', tekst: 'Behov for grunnundersøkelser / utilstrekkelige undersøkelser' },
        { ref: 'c)', tekst: 'Feil ved materialer eller andre ytelser fra byggherren' },
        { ref: 'd)', tekst: 'Fysisk arbeidsgrunnlag eller grunnforhold avviker fra forventning' },
      ],
    },
  },
  '§25.2': {
    inline: 'Totalentreprenøren skal varsle byggherren «uten ugrunnet opphold» etter at han blir eller måtte ha blitt klar over at byggherrens prosjektering ikke er egnet til å oppfylle funksjonskravene i §14.',
    konsekvens: 'Erstatning – byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Merk: Kravet tapes IKKE (ingen preklusjon).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Hva er «funksjonskravene»?',
      innhold: [
        { ref: '§14', tekst: 'Krav til kontraktsgjenstanden – ytelse, kvalitet, egenskaper' },
        { ref: 'Aktsomhet', tekst: '«måtte» = kun åpenbare feil utløser varslingsplikt' },
        { ref: 'Plikt', tekst: 'Vurdere «i rimelig utstrekning» – ikke aktiv undersøkelsesplikt' },
      ],
    },
  },
  '§32.2': {
    inline: 'Mottar totalentreprenøren pålegg uten endringsordre, skal han «uten ugrunnet opphold» varsle byggherren dersom han vil påberope seg dette som en endring.',
    konsekvens: 'Gjør han ikke det, taper han retten til å påberope seg at pålegget innebærer en endring.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope at varselet er for sent skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Hva er et «pålegg» (§32.1)?',
      innhold: [
        { ref: 'a)', tekst: 'Pålegg fra person med fullmakt til å gi endringsordre (§31.3)' },
        { ref: 'b)', tekst: 'Pålegg fra person med kontroll-/påleggsfullmakt, gitt under ordinære oppgaver' },
        { ref: 'c)', tekst: 'Arbeidstegninger, arbeidsbeskrivelser eller lignende fra byggherren' },
        { ref: '+', tekst: 'Pålegg fra offentlig myndighet (§32.2 annet ledd)' },
      ],
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
    konsekvens: 'Vilkår: Både hindring og årsakssammenheng må påvises. Partene har tapsbegrensningsplikt (§33.5).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
    systematikk: {
      label: 'Hvilke forhold gir rett?',
      innhold: [
        { ref: 'a) Endringer', tekst: '§31 (formell EO) og §32 (irregulær) – vederlag etter §34.1.1' },
        { ref: 'b) Svikt/forsinkelse', tekst: 'BHs ytelser (§22-24) – vederlag etter §34.1.2' },
        { ref: 'c) Andre forhold', tekst: 'Sekkepost for byggherrerisiko – vederlag etter §34.1.2' },
      ],
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
    systematikk: {
      label: 'Hva er «forholdet»?',
      innhold: [
        { ref: '§33.1 a)', tekst: 'Endringer (§31, §32)' },
        { ref: '§33.1 b)', tekst: 'Svikt ved BHs ytelser (§22-24) – se også §25.1.2 ("burde") / §25.2 ("måtte")' },
        { ref: '§33.1 c)', tekst: 'Andre forhold byggherren har risikoen for' },
        { ref: '§33.3', tekst: 'Force majeure (kun fristforlengelse, ikke vederlag)' },
      ],
    },
  },
  '§33.5': {
    inline: 'Fristforlengelsen skal svare til den virkning på fremdriften som forholdet har forårsaket, der det blant annet tas hensyn til nødvendig avbrudd og eventuell forskyvning til ugunstigere eller gunstigere årstid. Det skal også tas hensyn til samlet virkning av tidligere varslede forhold som kunne gi rett til fristforlengelse.',
    konsekvens: 'Partene plikter å forebygge og begrense skadevirkningene av en fristforlengelse og samarbeide om tiltak som kan iverksettes (tapsbegrensningsplikt).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '', // Ingen §5-mekanisme for beregningsregler
    },
  },
  '§33.6.1': {
    inline: 'Når parten har grunnlag for å beregne omfanget, skal han «uten ugrunnet opphold» angi og begrunne antall dager.',
    konsekvens: 'Bare krav på slik fristforlengelse som byggherren «måtte forstå» at han hadde krav på.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses kravet gitt i tide.',
    },
    systematikk: {
      label: 'Når har du «beregningsgrunnlag»?',
      innhold: [
        { ref: 'Skjæringstidspunkt', tekst: 'Når du kan beregne virkningen på fremdriften' },
        { ref: 'For sent?', tekst: 'Kun det byggherren «måtte forstå» godkjennes ved for sent varsel' },
      ],
    },
  },
  '§33.6.2': {
    inline: 'Totalentreprenøren skal svare «uten ugrunnet opphold» etter mottak av byggherrens forespørsel – enten (a) angi og begrunne antall dager, eller (b) begrunne hvorfor grunnlaget for å beregne kravet ikke foreligger.',
    konsekvens: 'Krav på fristforlengelse tapes dersom totalentreprenøren ikke gjør noen av delene.',
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
  const [konsekvensOpen, setKonsekvensOpen] = useState(false);
  const [systematikkOpen, setSystematikkOpen] = useState(false);

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
          <Collapsible.Root open={konsekvensOpen} onOpenChange={setKonsekvensOpen} className="mt-3">
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-pkt-text-interactive hover:text-pkt-text-interactive-hover transition-colors"
              >
                <ChevronRightIcon
                  className={`h-4 w-4 transition-transform duration-200 ${konsekvensOpen ? 'rotate-90' : ''}`}
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
  const harSystematikk = !!hjemmelInnhold.systematikk;

  return (
    <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
      {/* Inline tekst - alltid synlig */}
      <p className="text-sm text-pkt-text-body">
        {hjemmelInnhold.inline} <span className="text-pkt-text-body-subtle">({props.hjemmel})</span>
      </p>

      {/* Accordion for konsekvenser */}
      <Collapsible.Root open={konsekvensOpen} onOpenChange={setKonsekvensOpen} className="mt-3">
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-pkt-text-interactive hover:text-pkt-text-interactive-hover transition-colors"
          >
            <ChevronRightIcon
              className={`h-4 w-4 transition-transform duration-200 ${konsekvensOpen ? 'rotate-90' : ''}`}
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

      {/* Accordion for systematikk */}
      {harSystematikk && (
        <Collapsible.Root open={systematikkOpen} onOpenChange={setSystematikkOpen} className="mt-2">
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-pkt-text-interactive hover:text-pkt-text-interactive-hover transition-colors"
            >
              <ChevronRightIcon
                className={`h-4 w-4 transition-transform duration-200 ${systematikkOpen ? 'rotate-90' : ''}`}
              />
              {hjemmelInnhold.systematikk!.label}
            </button>
          </Collapsible.Trigger>

          <Collapsible.Content className="mt-2 pl-5 border-l-2 border-pkt-border-subtle">
            <dl className="space-y-3 sm:space-y-1 text-sm">
              {hjemmelInnhold.systematikk!.innhold.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:gap-2">
                  <dt className="font-medium text-pkt-text-body-subtle shrink-0">{item.ref}:</dt>
                  <dd className="text-pkt-text-body">{item.tekst}</dd>
                </div>
              ))}
            </dl>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </div>
  );
}

/** @deprecated Bruk KontraktsregelInline i stedet */
export const VarslingsregelInline = KontraktsregelInline;
