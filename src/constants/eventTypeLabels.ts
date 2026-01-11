/**
 * Event Type Labels
 * Human-readable labels for all event types
 */

import { EventType } from '../types/timeline';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  sak_opprettet: 'Sak opprettet',
  grunnlag_opprettet: 'Grunnlag sendt',
  grunnlag_oppdatert: 'Grunnlag oppdatert',
  grunnlag_trukket: 'Grunnlag trukket',
  vederlag_krav_sendt: 'Vederlagskrav sendt',
  vederlag_krav_oppdatert: 'Vederlagskrav oppdatert',
  vederlag_krav_trukket: 'Vederlagskrav trukket',
  frist_krav_sendt: 'Fristkrav sendt',
  frist_krav_oppdatert: 'Fristkrav oppdatert',
  frist_krav_spesifisert: 'Fristkrav spesifisert',
  frist_krav_trukket: 'Fristkrav trukket',
  respons_grunnlag: 'Svar på grunnlag',
  respons_grunnlag_oppdatert: 'Svar på grunnlag oppdatert',
  respons_vederlag: 'Svar på vederlagskrav',
  respons_vederlag_oppdatert: 'Svar på vederlagskrav oppdatert',
  respons_frist: 'Svar på fristkrav',
  respons_frist_oppdatert: 'Svar på fristkrav oppdatert',
  forsering_varsel: 'Varsel om forsering',
  forsering_stoppet: 'Forsering stoppet',
  forsering_respons: 'Svar på forsering',
  forsering_kostnader_oppdatert: 'Forseringskostnader oppdatert',
  forsering_koe_lagt_til: 'KOE lagt til forsering',
  forsering_koe_fjernet: 'KOE fjernet fra forsering',
  // Endringsordre events
  eo_opprettet: 'Endringsordre opprettet',
  eo_koe_lagt_til: 'KOE lagt til EO',
  eo_koe_fjernet: 'KOE fjernet fra EO',
  eo_utstedt: 'Endringsordre utstedt',
  eo_akseptert: 'Endringsordre akseptert',
  eo_bestridt: 'Endringsordre bestridt',
  eo_revidert: 'Endringsordre revidert',
};

/**
 * Get human-readable label for an event type
 * @param eventType - The event type code
 * @returns Human-readable label, or the original code if not found
 */
export function getEventTypeLabel(eventType: string | null | undefined): string {
  if (!eventType) return 'Ukjent hendelse';
  return EVENT_TYPE_LABELS[eventType as EventType] || eventType;
}
