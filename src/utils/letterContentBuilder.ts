/**
 * Letter Content Builder
 *
 * Builds structured letter content from response events and case state.
 * Used by LetterPreviewModal to generate editable letter sections.
 */

import type {
  TimelineEvent,
  SakState,
  SporType,
  ResponsGrunnlagEventData,
  ResponsVederlagEventData,
  ResponsFristEventData,
} from '../types/timeline';
import type {
  BrevInnhold,
  BrevSeksjoner,
  BrevSeksjon,
  BrevPart,
  BrevReferanser,
} from '../types/letter';
import { getSporLabel, getSporTittel } from '../types/letter';
import { extractEventType } from '../types/timeline';

/**
 * Format date to Norwegian locale.
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Oslo',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get the claim date for a given spor from state.
 */
function getKravDato(spor: SporType, state: SakState): string | undefined {
  switch (spor) {
    case 'grunnlag':
      return state.grunnlag.grunnlag_varsel?.dato_sendt;
    case 'vederlag':
      return state.vederlag.krav_fremmet_dato;
    case 'frist':
      return state.frist.spesifisert_varsel?.dato_sendt ||
             state.frist.frist_varsel?.dato_sendt;
    default:
      return undefined;
  }
}

/**
 * Get the begrunnelse (justification) from a response event.
 */
function getBegrunnelse(event: TimelineEvent, spor: SporType): string {
  const data = event.data;
  if (!data) return '';

  switch (spor) {
    case 'grunnlag': {
      const grunnlagData = data as ResponsGrunnlagEventData;
      return grunnlagData.begrunnelse || '';
    }
    case 'vederlag': {
      const vederlagData = data as ResponsVederlagEventData;
      return vederlagData.begrunnelse || '';
    }
    case 'frist': {
      const fristData = data as ResponsFristEventData;
      return fristData.begrunnelse || '';
    }
    default:
      return '';
  }
}

/**
 * Create a BrevSeksjon with tracking.
 */
function createSeksjon(tittel: string, tekst: string): BrevSeksjon {
  return {
    tittel,
    originalTekst: tekst,
    redigertTekst: tekst,
  };
}

/**
 * Build the introduction section text.
 */
function buildInnledning(
  spor: SporType,
  state: SakState,
  kravDato?: string
): string {
  const sporLabel = getSporLabel(spor);
  const formattedKravDato = kravDato ? formatDate(kravDato) : '[dato ikke angitt]';

  // Get category info for grunnlag
  let forholdTekst = '';
  if (state.grunnlag.hovedkategori) {
    forholdTekst = ` i forbindelse med forholdet varslet ${formatDate(state.grunnlag.grunnlag_varsel?.dato_sendt)}`;
  }

  const lines: string[] = [];

  lines.push(
    `Det vises til krav om ${sporLabel} fremsatt ${formattedKravDato}${forholdTekst}.`
  );

  // Add reference to case
  lines.push('');
  lines.push(`Gjelder: ${state.sakstittel || 'Uten tittel'}`);
  lines.push(`Sak-ID: ${state.sak_id}`);

  return lines.join('\n');
}

/**
 * Build the closing section text.
 */
function buildAvslutning(avsenderRolle: 'TE' | 'BH'): string {
  const rolleNavn = avsenderRolle === 'BH' ? 'Byggherre' : 'Totalentreprenør';

  return `Med vennlig hilsen

${rolleNavn}

___________________________
Signatur

___________________________
Dato`;
}

/**
 * Build letter sections from event and state.
 */
function buildSeksjoner(
  event: TimelineEvent,
  spor: SporType,
  state: SakState
): BrevSeksjoner {
  const kravDato = getKravDato(spor, state);
  const begrunnelse = getBegrunnelse(event, spor);
  const avsenderRolle = event.actorrole || 'BH';

  return {
    innledning: createSeksjon('Innledning', buildInnledning(spor, state, kravDato)),
    begrunnelse: createSeksjon('Begrunnelse', begrunnelse),
    avslutning: createSeksjon('Avslutning', buildAvslutning(avsenderRolle)),
  };
}

/**
 * Build recipient info (the other party).
 */
function buildMottaker(avsenderRolle: 'TE' | 'BH', state: SakState): BrevPart {
  // Mottaker is the opposite of avsender
  if (avsenderRolle === 'BH') {
    return {
      navn: state.entreprenor || 'Totalentreprenør',
      rolle: 'TE',
      adresse: '[Adresse]',
      orgnr: '[Org.nr]',
    };
  } else {
    return {
      navn: state.byggherre || 'Byggherre',
      rolle: 'BH',
      adresse: '[Adresse]',
      orgnr: '[Org.nr]',
    };
  }
}

/**
 * Build sender info.
 */
function buildAvsender(
  event: TimelineEvent,
  state: SakState
): BrevPart {
  const rolle = event.actorrole || 'BH';

  if (rolle === 'BH') {
    return {
      navn: state.byggherre || 'Byggherre',
      rolle: 'BH',
      adresse: '[Adresse]',
      orgnr: '[Org.nr]',
    };
  } else {
    return {
      navn: state.entreprenor || 'Totalentreprenør',
      rolle: 'TE',
      adresse: '[Adresse]',
      orgnr: '[Org.nr]',
    };
  }
}

/**
 * Build reference information.
 */
function buildReferanser(
  event: TimelineEvent,
  spor: SporType,
  state: SakState
): BrevReferanser {
  return {
    sakId: state.sak_id,
    sakstittel: state.sakstittel || 'Uten tittel',
    eventId: event.id,
    sporType: spor,
    dato: event.time || new Date().toISOString(),
    kravDato: getKravDato(spor, state),
  };
}

/**
 * Build letter title.
 */
function buildTittel(spor: SporType, state: SakState): string {
  const sporTittel = getSporTittel(spor);
  return `Vedr: ${sporTittel} - ${state.sakstittel || state.sak_id}`;
}

/**
 * Determine spor from event type.
 */
function getSporFromEvent(event: TimelineEvent): SporType {
  const eventType = extractEventType(event.type);

  if (eventType?.includes('grunnlag')) return 'grunnlag';
  if (eventType?.includes('vederlag')) return 'vederlag';
  if (eventType?.includes('frist')) return 'frist';

  // Fallback to event's spor attribute
  return event.spor || 'grunnlag';
}

/**
 * Build complete letter content from a response event.
 *
 * @param event - The response event (respons_grunnlag, respons_vederlag, respons_frist)
 * @param state - The current case state
 * @returns Complete letter content ready for editing and PDF generation
 */
export function buildLetterContent(
  event: TimelineEvent,
  state: SakState
): BrevInnhold {
  const spor = getSporFromEvent(event);
  const avsenderRolle = event.actorrole || 'BH';

  return {
    tittel: buildTittel(spor, state),
    mottaker: buildMottaker(avsenderRolle, state),
    avsender: buildAvsender(event, state),
    referanser: buildReferanser(event, spor, state),
    seksjoner: buildSeksjoner(event, spor, state),
  };
}

/**
 * Check if any section has been edited from original.
 */
export function hasEdits(seksjoner: BrevSeksjoner): boolean {
  return (
    seksjoner.innledning.redigertTekst !== seksjoner.innledning.originalTekst ||
    seksjoner.begrunnelse.redigertTekst !== seksjoner.begrunnelse.originalTekst ||
    seksjoner.avslutning.redigertTekst !== seksjoner.avslutning.originalTekst
  );
}

/**
 * Reset a section to its original text.
 */
export function resetSeksjon(seksjon: BrevSeksjon): BrevSeksjon {
  return {
    ...seksjon,
    redigertTekst: seksjon.originalTekst,
  };
}

/**
 * Check if a specific section has been edited.
 */
export function isSeksjonEdited(seksjon: BrevSeksjon): boolean {
  return seksjon.redigertTekst !== seksjon.originalTekst;
}
