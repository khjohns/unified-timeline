/**
 * Letter Types
 *
 * Types for formal letter generation from response events.
 * Letters are structured documents with editable sections.
 */

import type { SporType, TimelineEvent, SakState } from './timeline';

/**
 * A single section in the letter with edit tracking.
 */
export interface BrevSeksjon {
  /** Display title for the section */
  tittel: string;
  /** Auto-generated text from event/begrunnelse */
  originalTekst: string;
  /** Current text (may be edited by user) */
  redigertTekst: string;
}

/**
 * Structured sections of the letter.
 */
export interface BrevSeksjoner {
  innledning: BrevSeksjon;
  begrunnelse: BrevSeksjon;
  avslutning: BrevSeksjon;
}

/**
 * Recipient/sender information.
 */
export interface BrevPart {
  navn: string;
  rolle: 'TE' | 'BH';
  adresse?: string;
  orgnr?: string;
}

/**
 * Reference information for the letter.
 */
export interface BrevReferanser {
  sakId: string;
  sakstittel: string;
  eventId: string;
  sporType: SporType;
  dato: string;
  /** Original claim date (for responses) */
  kravDato?: string;
}

/**
 * Complete letter content ready for rendering.
 */
export interface BrevInnhold {
  /** Letter title/subject */
  tittel: string;
  /** Recipient info */
  mottaker: BrevPart;
  /** Sender info */
  avsender: BrevPart;
  /** Reference information */
  referanser: BrevReferanser;
  /** Editable sections */
  seksjoner: BrevSeksjoner;
}

/**
 * Supported event types for letter generation.
 */
export type LetterSupportedEventType =
  | 'respons_grunnlag'
  | 'respons_vederlag'
  | 'respons_frist';

/**
 * Check if an event type supports letter generation.
 */
export function isLetterSupportedEvent(eventType: string): eventType is LetterSupportedEventType {
  return [
    'respons_grunnlag',
    'respons_vederlag',
    'respons_frist',
  ].includes(eventType);
}

/**
 * Props for the letter preview modal.
 */
export interface LetterPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: TimelineEvent;
  sakState: SakState;
}

/**
 * Get spor label in Norwegian.
 */
export function getSporLabel(spor: SporType): string {
  const labels: Record<SporType, string> = {
    grunnlag: 'ansvarsgrunnlag',
    vederlag: 'vederlagsjustering',
    frist: 'fristforlengelse',
  };
  return labels[spor];
}

/**
 * Get spor title (capitalized) in Norwegian.
 */
export function getSporTittel(spor: SporType): string {
  const titles: Record<SporType, string> = {
    grunnlag: 'Ansvarsgrunnlag',
    vederlag: 'Vederlagsjustering',
    frist: 'Fristforlengelse',
  };
  return titles[spor];
}
