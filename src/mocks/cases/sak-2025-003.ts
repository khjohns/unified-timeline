import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-003: Tilleggsarbeid - Rørføring omlegging
 *
 * Scenario: Sak med avventer spesifikasjon
 * - Grunnlag: Godkjent
 * - Vederlag: Avventer spesifikasjon
 * - Frist: Avventer spesifikasjon
 *
 * Demonstrerer: BH har gitt frist for ytterligere spesifisering av krav
 */
export const mockSakState4: SakState = {
  sak_id: 'SAK-2025-003',
  sakstittel: 'Tilleggsarbeid - Rørføring omlegging',

  grunnlag: {
    status: 'godkjent',
    tittel: 'Avvik i eksisterende rørføring',
    hovedkategori: 'SVIKT',
    underkategori: 'PROSJ_RISIKO',
    beskrivelse:
      'Eksisterende rørføring for vann og avløp avviker fra tegninger. Må legges om for å unngå kollisjon med nye konstruksjoner.',
    dato_oppdaget: '2025-01-28',
    grunnlag_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost', 'telefon'],
    },
    kontraktsreferanser: ['§24.1', '§25.2'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Grunnlag godkjent. Dokumentert med foto og nye målinger.',
    laast: true,
    siste_oppdatert: '2025-01-30',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    metode: 'ENHETSPRISER',
    belop_direkte: 450000,
    begrunnelse:
      'Krav basert på kontraktens enhetspriser for rørlegging. Endelig spesifikasjon med detaljert mengdeoversikt følger innen fastsatt frist.',
    saerskilt_krav: {
      produktivitet: {
        belop: 50000,
        dato_klar_over: '2025-01-28',
      },
      rigg_drift: {
        belop: 30000,
        dato_klar_over: '2025-01-28',
      },
    },
    rigg_drift_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost'],
    },
    produktivitetstap_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost'],
    },
    bh_resultat: 'avventer',
    bh_begrunnelse:
      'Grunnlaget er akseptert, men kravet mangler tilstrekkelig spesifikasjon. TE må levere detaljert kostnadskalkyle og dokumentasjon innen 2025-02-15.',
    siste_oppdatert: '2025-02-01',
    antall_versjoner: 1,
  },

  frist: {
    status: 'under_behandling',
    varsel_type: 'noytralt',
    noytralt_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost', 'telefon'],
    },
    krevd_dager: 21,
    begrunnelse:
      'Foreløpig krav. Detaljert framdriftsplan med arbeidsoperasjoner følger i endelig spesifikasjon.',
    pavirker_kritisk_linje: true,
    noytralt_varsel_ok: true,
    vilkar_oppfylt: true,
    bh_resultat: 'avventer',
    bh_begrunnelse:
      'Fristkravet mangler dokumentasjon av arbeidsoperasjoner og påvirkning på framdrift. TE må levere detaljert framdriftsplan innen 2025-02-15.',
    frist_for_spesifisering: '2025-02-15',
    siste_oppdatert: '2025-02-01',
    antall_versjoner: 1,
  },

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Avventer spesifikasjon (frist: 2025-02-15)',
  visningsstatus_frist: 'Avventer spesifikasjon (frist: 2025-02-15)',

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
