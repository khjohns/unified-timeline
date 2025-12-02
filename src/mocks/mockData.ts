/**
 * Mock Data for Development and Testing
 *
 * Provides realistic example data matching the SakState type.
 * Used when VITE_USE_MOCK_API=true or in GitHub Pages preview.
 */

import { SakState, TimelineEntry } from '../types/timeline';

/**
 * Example case 1: Active case with mixed track statuses
 */
export const mockSakState1: SakState = {
  sak_id: 'SAK-2025-001',
  sakstittel: 'Endring av grunnforhold - Bjørvika Utbyggingsprosjekt',

  // Grunnlag track
  grunnlag: {
    status: 'godkjent',
    hovedkategori: 'uforutsette_forhold',
    underkategori: 'Grunnforhold',
    beskrivelse:
      'Ved peling av fundament B3 ble det påtruffet uventet fjell 2,5 meter høyere enn antatt i prosjekteringsgrunnlaget. Dette krever omprosjektering og endrede løsninger for fundamentering.',
    dato_oppdaget: '2025-01-15',
    kontraktsreferanser: ['§3.2', '§4.1', 'Vedlegg A'],
    bh_resultat: 'godkjent',
    bh_begrunnelse:
      'Grunnlaget er godkjent. Fjellforhold bekreftet av geolog. Endringsordre kan utstedes.',
    laast: true,
    siste_oppdatert: '2025-01-20',
    antall_versjoner: 2,
  },

  // Vederlag track
  vederlag: {
    status: 'under_behandling',
    krevd_belop: 2500000,
    metode: 'direkte_kostnader',
    begrunnelse:
      'Kravet inkluderer:\n- Ekstra borekostnader: 1.200.000 NOK\n- Endret fundamentløsning: 800.000 NOK\n- Prosjektering og rådgivning: 300.000 NOK\n- Rigg og drift: 200.000 NOK',
    siste_oppdatert: '2025-01-18',
    antall_versjoner: 1,
  },

  // Frist track
  frist: {
    status: 'delvis_godkjent',
    krevd_dager: 45,
    frist_type: 'kalenderdager',
    begrunnelse:
      'Fristforlengelse nødvendig pga. omprosjektering av fundament (20 dager) og ekstra boring/sprengning (25 dager). Påvirker kritisk linje.',
    bh_resultat: 'delvis_godkjent',
    bh_begrunnelse:
      '30 dager godkjent. Omprosjektering kan gjøres parallelt med andre arbeider. Sprengningsarbeider påvirker kritisk linje.',
    godkjent_dager: 30,
    differanse_dager: -15,
    siste_oppdatert: '2025-01-22',
    antall_versjoner: 2,
  },

  // Computed status
  overordnet_status: 'UNDER_BEHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'BH',
    handling: 'Svar på vederlagskrav',
    spor: 'vederlag',
  },

  // Aggregates
  sum_krevd: 2500000,
  sum_godkjent: 0,

  // Metadata
  opprettet: '2025-01-15',
  siste_aktivitet: '2025-01-22',
  antall_events: 8,
};

/**
 * Example case 2: New case in draft state
 */
export const mockSakState2: SakState = {
  sak_id: 'SAK-2025-002',
  sakstittel: 'Forsinket materialleveranse - Oslo Sykehus',

  grunnlag: {
    status: 'utkast',
    kontraktsreferanser: [],
    laast: false,
    antall_versjoner: 0,
  },

  vederlag: {
    status: 'utkast',
    antall_versjoner: 0,
  },

  frist: {
    status: 'utkast',
    antall_versjoner: 0,
  },

  overordnet_status: 'UTKAST',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'TE',
    handling: 'Send grunnlag',
    spor: 'grunnlag',
  },

  sum_krevd: 0,
  sum_godkjent: 0,

  opprettet: '2025-01-25',
  siste_aktivitet: '2025-01-25',
  antall_events: 1,
};

/**
 * Example case 3: Fully approved case ready for EO
 */
export const mockSakState3: SakState = {
  sak_id: 'SAK-2024-089',
  sakstittel: 'Ekstraarbeid - Fasadeendringer',

  grunnlag: {
    status: 'laast',
    hovedkategori: 'byggherre_endringsordre',
    underkategori: 'Fasadeendringer',
    beskrivelse: 'Byggherre ønsker endring av fasademateriale fra betong til glass.',
    dato_oppdaget: '2024-11-10',
    kontraktsreferanser: ['§5.3'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Designendring godkjent av arkitekt og byggherre.',
    laast: true,
    siste_oppdatert: '2024-11-15',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'godkjent',
    krevd_belop: 850000,
    metode: 'enhetspriser',
    begrunnelse: 'Basert på enhetspriser i kontrakten for glassarbeider.',
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Beløp stemmer med kontraktspriser. Godkjent.',
    godkjent_belop: 850000,
    differanse: 0,
    godkjenningsgrad_prosent: 100,
    siste_oppdatert: '2024-11-18',
    antall_versjoner: 1,
  },

  frist: {
    status: 'godkjent',
    krevd_dager: 14,
    frist_type: 'arbeidsdager',
    begrunnelse: 'Tid for levering og montering av glassfasade.',
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Tid er i henhold til leverandørens spesifikasjoner.',
    godkjent_dager: 14,
    differanse_dager: 0,
    siste_oppdatert: '2024-11-20',
    antall_versjoner: 1,
  },

  overordnet_status: 'OMFORENT',
  kan_utstede_eo: true,
  neste_handling: {
    rolle: 'BH',
    handling: 'Utstede endringsordre',
    spor: null,
  },

  sum_krevd: 850000,
  sum_godkjent: 850000,

  opprettet: '2024-11-10',
  siste_aktivitet: '2024-11-20',
  antall_events: 6,
};

/**
 * Example timeline events
 */
export const mockTimelineEvents1: TimelineEntry[] = [
  {
    event_id: 'evt-001',
    tidsstempel: '2025-01-22T14:30:00Z',
    type: 'Respons på fristkrav',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Fristkrav delvis godkjent - 30 av 45 dager godkjent',
  },
  {
    event_id: 'evt-002',
    tidsstempel: '2025-01-20T11:15:00Z',
    type: 'Respons på grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - fjellforhold bekreftet',
  },
  {
    event_id: 'evt-003',
    tidsstempel: '2025-01-18T09:45:00Z',
    type: 'Vederlagskrav sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 2.500.000 NOK - direkte kostnader',
  },
  {
    event_id: 'evt-004',
    tidsstempel: '2025-01-18T09:40:00Z',
    type: 'Fristkrav sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 45 kalenderdager forlengelse',
  },
  {
    event_id: 'evt-005',
    tidsstempel: '2025-01-17T16:20:00Z',
    type: 'Grunnlag oppdatert',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Lagt til geologisk rapport og reviderte tegninger',
  },
  {
    event_id: 'evt-006',
    tidsstempel: '2025-01-15T13:00:00Z',
    type: 'Grunnlag opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om endrede grunnforhold - uventet fjell',
  },
  {
    event_id: 'evt-007',
    tidsstempel: '2025-01-15T12:00:00Z',
    type: 'Sak opprettet',
    aktor: 'System',
    rolle: 'TE',
    spor: null,
    sammendrag: 'Ny endringsmelding opprettet',
  },
];

export const mockTimelineEvents2: TimelineEntry[] = [
  {
    event_id: 'evt-101',
    tidsstempel: '2025-01-25T10:00:00Z',
    type: 'Sak opprettet',
    aktor: 'System',
    rolle: 'TE',
    spor: null,
    sammendrag: 'Ny endringsmelding opprettet',
  },
];

export const mockTimelineEvents3: TimelineEntry[] = [
  {
    event_id: 'evt-201',
    tidsstempel: '2024-11-20T15:00:00Z',
    type: 'Respons på fristkrav',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Fristkrav godkjent - 14 arbeidsdager',
  },
  {
    event_id: 'evt-202',
    tidsstempel: '2024-11-18T14:00:00Z',
    type: 'Respons på vederlagskrav',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Vederlagskrav godkjent - 850.000 NOK',
  },
  {
    event_id: 'evt-203',
    tidsstempel: '2024-11-15T13:00:00Z',
    type: 'Respons på grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - designendring bekreftet',
  },
  {
    event_id: 'evt-204',
    tidsstempel: '2024-11-12T11:00:00Z',
    type: 'Fristkrav sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 14 arbeidsdager forlengelse',
  },
  {
    event_id: 'evt-205',
    tidsstempel: '2024-11-12T10:30:00Z',
    type: 'Vederlagskrav sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 850.000 NOK - enhetspriser',
  },
  {
    event_id: 'evt-206',
    tidsstempel: '2024-11-10T14:00:00Z',
    type: 'Grunnlag opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Fasadeendring etter byggherre sitt ønske',
  },
];

/**
 * Get mock data by case ID
 */
export function getMockStateById(sakId: string): SakState {
  switch (sakId) {
    case 'SAK-2025-001':
      return mockSakState1;
    case 'SAK-2025-002':
      return mockSakState2;
    case 'SAK-2024-089':
      return mockSakState3;
    default:
      // Return first example for any unknown ID
      return mockSakState1;
  }
}

/**
 * Get mock timeline events by case ID
 */
export function getMockTimelineById(sakId: string): TimelineEntry[] {
  switch (sakId) {
    case 'SAK-2025-001':
      return mockTimelineEvents1;
    case 'SAK-2025-002':
      return mockTimelineEvents2;
    case 'SAK-2024-089':
      return mockTimelineEvents3;
    default:
      return mockTimelineEvents1;
  }
}

/**
 * List of available mock cases
 */
export const mockCaseList = [
  {
    id: 'SAK-2025-001',
    title: 'Endring av grunnforhold - Bjørvika',
    status: 'Under behandling',
  },
  {
    id: 'SAK-2025-002',
    title: 'Forsinket materialleveranse - Oslo Sykehus',
    status: 'Utkast',
  },
  {
    id: 'SAK-2024-089',
    title: 'Ekstraarbeid - Fasadeendringer',
    status: 'Klar for EO',
  },
];
