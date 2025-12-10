import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-009: Passivitet - Irregulær endring ventilasjon
 *
 * Scenario: Passiv aksept ved irregulær endring (§32.3)
 * - Grunnlag: Godkjent (via passiv aksept)
 * - Vederlag: Under behandling
 * - Frist: Under behandling
 *
 * Demonstrerer: BH svarte ikke i tide på varsel om irregulær endring, endringen anses godkjent
 */
export const mockSakState9: SakState = {
  sak_id: 'SAK-2025-009',
  sakstittel: 'Passivitet - Irregulær endring ventilasjon',

  grunnlag: {
    status: 'godkjent',  // Godkjent via passivitet!
    tittel: 'Irregulær endring - ventilasjonsomlegging',
    hovedkategori: 'ENDRING',
    underkategori: 'IRREG',
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
