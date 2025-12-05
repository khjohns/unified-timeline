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
    dato_varsel_sendt: '2025-01-15',
    varsel_metode: ['epost', 'byggemote'],
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
    inkluderer_produktivitetstap: false,
    inkluderer_rigg_drift: true,
    saerskilt_varsel_rigg_drift: true,
    siste_oppdatert: '2025-01-18',
    antall_versjoner: 1,
  },

  // Frist track
  frist: {
    status: 'delvis_godkjent',
    krevd_dager: 45,
    frist_type: 'uspesifisert_krav',
    begrunnelse:
      'Fristforlengelse nødvendig pga. omprosjektering av fundament (20 dager) og ekstra boring/sprengning (25 dager). Påvirker kritisk linje.',
    pavirker_kritisk_linje: true,
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
    dato_varsel_sendt: '2024-11-10',
    varsel_metode: ['epost'],
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
    inkluderer_produktivitetstap: false,
    inkluderer_rigg_drift: false,
    bh_resultat: 'godkjent_fullt',
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
    frist_type: 'spesifisert_krav',
    begrunnelse: 'Tid for levering og montering av glassfasade.',
    pavirker_kritisk_linje: false,
    bh_resultat: 'godkjent_fullt',
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
 * Example case 4: Case awaiting specification with frist_for_spesifisering
 */
export const mockSakState4: SakState = {
  sak_id: 'SAK-2025-003',
  sakstittel: 'Tilleggsarbeid - Rørføring omlegging',

  grunnlag: {
    status: 'godkjent',
    hovedkategori: 'uforutsette_forhold',
    underkategori: 'Rørføring',
    beskrivelse:
      'Eksisterende rørføring for vann og avløp avviker fra tegninger. Må legges om for å unngå kollisjon med nye konstruksjoner.',
    dato_oppdaget: '2025-01-28',
    dato_varsel_sendt: '2025-01-28',
    varsel_metode: ['epost', 'telefon'],
    kontraktsreferanser: ['§3.2', '§4.2'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Grunnlag godkjent. Dokumentert med foto og nye målinger.',
    laast: true,
    siste_oppdatert: '2025-01-30',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    krevd_belop: 450000,
    metode: 'direkte_kostnader',
    begrunnelse:
      'Foreløpig krav basert på estimat. Endelig spesifikasjon med detaljert kostnadskalkyle følger innen fastsatt frist.',
    inkluderer_produktivitetstap: true,
    inkluderer_rigg_drift: true,
    bh_resultat: 'avventer_spesifikasjon',
    bh_begrunnelse:
      'Grunnlaget er akseptert, men kravet mangler tilstrekkelig spesifikasjon. TE må levere detaljert kostnadskalkyle og dokumentasjon innen 2025-02-15.',
    siste_oppdatert: '2025-02-01',
    antall_versjoner: 1,
  },

  frist: {
    status: 'under_behandling',
    krevd_dager: 21,
    frist_type: 'uspesifisert_krav',
    begrunnelse:
      'Foreløpig krav. Detaljert framdriftsplan med arbeidsoperasjoner følger i endelig spesifikasjon.',
    pavirker_kritisk_linje: true,
    bh_resultat: 'avventer_spesifikasjon',
    bh_begrunnelse:
      'Fristkravet mangler dokumentasjon av arbeidsoperasjoner og påvirkning på framdrift. TE må levere detaljert framdriftsplan innen 2025-02-15.',
    frist_for_spesifisering: '2025-02-15',
    siste_oppdatert: '2025-02-01',
    antall_versjoner: 1,
  },

  overordnet_status: 'UNDER_BEHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'TE',
    handling: 'Lever ytterligere spesifikasjon innen 2025-02-15',
    spor: null,
  },

  sum_krevd: 450000,
  sum_godkjent: 0,

  opprettet: '2025-01-28',
  siste_aktivitet: '2025-02-01',
  antall_events: 5,
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
    sammendrag: 'Krav på 45 dager forlengelse (uspesifisert krav)',
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
    sammendrag: 'Fristkrav godkjent - 14 dager (spesifisert krav)',
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
    sammendrag: 'Krav på 14 dager forlengelse (spesifisert krav)',
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

export const mockTimelineEvents4: TimelineEntry[] = [
  {
    event_id: 'evt-301',
    tidsstempel: '2025-02-01T10:30:00Z',
    type: 'Respons på fristkrav',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Avventer spesifikasjon - frist til 2025-02-15',
  },
  {
    event_id: 'evt-302',
    tidsstempel: '2025-02-01T10:00:00Z',
    type: 'Respons på vederlagskrav',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Avventer spesifikasjon - detaljert kostnadskalkyle kreves',
  },
  {
    event_id: 'evt-303',
    tidsstempel: '2025-01-30T14:00:00Z',
    type: 'Respons på grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - avvik dokumentert',
  },
  {
    event_id: 'evt-304',
    tidsstempel: '2025-01-29T11:30:00Z',
    type: 'Fristkrav sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 21 dager forlengelse (uspesifisert krav)',
  },
  {
    event_id: 'evt-305',
    tidsstempel: '2025-01-29T11:00:00Z',
    type: 'Vederlagskrav sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 450.000 NOK - direkte kostnader',
  },
  {
    event_id: 'evt-306',
    tidsstempel: '2025-01-28T15:00:00Z',
    type: 'Grunnlag opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om avvik i rørføring - må legges om',
  },
];

/**
 * Example case 5: Disputed case with subsidiary responses
 * Grunnlag rejected, but vederlag/frist handled subsidiarily
 */
export const mockSakState5: SakState = {
  sak_id: 'SAK-2025-005',
  sakstittel: 'Omtvistet endring - Teknisk rom',

  grunnlag: {
    status: 'avvist',
    hovedkategori: 'ENDRING',
    underkategori: ['IRREG'],
    beskrivelse:
      'Entreprenøren hevder at muntlig beskjed om endret plassering av teknisk rom utgjør en irregulær endring.',
    dato_oppdaget: '2025-02-01',
    grunnlag_varsel: {
      dato_sendt: '2025-02-02',
      metode: ['epost'],
    },
    kontraktsreferanser: ['§32.1'],
    bh_resultat: 'avvist_uenig',
    bh_begrunnelse:
      'BH bestrider at det foreligger en endring. Plasseringen var allerede avtalt i kontrakten.',
    laast: false,
    siste_oppdatert: '2025-02-05',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    krevd_belop: 450000,
    metode: 'regning',
    begrunnelse: 'Ekstra rørlegging og tilpasningsarbeid.',
    inkluderer_rigg_drift: true,
    rigg_drift_varsel: {
      dato_sendt: '2025-02-02',
      metode: ['epost'],
    },
    // BH has given subsidiary response
    bh_resultat: 'delvis_godkjent',
    bh_begrunnelse: 'Subsidiært: Beløp OK, men bestrider grunnlaget.',
    godkjent_belop: 400000,
    siste_oppdatert: '2025-02-06',
    antall_versjoner: 1,
  },

  frist: {
    status: 'under_behandling',
    varsel_type: 'spesifisert',
    krevd_dager: 14,
    begrunnelse: 'Omlegging av rør krever 14 ekstra dager.',
    pavirker_kritisk_linje: true,
    bh_resultat: 'godkjent_fullt',
    bh_begrunnelse: 'Subsidiært: Dagene godkjennes dersom ansvar avklares.',
    godkjent_dager: 14,
    siste_oppdatert: '2025-02-06',
    antall_versjoner: 1,
  },

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: true,
  er_subsidiaert_frist: true,
  visningsstatus_vederlag: 'Avslått pga. ansvar (Subsidiært: 400 000 kr godkjent)',
  visningsstatus_frist: 'Avslått pga. ansvar (Subsidiært: 14 dager godkjent)',

  overordnet_status: 'UNDER_FORHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: null,
    handling: 'Avklare tvist om grunnlag',
    spor: 'grunnlag',
  },

  sum_krevd: 450000,
  sum_godkjent: 0,

  opprettet: '2025-02-01',
  siste_aktivitet: '2025-02-06',
  antall_events: 6,
};

/**
 * Example case 6: Forsering in progress
 * BH rejected frist, TE has declared forsering (§33.8)
 */
export const mockSakState6: SakState = {
  sak_id: 'SAK-2025-006',
  sakstittel: 'Forsering - Prosjekteringsforsinkelse',

  grunnlag: {
    status: 'godkjent',
    hovedkategori: 'SVIKT',
    underkategori: ['MEDVIRK'],
    beskrivelse:
      'Forsinket leveranse av tegninger for elektroinstallasjon medførte stopp i arbeidet.',
    dato_oppdaget: '2025-01-20',
    grunnlag_varsel: {
      dato_sendt: '2025-01-20',
      metode: ['epost', 'byggemote'],
    },
    kontraktsreferanser: ['§22.3'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Forsinkelsen erkjennes.',
    laast: true,
    siste_oppdatert: '2025-01-25',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    krevd_belop: 850000,
    metode: 'regning',
    begrunnelse: 'Stillstand og omorganisering av mannskap.',
    inkluderer_produktivitetstap: true,
    produktivitetstap_varsel: {
      dato_sendt: '2025-01-20',
      metode: ['epost'],
    },
    siste_oppdatert: '2025-01-28',
    antall_versjoner: 1,
  },

  frist: {
    status: 'avvist',
    varsel_type: 'spesifisert',
    krevd_dager: 21,
    begrunnelse: 'Stopp i elektroarbeid i 3 uker.',
    pavirker_kritisk_linje: true,
    bh_resultat: 'avslatt_ingen_hindring',
    bh_begrunnelse: 'BH mener forsinkelsen kan tas igjen med parallellarbeid.',
    godkjent_dager: 0,
    differanse_dager: -21,

    // FORSERING IS ACTIVE
    forsering: {
      er_varslet: true,
      dato_varslet: '2025-02-01',
      estimert_kostnad: 380000,
      begrunnelse: 'Overtid og ekstra skift for elektrikere i 3 uker.',
      bekreft_30_prosent_regel: true,
      er_iverksatt: true,
      dato_iverksatt: '2025-02-02',
      er_stoppet: false,
    },

    siste_oppdatert: '2025-02-02',
    antall_versjoner: 2,
  },

  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Under behandling',
  visningsstatus_frist: 'Avslått - Forsering iverksatt',

  overordnet_status: 'UNDER_FORHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'BH',
    handling: 'Vurder å godkjenne frist for å stoppe forsering',
    spor: 'frist',
  },

  sum_krevd: 850000,
  sum_godkjent: 0,

  opprettet: '2025-01-20',
  siste_aktivitet: '2025-02-02',
  antall_events: 8,
};

/**
 * Example case 7: Hold-back case (§30.2)
 * BH is holding back payment until overslag is received
 */
export const mockSakState7: SakState = {
  sak_id: 'SAK-2025-007',
  sakstittel: 'Tilbakeholdelse - Mangler overslag',

  grunnlag: {
    status: 'godkjent',
    hovedkategori: 'ENDRING',
    underkategori: ['IRREG'],
    beskrivelse: 'Endret utforming av resepsjon etter muntlig instruks.',
    dato_oppdaget: '2025-02-10',
    grunnlag_varsel: {
      dato_sendt: '2025-02-10',
      metode: ['system'],
    },
    kontraktsreferanser: ['§32.1'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Endringen aksepteres.',
    laast: true,
    siste_oppdatert: '2025-02-12',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    krevd_belop: 220000,
    metode: 'overslag',  // Regningsarbeid with overslag
    begrunnelse: 'Snekkerarbeid og ny innredning. Endelig beløp kommer.',
    // BH is holding back until proper overslag is provided
    bh_resultat: 'hold_tilbake',
    bh_begrunnelse:
      'Jf. §30.2: Betaling holdes tilbake inntil TE leverer bindende prisoverslag.',
    siste_oppdatert: '2025-02-15',
    antall_versjoner: 1,
  },

  frist: {
    status: 'godkjent',
    varsel_type: 'spesifisert',
    krevd_dager: 7,
    begrunnelse: 'Enkelt snekkerarbeid.',
    pavirker_kritisk_linje: false,
    bh_resultat: 'godkjent_fullt',
    bh_begrunnelse: 'Dagene godkjennes.',
    godkjent_dager: 7,
    differanse_dager: 0,
    siste_oppdatert: '2025-02-15',
    antall_versjoner: 1,
  },

  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Tilbakeholdt (Avventer overslag)',
  visningsstatus_frist: 'Godkjent (7 dager)',

  overordnet_status: 'UNDER_BEHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'TE',
    handling: 'Lever bindende prisoverslag (§30.2)',
    spor: 'vederlag',
  },

  sum_krevd: 220000,
  sum_godkjent: 0,

  opprettet: '2025-02-10',
  siste_aktivitet: '2025-02-15',
  antall_events: 5,
};

export const mockTimelineEvents5: TimelineEntry[] = [
  {
    event_id: 'evt-501',
    tidsstempel: '2025-02-06T10:00:00Z',
    type: 'Subsidiært svar på frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Subsidiært godkjent 14 dager (bestrider grunnlag)',
  },
  {
    event_id: 'evt-502',
    tidsstempel: '2025-02-05T14:00:00Z',
    type: 'Respons på grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag avvist - uenig i at det er en endring',
  },
];

export const mockTimelineEvents6: TimelineEntry[] = [
  {
    event_id: 'evt-601',
    tidsstempel: '2025-02-02T09:00:00Z',
    type: 'Forsering varslet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Forsering iverksatt - estimert kostnad kr 380 000,-',
  },
  {
    event_id: 'evt-602',
    tidsstempel: '2025-02-01T15:00:00Z',
    type: 'Fristkrav avslått',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Avslått - mener forsinkelse kan hentes inn',
  },
];

export const mockTimelineEvents7: TimelineEntry[] = [
  {
    event_id: 'evt-701',
    tidsstempel: '2025-02-15T11:00:00Z',
    type: 'Vederlag tilbakeholdt',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Holder tilbake betaling - avventer overslag (§30.2)',
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
    case 'SAK-2025-003':
      return mockSakState4;
    case 'SAK-2025-005':
      return mockSakState5;
    case 'SAK-2025-006':
      return mockSakState6;
    case 'SAK-2025-007':
      return mockSakState7;
    default:
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
    case 'SAK-2025-003':
      return mockTimelineEvents4;
    case 'SAK-2025-005':
      return mockTimelineEvents5;
    case 'SAK-2025-006':
      return mockTimelineEvents6;
    case 'SAK-2025-007':
      return mockTimelineEvents7;
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
    id: 'SAK-2025-003',
    title: 'Tilleggsarbeid - Rørføring omlegging',
    status: 'Avventer spesifikasjon',
  },
  {
    id: 'SAK-2024-089',
    title: 'Ekstraarbeid - Fasadeendringer',
    status: 'Klar for EO',
  },
  {
    id: 'SAK-2025-005',
    title: 'Omtvistet endring - Teknisk rom',
    status: 'Omtvistet (Subsidiær)',
  },
  {
    id: 'SAK-2025-006',
    title: 'Forsering - Prosjekteringsforsinkelse',
    status: 'Forsering aktiv',
  },
  {
    id: 'SAK-2025-007',
    title: 'Tilbakeholdelse - Mangler overslag',
    status: 'Tilbakeholdt (§30.2)',
  },
];
