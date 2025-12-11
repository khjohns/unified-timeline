import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-010: Revisjonssyklus - Ekstra sprinkleranlegg
 *
 * Key event types:
 * - respons_vederlag_oppdatert: Updated response to compensation claim
 * - respons_frist_oppdatert: Updated response to deadline claim
 * - vederlag_krav_oppdatert: Updated compensation claim
 * - frist_krav_oppdatert: Updated deadline claim
 * - respons_frist: Response to deadline claims
 * - respons_grunnlag: Response to basis/grounds
 * - respons_vederlag: Response to compensation claims
 * - vederlag_krav_sendt: Compensation claim sent
 * - frist_krav_sendt: Deadline claim sent
 * - grunnlag_opprettet: Basis/grounds created
 * - sak_opprettet: Case created
 */
export const mockTimelineEvents10: TimelineEntry[] = [
  // Event 9: BH oppdaterer fristrespons etter revidert krav
  {
    event_id: 'evt-1009',
    tidsstempel: '2025-02-16T14:00:00Z',
    type: 'Fristrespons oppdatert',
    event_type: 'respons_frist_oppdatert',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Bekrefter 5 dager fortsatt godkjent',
    event_data: {
      original_respons_id: 'evt-1006',
      kommentar: 'Etter gjennomgang av revidert tidsplan bekreftes at 5 dager fortsatt er korrekt.',
      dato_endret: '2025-02-16',
    },
  },
  // Event 8: BH oppdaterer vederlagsrespons - godkjenner fullt ut
  {
    event_id: 'evt-1008',
    tidsstempel: '2025-02-15T11:00:00Z',
    type: 'Vederlagsrespons oppdatert',
    event_type: 'respons_vederlag_oppdatert',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Endret til full godkjenning - 185.000 NOK',
    event_data: {
      original_respons_id: 'evt-1004',
      nytt_resultat: 'godkjent',
      godkjent_belop: 185000,
      kommentar:
        'Etter revisjon av kravet godkjennes hele beløpet. Prosjekteringskostnader korrekt fjernet.',
      dato_endret: '2025-02-15',
    },
  },
  // Event 7b: TE reviderer fristkrav (5 dager fortsatt)
  {
    event_id: 'evt-1007b',
    tidsstempel: '2025-02-13T10:00:00Z',
    type: 'Fristkrav oppdatert',
    event_type: 'frist_krav_oppdatert',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Bekreftet krav: 5 dager',
    event_data: {
      original_event_id: 'evt-1002',
      nye_dager: 5,
      begrunnelse: 'Etter gjennomgang av arbeidsplan bekreftes at 5 dager er korrekt estimat.',
      dato_revidert: '2025-02-13',
    },
  },
  // Event 7: TE reviderer vederlagskrav (ned fra 220k til 185k)
  {
    event_id: 'evt-1007',
    tidsstempel: '2025-02-12T14:30:00Z',
    type: 'Vederlagskrav oppdatert',
    event_type: 'vederlag_krav_oppdatert',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Revidert krav: 220.000 → 185.000 NOK',
    event_data: {
      original_event_id: 'evt-1003',
      nytt_belop_direkte: 185000,
      begrunnelse:
        'Fjernet post for prosjektering (35.000 NOK) etter gjennomgang med BH. Prosjektering inngår i enhetsprisene.',
      dato_revidert: '2025-02-12',
    },
  },
  // Event 6: Frist godkjent
  {
    event_id: 'evt-1006',
    tidsstempel: '2025-02-10T10:00:00Z',
    type: 'Respons på fristkrav',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Fristkrav godkjent - 5 dager',
    event_data: {
      beregnings_resultat: 'godkjent',
      godkjent_dager: 5,
      begrunnelse_beregning: '5 dager godkjent for sprinklerinstallasjon.',
    },
  },
  // Event 5: Grunnlag godkjent
  {
    event_id: 'evt-1005',
    tidsstempel: '2025-02-05T09:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - endring akseptert',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Godkjent som endring. Kravet fra brannvesenet dokumentert.',
    },
  },
  // Event 4: BH gir delvis godkjenning på første vederlagskrav
  {
    event_id: 'evt-1004',
    tidsstempel: '2025-02-08T15:00:00Z',
    type: 'Respons på vederlagskrav',
    event_type: 'respons_vederlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Delvis godkjent - 185.000 av 220.000 NOK',
    event_data: {
      beregnings_resultat: 'delvis_godkjent',
      godkjent_belop: 185000,
      begrunnelse_beregning:
        'Prosjekteringskostnader (35.000 NOK) inngår allerede i enhetsprisene og kan ikke kreves separat.',
    },
  },
  // Event 3: TE sender vederlagskrav
  {
    event_id: 'evt-1003',
    tidsstempel: '2025-02-03T10:00:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 220.000 NOK - enhetspriser',
    event_data: {
      metode: 'ENHETSPRISER',
      belop_direkte: 220000,
      begrunnelse:
        'Materialer og montering iht. enhetspriskontrakt:\n- Sprinklerrør og dyser: 120.000 NOK\n- Montering: 65.000 NOK\n- Prosjektering: 35.000 NOK',
    },
  },
  // Event 2: TE sender fristkrav
  {
    event_id: 'evt-1002',
    tidsstempel: '2025-02-02T14:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 5 dager forlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      antall_dager: 5,
      begrunnelse: '5 dager for installasjon av sprinkleranlegg i teknisk rom.',
    },
  },
  // Event 1: TE sender grunnlag
  {
    event_id: 'evt-1001',
    tidsstempel: '2025-02-01T09:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om pålagt sprinklerutvidelse',
    event_data: {
      tittel: 'Pålagt sprinklerutvidelse - brannkrav',
      hovedkategori: 'ENDRING',
      underkategori: 'IRREG',
      beskrivelse:
        'Pålagt utvidelse av sprinkleranlegg til teknisk rom etter krav fra brannvesenet. Ikke del av opprinnelig kontrakt.',
      dato_oppdaget: '2025-02-01',
      grunnlag_varsel: { dato_sendt: '2025-02-01', metode: ['epost'] },
      kontraktsreferanser: ['§32.1', '§32.2'],
    },
  },
  // Event 0: Sak opprettet
  {
    event_id: 'evt-1000',
    tidsstempel: '2025-02-01T08:00:00Z',
    type: 'Sak opprettet',
    event_type: 'sak_opprettet',
    aktor: 'System',
    rolle: 'TE',
    spor: null,
    sammendrag: 'Ny endringsmelding opprettet',
  },
];
