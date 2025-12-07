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
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 2500000,
    begrunnelse:
      'Kravet inkluderer:\n- Ekstra borekostnader: 1.200.000 NOK\n- Endret fundamentløsning: 800.000 NOK\n- Prosjektering og rådgivning: 300.000 NOK\n- Rigg og drift: 200.000 NOK',
    saerskilt_krav: {
      rigg_drift: true,
      belop: 200000,
    },
    rigg_drift_varsel: {
      dato_sendt: '2025-01-15',
      metode: ['epost'],
    },
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
    metode: 'ENHETSPRISER',
    belop_direkte: 850000,
    begrunnelse: 'Basert på enhetspriser i kontrakten for glassarbeider.',
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
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 450000,
    begrunnelse:
      'Foreløpig krav basert på estimat. Endelig spesifikasjon med detaljert kostnadskalkyle følger innen fastsatt frist.',
    saerskilt_krav: {
      produktivitet: true,
      rigg_drift: true,
    },
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
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Fristkrav delvis godkjent - 30 av 45 dager godkjent',
    event_data: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: false,
      begrunnelse_varsel: 'Nøytralt varsel mottatt i tide. Spesifisert krav mangler detaljert framdriftsanalyse.',
      vilkar_oppfylt: true,
      begrunnelse_vilkar: 'Årsakssammenheng mellom uventet fjell og forsinkelse er dokumentert.',
      beregnings_resultat: 'delvis_godkjent',
      godkjent_dager: 30,
      begrunnelse_beregning: '30 dager godkjent. Omprosjektering kan gjøres parallelt med andre arbeider. Sprengningsarbeider påvirker kritisk linje.',
    },
  },
  {
    event_id: 'evt-002',
    tidsstempel: '2025-01-20T11:15:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - fjellforhold bekreftet',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Grunnlaget er godkjent. Fjellforhold bekreftet av geolog. Endringsordre kan utstedes.',
    },
  },
  {
    event_id: 'evt-003',
    tidsstempel: '2025-01-18T09:45:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 2.500.000 NOK - direkte kostnader',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Kravet inkluderer:\n- Ekstra borekostnader: 1.200.000 NOK\n- Endret fundamentløsning: 800.000 NOK\n- Prosjektering og rådgivning: 300.000 NOK\n- Rigg og drift: 200.000 NOK',
      kostnads_overslag: 2500000,
      saerskilt_krav: {
        rigg_drift: true,
        belop: 200000,
      },
      rigg_drift_varsel: { dato_sendt: '2025-01-15', metode: ['epost'] },
      regningsarbeid_varsel: { dato_sendt: '2025-01-15', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-004',
    tidsstempel: '2025-01-18T09:40:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 45 dager forlengelse (uspesifisert krav)',
    event_data: {
      varsel_type: 'noytralt',
      noytralt_varsel: { dato_sendt: '2025-01-15', metode: ['epost', 'byggemote'] },
      antall_dager: 45,
      begrunnelse: 'Fristforlengelse nødvendig pga. omprosjektering av fundament (20 dager) og ekstra boring/sprengning (25 dager). Påvirker kritisk linje.',
    },
  },
  {
    event_id: 'evt-005',
    tidsstempel: '2025-01-17T16:20:00Z',
    type: 'Grunnlag oppdatert',
    event_type: 'grunnlag_oppdatert',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Lagt til geologisk rapport og reviderte tegninger',
    event_data: {
      original_event_id: 'evt-006',
      endrings_begrunnelse: 'Lagt til geologisk rapport fra Multiconsult og reviderte tegninger som dokumenterer avvik fra prosjekteringsgrunnlaget.',
    },
  },
  {
    event_id: 'evt-006',
    tidsstempel: '2025-01-15T13:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om endrede grunnforhold - uventet fjell',
    event_data: {
      hovedkategori: 'uforutsette_forhold',
      underkategori: 'Grunnforhold',
      beskrivelse: 'Ved peling av fundament B3 ble det påtruffet uventet fjell 2,5 meter høyere enn antatt i prosjekteringsgrunnlaget. Dette krever omprosjektering og endrede løsninger for fundamentering.',
      dato_oppdaget: '2025-01-15',
      grunnlag_varsel: { dato_sendt: '2025-01-15', metode: ['epost', 'byggemote'] },
      kontraktsreferanser: ['§3.2', '§4.1', 'Vedlegg A'],
    },
  },
  {
    event_id: 'evt-007',
    tidsstempel: '2025-01-15T12:00:00Z',
    type: 'Sak opprettet',
    event_type: 'sak_opprettet',
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
    event_type: 'sak_opprettet',
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
      beregnings_resultat: 'godkjent_fullt',
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
      beregnings_resultat: 'godkjent_fullt',
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
      hovedkategori: 'byggherre_endringsordre',
      underkategori: 'Fasadeendringer',
      beskrivelse: 'Byggherre ønsker endring av fasademateriale fra betong til glass.',
      dato_oppdaget: '2024-11-10',
      grunnlag_varsel: { dato_sendt: '2024-11-10', metode: ['epost'] },
      kontraktsreferanser: ['§5.3'],
    },
  },
];

export const mockTimelineEvents4: TimelineEntry[] = [
  {
    event_id: 'evt-301',
    tidsstempel: '2025-02-01T10:30:00Z',
    type: 'Respons på fristkrav',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Avventer spesifikasjon - frist til 2025-02-15',
    event_data: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: false,
      begrunnelse_varsel: 'Nøytralt varsel mottatt i tide, men spesifisert krav mangler.',
      vilkar_oppfylt: true,
      begrunnelse_vilkar: 'Grunnlag er akseptert, årsakssammenheng dokumentert.',
      beregnings_resultat: 'avventer_spesifikasjon',
      frist_for_spesifisering: '2025-02-15',
      begrunnelse_beregning: 'Fristkravet mangler dokumentasjon av arbeidsoperasjoner og påvirkning på framdrift. TE må levere detaljert framdriftsplan innen 2025-02-15.',
    },
  },
  {
    event_id: 'evt-302',
    tidsstempel: '2025-02-01T10:00:00Z',
    type: 'Respons på vederlagskrav',
    event_type: 'respons_vederlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Avventer spesifikasjon - detaljert kostnadskalkyle kreves',
    event_data: {
      beregnings_resultat: 'avventer_spesifikasjon',
      frist_for_spesifikasjon: '2025-02-15',
      begrunnelse_beregning: 'Grunnlaget er akseptert, men kravet mangler tilstrekkelig spesifikasjon. TE må levere detaljert kostnadskalkyle og dokumentasjon innen 2025-02-15.',
    },
  },
  {
    event_id: 'evt-303',
    tidsstempel: '2025-01-30T14:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - avvik dokumentert',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Grunnlag godkjent. Dokumentert med foto og nye målinger.',
    },
  },
  {
    event_id: 'evt-304',
    tidsstempel: '2025-01-29T11:30:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 21 dager forlengelse (uspesifisert krav)',
    event_data: {
      varsel_type: 'noytralt',
      noytralt_varsel: { dato_sendt: '2025-01-28', metode: ['epost', 'telefon'] },
      antall_dager: 21,
      begrunnelse: 'Foreløpig krav. Detaljert framdriftsplan med arbeidsoperasjoner følger i endelig spesifikasjon.',
    },
  },
  {
    event_id: 'evt-305',
    tidsstempel: '2025-01-29T11:00:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 450.000 NOK - direkte kostnader',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Foreløpig krav basert på estimat. Endelig spesifikasjon med detaljert kostnadskalkyle følger innen fastsatt frist.',
      kostnads_overslag: 450000,
      saerskilt_krav: {
        produktivitet: true,
        rigg_drift: true,
      },
      regningsarbeid_varsel: { dato_sendt: '2025-01-28', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-306',
    tidsstempel: '2025-01-28T15:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om avvik i rørføring - må legges om',
    event_data: {
      hovedkategori: 'uforutsette_forhold',
      underkategori: 'Rørføring',
      beskrivelse: 'Eksisterende rørføring for vann og avløp avviker fra tegninger. Må legges om for å unngå kollisjon med nye konstruksjoner.',
      dato_oppdaget: '2025-01-28',
      grunnlag_varsel: { dato_sendt: '2025-01-28', metode: ['epost', 'telefon'] },
      kontraktsreferanser: ['§3.2', '§4.2'],
    },
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
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 450000,
    begrunnelse: 'Ekstra rørlegging og tilpasningsarbeid.',
    saerskilt_krav: {
      rigg_drift: true,
    },
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
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 850000,
    begrunnelse: 'Stillstand og omorganisering av mannskap.',
    saerskilt_krav: {
      produktivitet: true,
    },
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
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 220000,
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
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Subsidiært godkjent 14 dager (bestrider grunnlag)',
    event_data: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      begrunnelse_varsel: 'Varsler er mottatt i tide.',
      vilkar_oppfylt: false,
      begrunnelse_vilkar: 'SUBSIDIÆRT: Grunnlaget bestrides, men dersom ansvar avklares til TEs fordel, godkjennes fristforlengelsen.',
      beregnings_resultat: 'godkjent_fullt',
      godkjent_dager: 14,
      begrunnelse_beregning: 'Subsidiært: Dagene godkjennes dersom ansvar avklares.',
    },
  },
  {
    event_id: 'evt-503',
    tidsstempel: '2025-02-06T09:30:00Z',
    type: 'Subsidiært svar på vederlag',
    event_type: 'respons_vederlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Subsidiært delvis godkjent 400.000 NOK (bestrider grunnlag)',
    event_data: {
      saerskilt_varsel_rigg_drift_ok: true,
      begrunnelse_varsel: 'Særskilt varsel om rigg/drift mottatt.',
      beregnings_resultat: 'delvis_godkjent',
      godkjent_belop: 400000,
      vederlagsmetode: 'REGNINGSARBEID',
      begrunnelse_beregning: 'SUBSIDIÆRT: Beløp OK, men bestrider grunnlaget. Dersom ansvar avklares, godkjennes 400.000 NOK.',
    },
  },
  {
    event_id: 'evt-502',
    tidsstempel: '2025-02-05T14:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag avvist - uenig i at det er en endring',
    event_data: {
      resultat: 'avvist_uenig',
      begrunnelse: 'BH bestrider at det foreligger en endring. Plasseringen var allerede avtalt i kontrakten.',
    },
  },
  {
    event_id: 'evt-504',
    tidsstempel: '2025-02-03T11:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 14 dager fristforlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      noytralt_varsel: { dato_sendt: '2025-02-02', metode: ['epost'] },
      spesifisert_varsel: { dato_sendt: '2025-02-03', metode: ['epost'] },
      antall_dager: 14,
      begrunnelse: 'Omlegging av rør krever 14 ekstra dager.',
    },
  },
  {
    event_id: 'evt-505',
    tidsstempel: '2025-02-03T10:30:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 450.000 NOK for omlegging',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Ekstra rørlegging og tilpasningsarbeid.',
      kostnads_overslag: 450000,
      saerskilt_krav: {
        rigg_drift: true,
      },
      rigg_drift_varsel: { dato_sendt: '2025-02-02', metode: ['epost'] },
      regningsarbeid_varsel: { dato_sendt: '2025-02-02', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-506',
    tidsstempel: '2025-02-02T10:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om irregulær endring - teknisk rom',
    event_data: {
      hovedkategori: 'ENDRING',
      underkategori: ['IRREG'],
      beskrivelse: 'Entreprenøren hevder at muntlig beskjed om endret plassering av teknisk rom utgjør en irregulær endring.',
      dato_oppdaget: '2025-02-01',
      grunnlag_varsel: { dato_sendt: '2025-02-02', metode: ['epost'] },
      kontraktsreferanser: ['§32.1'],
    },
  },
];

export const mockTimelineEvents6: TimelineEntry[] = [
  {
    event_id: 'evt-601',
    tidsstempel: '2025-02-02T09:00:00Z',
    type: 'Forsering varslet',
    event_type: 'forsering_varsel',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Forsering iverksatt - estimert kostnad kr 380 000,-',
    event_data: {
      frist_krav_id: 'evt-604',
      estimert_kostnad: 380000,
      begrunnelse: 'Overtid og ekstra skift for elektrikere i 3 uker.',
      bekreft_30_prosent: true,
      dato_iverksettelse: '2025-02-02',
    },
  },
  {
    event_id: 'evt-602',
    tidsstempel: '2025-02-01T15:00:00Z',
    type: 'Fristkrav avslått',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Avslått - mener forsinkelse kan hentes inn',
    event_data: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      begrunnelse_varsel: 'Varsler mottatt i tide.',
      vilkar_oppfylt: false,
      begrunnelse_vilkar: 'BH mener forsinkelsen kan tas igjen med parallellarbeid.',
      beregnings_resultat: 'avslatt_ingen_hindring',
      godkjent_dager: 0,
      begrunnelse_beregning: 'Fristforlengelse avslås. Forsinkelsen kan hentes inn uten fristforlengelse.',
    },
  },
  {
    event_id: 'evt-603',
    tidsstempel: '2025-01-28T10:00:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 850.000 NOK for stillstand og omorganisering',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Stillstand og omorganisering av mannskap.',
      kostnads_overslag: 850000,
      saerskilt_krav: {
        produktivitet: true,
      },
      produktivitetstap_varsel: { dato_sendt: '2025-01-20', metode: ['epost'] },
      regningsarbeid_varsel: { dato_sendt: '2025-01-20', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-604',
    tidsstempel: '2025-01-28T09:30:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 21 dager fristforlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      noytralt_varsel: { dato_sendt: '2025-01-20', metode: ['epost', 'byggemote'] },
      spesifisert_varsel: { dato_sendt: '2025-01-28', metode: ['epost'] },
      antall_dager: 21,
      begrunnelse: 'Stopp i elektroarbeid i 3 uker.',
    },
  },
  {
    event_id: 'evt-605',
    tidsstempel: '2025-01-25T14:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - forsinkelse erkjent',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Forsinkelsen erkjennes.',
    },
  },
  {
    event_id: 'evt-606',
    tidsstempel: '2025-01-20T08:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om prosjekteringsforsinkelse',
    event_data: {
      hovedkategori: 'SVIKT',
      underkategori: ['MEDVIRK'],
      beskrivelse: 'Forsinket leveranse av tegninger for elektroinstallasjon medførte stopp i arbeidet.',
      dato_oppdaget: '2025-01-20',
      grunnlag_varsel: { dato_sendt: '2025-01-20', metode: ['epost', 'byggemote'] },
      kontraktsreferanser: ['§22.3'],
    },
  },
];

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
      beregnings_resultat: 'godkjent_fullt',
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

/**
 * Example case 8: Force Majeure (§33.3)
 * Only time extension, no compensation - demonstrates FM handling
 */
export const mockSakState8: SakState = {
  sak_id: 'SAK-2025-008',
  sakstittel: 'Force Majeure - Storflom Drammenselva',

  grunnlag: {
    status: 'godkjent',
    hovedkategori: 'FORCE_MAJEURE',
    underkategori: ['FM_EGEN'],
    beskrivelse:
      'Ekstrem flom i Drammenselva 15.-22. mars 2025 medførte full stopp i arbeidet. Byggeplassen var oversvømt og utilgjengelig. Dokumentert med bilder, værdata fra MET og presseoppslag.',
    dato_oppdaget: '2025-03-15',
    grunnlag_varsel: {
      dato_sendt: '2025-03-15',
      metode: ['epost', 'telefon', 'byggemote'],
    },
    kontraktsreferanser: ['§33.3'],
    bh_resultat: 'godkjent',
    bh_begrunnelse:
      'Force majeure-situasjon bekreftes. Flommen var ekstraordinær og utenfor partenes kontroll.',
    laast: true,
    siste_oppdatert: '2025-03-25',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'ikke_relevant',
    begrunnelse: 'Force majeure gir ikke rett til vederlagsjustering, kun fristforlengelse.',
    antall_versjoner: 0,
  },

  frist: {
    status: 'godkjent',
    varsel_type: 'force_majeure',
    noytralt_varsel: {
      dato_sendt: '2025-03-15',
      metode: ['epost', 'telefon'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-03-23',
      metode: ['epost'],
    },
    krevd_dager: 8,
    begrunnelse:
      'Byggeplass utilgjengelig i 8 kalenderdager. Kunne ikke utføre noe arbeid. Dokumentert med daglige rapporter.',
    pavirker_kritisk_linje: true,
    bh_resultat: 'godkjent_fullt',
    bh_begrunnelse: 'Fristforlengelse godkjent i henhold til §33.3.',
    godkjent_dager: 8,
    differanse_dager: 0,
    siste_oppdatert: '2025-03-25',
    antall_versjoner: 1,
  },

  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Ikke relevant (Force Majeure)',
  visningsstatus_frist: 'Godkjent (8 dager)',

  overordnet_status: 'OMFORENT',
  kan_utstede_eo: false,  // FM gir ikke EO, kun fristforlengelse
  neste_handling: {
    rolle: null,
    handling: 'Saken er avsluttet - fristforlengelse innvilget',
    spor: null,
  },

  sum_krevd: 0,
  sum_godkjent: 0,

  opprettet: '2025-03-15',
  siste_aktivitet: '2025-03-25',
  antall_events: 4,
};

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
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      vilkar_oppfylt: true,
      begrunnelse_vilkar: 'Ekstraordinær flom bekreftet. Utenfor partenes kontroll.',
      beregnings_resultat: 'godkjent_fullt',
      godkjent_dager: 8,
      begrunnelse_beregning: 'Alle 8 dager godkjennes.',
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
      noytralt_varsel: { dato_sendt: '2025-03-15', metode: ['epost', 'telefon'] },
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
      hovedkategori: 'FORCE_MAJEURE',
      underkategori: ['FM_EGEN'],
      beskrivelse: 'Ekstrem flom i Drammenselva. Byggeplass oversvømt.',
      dato_oppdaget: '2025-03-15',
      grunnlag_varsel: { dato_sendt: '2025-03-15', metode: ['epost', 'telefon', 'byggemote'] },
      kontraktsreferanser: ['§33.3'],
    },
  },
];

/**
 * Example case 9: BH Passivity on Irregular Change (§32.3)
 * BH did not respond in time - passive acceptance
 */
export const mockSakState9: SakState = {
  sak_id: 'SAK-2025-009',
  sakstittel: 'Passivitet - Irregulær endring ventilasjon',

  grunnlag: {
    status: 'godkjent',  // Godkjent via passivitet!
    hovedkategori: 'ENDRING',
    underkategori: ['IRREG'],
    beskrivelse:
      'I byggemøte 5. februar ga BHs representant muntlig instruks om å endre ventilasjonsanlegget fra balansert til hybrid løsning. TE varslet umiddelbart om at dette utgjør en endring.',
    dato_oppdaget: '2025-02-05',
    grunnlag_varsel: {
      dato_sendt: '2025-02-05',
      metode: ['epost', 'byggemote'],
    },
    kontraktsreferanser: ['§32.1', '§32.2'],
    // BH svarte ikke - passiv aksept!
    bh_resultat: 'godkjent',
    bh_begrunnelse:
      'PASSIV AKSEPT (§32.3): BH svarte ikke på varsel om irregulær endring innen rimelig tid. Endringen anses derfor som godkjent.',
    laast: true,
    siste_oppdatert: '2025-02-20',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 320000,
    begrunnelse:
      'Merarbeid for omlegging av ventilasjonsanlegg. Inkluderer: Demontering av eksisterende (40.000), nytt hybridanlegg (220.000), tilpasninger (60.000).',
    regningsarbeid_varsel: {
      dato_sendt: '2025-02-06',
      metode: ['epost'],
    },
    siste_oppdatert: '2025-02-22',
    antall_versjoner: 1,
  },

  frist: {
    status: 'under_behandling',
    varsel_type: 'spesifisert',
    noytralt_varsel: {
      dato_sendt: '2025-02-05',
      metode: ['epost'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-02-10',
      metode: ['epost'],
    },
    krevd_dager: 10,
    begrunnelse: 'Omlegging av ventilasjonsanlegg krever 10 arbeidsdager.',
    pavirker_kritisk_linje: false,
    siste_oppdatert: '2025-02-22',
    antall_versjoner: 1,
  },

  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Under behandling',
  visningsstatus_frist: 'Under behandling',

  overordnet_status: 'UNDER_BEHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'BH',
    handling: 'Svar på vederlag- og fristkrav (grunnlag godkjent via passivitet)',
    spor: 'vederlag',
  },

  sum_krevd: 320000,
  sum_godkjent: 0,

  opprettet: '2025-02-05',
  siste_aktivitet: '2025-02-22',
  antall_events: 6,
};

export const mockTimelineEvents9: TimelineEntry[] = [
  {
    event_id: 'evt-901',
    tidsstempel: '2025-02-22T10:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 10 dager fristforlengelse for ventilasjonsendring',
    event_data: {
      varsel_type: 'spesifisert',
      noytralt_varsel: { dato_sendt: '2025-02-05', metode: ['epost'] },
      spesifisert_varsel: { dato_sendt: '2025-02-10', metode: ['epost'] },
      antall_dager: 10,
      begrunnelse: 'Omlegging av ventilasjonsanlegg krever 10 arbeidsdager.',
    },
  },
  {
    event_id: 'evt-902',
    tidsstempel: '2025-02-22T09:30:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 320.000 NOK for ventilasjonsendring',
    event_data: {
      krav_belop: 320000,
      metode: 'regning',
      begrunnelse: 'Merarbeid for omlegging av ventilasjonsanlegg.',
      krever_regningsarbeid: true,
      regningsarbeid_varsel: { dato_sendt: '2025-02-06', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-903',
    tidsstempel: '2025-02-20T08:00:00Z',
    type: 'Passiv aksept registrert',
    event_type: 'respons_grunnlag',
    aktor: 'System',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: '§32.3: BH svarte ikke i tide - endring anses godkjent',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'PASSIV AKSEPT: BH svarte ikke på varsel innen rimelig tid (15 dager). Jf. §32.3 anses varselet som godtatt.',
    },
  },
  {
    event_id: 'evt-904',
    tidsstempel: '2025-02-05T14:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om irregulær endring - ventilasjon',
    event_data: {
      hovedkategori: 'ENDRING',
      underkategori: ['IRREG'],
      beskrivelse: 'Muntlig instruks om endret ventilasjonsløsning i byggemøte.',
      dato_oppdaget: '2025-02-05',
      grunnlag_varsel: { dato_sendt: '2025-02-05', metode: ['epost', 'byggemote'] },
      kontraktsreferanser: ['§32.1', '§32.2'],
    },
  },
];

/**
 * Example case 10: Multiple revisions - complete TE→BH→TE→BH cycle
 * This case demonstrates:
 * - TE sends initial vederlag claim
 * - BH partially approves
 * - TE revises claim
 * - BH updates response to full approval
 */
export const mockSakState10: SakState = {
  sak_id: 'SAK-2025-010',
  sakstittel: 'Revisjonssyklus - Ekstra sprinkleranlegg',

  // Grunnlag - godkjent
  grunnlag: {
    status: 'godkjent',
    hovedkategori: 'ENDRING',
    underkategori: 'REG',
    beskrivelse:
      'Pålagt utvidelse av sprinkleranlegg til teknisk rom etter krav fra brannvesenet. Ikke del av opprinnelig kontrakt.',
    dato_oppdaget: '2025-02-01',
    dato_varsel_sendt: '2025-02-01',
    varsel_metode: ['epost'],
    kontraktsreferanser: ['§32.1'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Godkjent som endring. Kravet fra brannvesenet dokumentert.',
    laast: true,
    siste_oppdatert: '2025-02-05',
    antall_versjoner: 1,
  },

  // Vederlag - har gjennomgått revisjon
  vederlag: {
    status: 'godkjent',
    metode: 'ENHETSPRISER',
    belop_direkte: 185000, // Revidert beløp (ned fra 220000)
    begrunnelse:
      'Revidert krav etter gjennomgang med BH. Fjernet post for prosjektering da dette inngår i enhetsprisene.',
    bh_resultat: 'godkjent_fullt',
    bh_begrunnelse: 'Revidert krav godkjent i sin helhet.',
    godkjent_belop: 185000,
    siste_oppdatert: '2025-02-15',
    antall_versjoner: 2, // Har blitt revidert
  },

  // Frist - godkjent
  frist: {
    status: 'godkjent',
    krevd_dager: 5,
    frist_type: 'spesifisert_krav',
    begrunnelse: '5 dager for installasjon av sprinkleranlegg.',
    pavirker_kritisk_linje: false,
    bh_resultat: 'godkjent_fullt',
    bh_begrunnelse: '5 dager godkjent.',
    godkjent_dager: 5,
    siste_oppdatert: '2025-02-10',
    antall_versjoner: 1,
  },

  // Status
  overordnet_status: 'KLAR_FOR_EO',
  kan_utstede_eo: true,
  neste_handling: {
    rolle: 'BH',
    handling: 'Utsted endringsordre',
    spor: null,
  },

  // Aggregates
  sum_krevd: 185000,
  sum_godkjent: 185000,
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Godkjent: 185.000 NOK',
  visningsstatus_frist: 'Godkjent: 5 dager',

  // Metadata
  opprettet: '2025-02-01',
  siste_aktivitet: '2025-02-15',
  antall_events: 8,
};

/**
 * Timeline for case 10 - showing complete TE→BH→TE→BH revision cycle for vederlag
 */
export const mockTimelineEvents10: TimelineEntry[] = [
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
      nytt_resultat: 'godkjent_fullt',
      godkjent_belop: 185000,
      kommentar:
        'Etter revisjon av kravet godkjennes hele beløpet. Prosjekteringskostnader korrekt fjernet.',
      dato_endret: '2025-02-15',
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
      beregnings_resultat: 'godkjent_fullt',
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
      hovedkategori: 'ENDRING',
      underkategori: 'REG',
      beskrivelse:
        'Pålagt utvidelse av sprinkleranlegg til teknisk rom etter krav fra brannvesenet. Ikke del av opprinnelig kontrakt.',
      dato_oppdaget: '2025-02-01',
      grunnlag_varsel: { dato_sendt: '2025-02-01', metode: ['epost'] },
      kontraktsreferanser: ['§32.1'],
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
    case 'SAK-2025-008':
      return mockSakState8;
    case 'SAK-2025-009':
      return mockSakState9;
    case 'SAK-2025-010':
      return mockSakState10;
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
    case 'SAK-2025-008':
      return mockTimelineEvents8;
    case 'SAK-2025-009':
      return mockTimelineEvents9;
    case 'SAK-2025-010':
      return mockTimelineEvents10;
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
  {
    id: 'SAK-2025-008',
    title: 'Force Majeure - Storflom Drammenselva',
    status: 'Force Majeure (§33.3)',
  },
  {
    id: 'SAK-2025-009',
    title: 'Passivitet - Irregulær endring ventilasjon',
    status: 'Passiv aksept (§32.3)',
  },
  {
    id: 'SAK-2025-010',
    title: 'Revisjonssyklus - Ekstra sprinkleranlegg',
    status: 'Klar for EO (TE→BH→TE→BH)',
  },
];
