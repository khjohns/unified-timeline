import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-007: Tilbakeholdelse - Mangler overslag
 *
 * Key event types:
 * - respons_vederlag: Response to compensation claims (hold-back)
 * - respons_frist: Response to deadline claims
 * - respons_grunnlag: Response to basis/grounds
 * - frist_krav_sendt: Deadline claim sent
 * - vederlag_krav_sendt: Compensation claim sent
 * - grunnlag_opprettet: Basis/grounds created
 */
export const mockTimelineEvents7: TimelineEntry[] = [
  {
    event_id: 'evt-701',
    tidsstempel: '2025-02-15T11:00:00Z',
    type: 'Vederlag tilbakeholdt',
    event_type: 'respons_vederlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Holder tilbake betaling - avventer overslag (§30.2)',
    event_data: {
      beregnings_resultat: 'hold_tilbake',
      begrunnelse_beregning: 'Jf. §30.2: Betaling holdes tilbake inntil TE leverer bindende prisoverslag.',
    },
  },
  {
    event_id: 'evt-702',
    tidsstempel: '2025-02-15T10:30:00Z',
    type: 'Respons på fristkrav',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Fristkrav godkjent - 7 dager',
    event_data: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      begrunnelse_varsel: 'Varsler mottatt.',
      vilkar_oppfylt: true,
      begrunnelse_vilkar: 'Endring er godkjent.',
      beregnings_resultat: 'godkjent',
      godkjent_dager: 7,
      begrunnelse_beregning: 'Dagene godkjennes.',
    },
  },
  {
    event_id: 'evt-703',
    tidsstempel: '2025-02-12T14:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - endring akseptert',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Endringen aksepteres.',
    },
  },
  {
    event_id: 'evt-704',
    tidsstempel: '2025-02-11T10:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 7 dager fristforlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      noytralt_varsel: { dato_sendt: '2025-02-10', metode: ['system'] },
      spesifisert_varsel: { dato_sendt: '2025-02-11', metode: ['epost'] },
      antall_dager: 7,
      begrunnelse: 'Enkelt snekkerarbeid.',
    },
  },
  {
    event_id: 'evt-705',
    tidsstempel: '2025-02-11T09:30:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 220.000 NOK (foreløpig overslag)',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Snekkerarbeid og ny innredning. Endelig beløp kommer.',
      kostnads_overslag: 220000,
      regningsarbeid_varsel: { dato_sendt: '2025-02-10', metode: ['system'] },
    },
  },
  {
    event_id: 'evt-706',
    tidsstempel: '2025-02-10T08:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om irregulær endring - resepsjon',
    event_data: {
      hovedkategori: 'ENDRING',
      underkategori: ['IRREG'],
      beskrivelse: 'Endret utforming av resepsjon etter muntlig instruks.',
      dato_oppdaget: '2025-02-10',
      grunnlag_varsel: { dato_sendt: '2025-02-10', metode: ['system'] },
      kontraktsreferanser: ['§32.1'],
    },
  },
];
