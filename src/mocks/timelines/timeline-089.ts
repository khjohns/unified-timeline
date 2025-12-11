import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2024-089: Ekstraarbeid - Fasadeendringer
 *
 * Key event types:
 * - respons_frist: Response to deadline claims
 * - respons_vederlag: Response to compensation claims
 * - respons_grunnlag: Response to basis/grounds
 * - frist_krav_sendt: Deadline claim sent
 * - vederlag_krav_sendt: Compensation claim sent
 * - grunnlag_opprettet: Basis/grounds created
 */
export const mockTimelineEvents3: TimelineEntry[] = [
  {
    event_id: 'evt-201',
    tidsstempel: '2024-11-20T15:00:00Z',
    type: 'Respons på fristkrav',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Fristkrav godkjent - 14 dager (spesifisert krav)',
    event_data: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      begrunnelse_varsel: 'Varsler mottatt i tide og korrekt utformet.',
      vilkar_oppfylt: true,
      begrunnelse_vilkar: 'Fristforlengelse følger direkte av byggherres designendring.',
      beregnings_resultat: 'godkjent',
      godkjent_dager: 14,
      begrunnelse_beregning: 'Tid er i henhold til leverandørens spesifikasjoner.',
    },
  },
  {
    event_id: 'evt-202',
    tidsstempel: '2024-11-18T14:00:00Z',
    type: 'Respons på vederlagskrav',
    event_type: 'respons_vederlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Vederlagskrav godkjent - 850.000 NOK',
    event_data: {
      beregnings_resultat: 'godkjent',
      godkjent_belop: 850000,
      vederlagsmetode: 'ENHETSPRISER',
      begrunnelse_beregning: 'Beløp stemmer med kontraktspriser. Godkjent.',
    },
  },
  {
    event_id: 'evt-203',
    tidsstempel: '2024-11-15T13:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - designendring bekreftet',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Designendring godkjent av arkitekt og byggherre.',
    },
  },
  {
    event_id: 'evt-204',
    tidsstempel: '2024-11-12T11:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 14 dager forlengelse (spesifisert krav)',
    event_data: {
      varsel_type: 'spesifisert',
      noytralt_varsel: { dato_sendt: '2024-11-10', metode: ['epost'] },
      spesifisert_varsel: { dato_sendt: '2024-11-12', metode: ['epost'] },
      antall_dager: 14,
      begrunnelse: 'Tid for levering og montering av glassfasade.',
    },
  },
  {
    event_id: 'evt-205',
    tidsstempel: '2024-11-12T10:30:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 850.000 NOK - enhetspriser',
    event_data: {
      metode: 'ENHETSPRISER',
      begrunnelse: 'Basert på enhetspriser i kontrakten for glassarbeider.',
      belop_direkte: 850000,
    },
  },
  {
    event_id: 'evt-206',
    tidsstempel: '2024-11-10T14:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Fasadeendring etter byggherre sitt ønske',
    event_data: {
      tittel: 'Fasadeendring fra betong til glass',
      hovedkategori: 'ENDRING',
      underkategori: 'EO',
      beskrivelse: 'Byggherre ønsker endring av fasademateriale fra betong til glass.',
      dato_oppdaget: '2024-11-10',
      grunnlag_varsel: { dato_sendt: '2024-11-10', metode: ['epost'] },
      kontraktsreferanser: ['§31.1'],
    },
  },
];
