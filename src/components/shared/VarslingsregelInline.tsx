/**
 * VarslingsregelInline Component
 *
 * Kompakt, inline komponent for å vise varslingsregler fra NS 8407.
 * Bruker kontraktstekstens ordlyd og progressiv avsløring via accordion.
 *
 * Struktur:
 * - Inline tekst: Hvem + frist + trigger (alltid synlig)
 * - Accordion: Konsekvens + §5-mekanismen (lukket som default)
 */

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRightIcon } from '@radix-ui/react-icons';

/** Støttede hjemler for fristsporet */
type Hjemmel = '§33.4' | '§33.6.1' | '§33.6.2' | '§33.7' | '§33.8';

/** Hvem ser komponenten */
type Rolle = 'TE' | 'BH';

interface VarslingsregelInlineProps {
  hjemmel: Hjemmel;
  rolle: Rolle;
}

/** Innhold per hjemmel - basert på kontraktsteksten */
const HJEMMEL_INNHOLD: Record<Hjemmel, {
  inline: string;
  konsekvens: string;
  paragraf5: { paaberoper: 'TE' | 'BH'; tekst: string };
}> = {
  '§33.4': {
    inline: 'Totalentreprenøren skal varsle «uten ugrunnet opphold» etter at forholdet oppstår, selv om han ennå ikke kan fremsette et spesifisert krav.',
    konsekvens: 'Krav på fristforlengelse tapes dersom det ikke varsles innen fristen.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses varselet gitt i tide.',
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

export function VarslingsregelInline({ hjemmel, rolle }: VarslingsregelInlineProps) {
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
