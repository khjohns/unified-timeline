// @ts-nocheck - Legacy mock data, needs update to match current types
import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-008: Force Majeure - Storflom Drammenselva
 *
 * Key event types:
 * - respons_frist: Response to deadline claims (force majeure)
 * - frist_krav_sendt: Deadline claim sent (force majeure)
 * - respons_grunnlag: Response to basis/grounds
 * - grunnlag_opprettet: Basis/grounds created (force majeure)
 */
export const mockTimelineEvents8: TimelineEntry[] = [
  {
    event_id: 'evt-801',
    tidsstempel: '2025-03-25T14:00:00Z',
    type: 'Respons på fristkrav',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Force majeure godkjent - 8 dager fristforlengelse',
    event_data: {
      frist_varsel_ok: true,
      spesifisert_krav_ok: true,
      vilkar_oppfylt: true,
      begrunnelse_vilkar: 'Ekstraordinær flom bekreftet. Utenfor partenes kontroll.',
      beregnings_resultat: 'godkjent',
      godkjent_dager: 8,
      begrunnelse: 'Alle 8 dager godkjennes.',
    },
  },
  {
    event_id: 'evt-802',
    tidsstempel: '2025-03-23T10:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Spesifisert krav: 8 dager fristforlengelse pga. flom',
    event_data: {
      varsel_type: 'force_majeure',
      frist_varsel: { dato_sendt: '2025-03-15', metode: ['epost', 'telefon'] },
      spesifisert_varsel: { dato_sendt: '2025-03-23', metode: ['epost'] },
      antall_dager: 8,
      begrunnelse: 'Byggeplass oversvømt og utilgjengelig i 8 dager.',
    },
  },
  {
    event_id: 'evt-803',
    tidsstempel: '2025-03-20T09:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Force majeure-grunnlag godkjent',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Ekstraordinær flom bekreftet. Force majeure anerkjennes.',
    },
  },
  {
    event_id: 'evt-804',
    tidsstempel: '2025-03-15T08:30:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om force majeure - storflom',
    event_data: {
      tittel: 'Force Majeure - Ekstrem flom',
      hovedkategori: 'FORCE_MAJEURE',
      underkategori: 'FM_EGEN',
      beskrivelse: 'Ekstrem flom i Drammenselva. Byggeplass oversvømt.',
      dato_oppdaget: '2025-03-15',
      grunnlag_varsel: { dato_sendt: '2025-03-15', metode: ['epost', 'telefon', 'byggemote'] },
      kontraktsreferanser: ['§33.3'],
    },
  },
];
