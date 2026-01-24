/**
 * KontraktsregelInline Component
 *
 * Kompakt, inline komponent for å vise kontraktsregler fra NS 8407.
 * Bruker kontraktstekstens ordlyd og progressiv avsløring via accordion.
 *
 * Støtter både:
 * - Varslingsregler (§33.4, §33.6, §33.7, §33.8)
 * - Materielle vilkår (§33.1, §33.3, §33.5)
 *
 * Struktur:
 * - Inline tekst: Kontraktstekst (alltid synlig)
 * - Accordion: Konsekvenser/detaljer (lukket som default)
 */

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRightIcon } from '@radix-ui/react-icons';

/** Støttede hjemler for fristsporet */
type Hjemmel = '§33.1' | '§33.3' | '§33.4' | '§33.5' | '§33.6.1' | '§33.6.2' | '§33.7' | '§33.8';

interface KontraktsregelInlineProps {
  hjemmel: Hjemmel;
}

/** Innhold per hjemmel - basert på kontraktsteksten */
const HJEMMEL_INNHOLD: Record<Hjemmel, {
  inline: string;
  konsekvens: string;
  paragraf5: { paaberoper: 'TE' | 'BH'; tekst: string };
}> = {
  '§33.1': {
    inline: 'Totalentreprenøren har krav på fristforlengelse dersom fremdriften hindres som følge av (a) endringer, jf. punkt 31 og 32, (b) forsinkelse eller svikt ved byggherrens ytelser etter punkt 22, 23 og 24, eller (c) andre forhold byggherren har risikoen for.',
    konsekvens: 'Kravet må dokumenteres gjennom årsakssammenheng mellom forholdet og forsinkelsen.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '', // Ingen §5-mekanisme for vilkårsvurderingen
    },
  },
  '§33.3': {
    inline: 'Partene har krav på fristforlengelse dersom fremdriften hindres av forhold utenfor deres kontroll, så som ekstraordinære værforhold, offentlige påbud og forbud, streik, lockout og overenskomstbestemmelser.',
    konsekvens: 'Partene har ikke krav på justering av vederlaget som følge av fristforlengelse etter denne bestemmelsen. En part har ikke krav på fristforlengelse for hindring han eller hans kontraktsmedhjelpere burde ha tatt i betraktning ved kontraktsinngåelsen, eller med rimelighet kunne ventes å unngå eller overvinne følgene av.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '', // Ingen §5-mekanisme for force majeure
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

export function KontraktsregelInline({ hjemmel }: KontraktsregelInlineProps) {
  const [open, setOpen] = useState(false);
  const innhold = HJEMMEL_INNHOLD[hjemmel];

  if (!innhold) {
    return null;
  }

  const visParagraf5 = innhold.paragraf5.tekst.length > 0;

  return (
    <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
      {/* Inline tekst - alltid synlig */}
      <p className="text-sm text-pkt-text-body">
        {innhold.inline} <span className="text-pkt-text-body-subtle">({hjemmel})</span>
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
            <p>{innhold.konsekvens}</p>

            {/* §5-mekanismen */}
            {visParagraf5 && (
              <p className="text-pkt-text-body-subtle">
                {innhold.paragraf5.tekst} <span className="font-medium">(§5)</span>
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
