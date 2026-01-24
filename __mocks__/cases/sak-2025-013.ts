import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-013: Forsinkelse - Ventilasjonsmontasje
 *
 * Scenario: Fristforlengelse avslått - grunnlag for forsering
 * - Grunnlag: Godkjent (svikt i BHs medvirkning)
 * - Vederlag: Under behandling
 * - Frist: Avslått (BH mener forsinkelse kan hentes inn)
 *
 * Demonstrerer: Sak med avslått frist som kan inngå i en forseringssak.
 * Denne saken er relatert til SAK-2025-012 (forseringssaken).
 */
export const mockSakState13: SakState = {
  sak_id: 'SAK-2025-013',
  sakstittel: 'Forsinkelse - Ventilasjonsmontasje',

  grunnlag: {
    status: 'godkjent',
    tittel: 'Forsinket tilgang til ventilasjonssjakter',
    hovedkategori: 'SVIKT',
    underkategori: 'MEDVIRK',
    beskrivelse:
      'BH ga ikke tilgang til ventilasjonssjakter som avtalt. Arbeidet stoppet i 10 arbeidsdager.',
    dato_oppdaget: '2025-01-25',
    grunnlag_varsel: {
      dato_sendt: '2025-01-25',
      metode: ['epost', 'byggemote'],
    },
    kontraktsreferanser: ['§21.1', '§22.3'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Forsinkelsen erkjennes. Tilgang ble forsinket grunnet andre arbeider.',
    laast: true,
    siste_oppdatert: '2025-01-30',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 320000,
    begrunnelse: 'Stillstand for ventilasjonsmannskap i 10 dager, samt omorganisering.',
    saerskilt_krav: {
      produktivitet: {
        belop: 80000,
        dato_klar_over: '2025-01-25',
      },
    },
    regningsarbeid_varsel: {
      dato_sendt: '2025-01-25',
      metode: ['epost'],
    },
    produktivitetstap_varsel: {
      dato_sendt: '2025-01-25',
      metode: ['epost'],
    },
    siste_oppdatert: '2025-02-05',
    antall_versjoner: 1,
  },

  frist: {
    status: 'avslatt',
    varsel_type: 'spesifisert',
    frist_varsel: {
      dato_sendt: '2025-01-25',
      metode: ['epost', 'byggemote'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-02-01',
      metode: ['epost'],
    },
    krevd_dager: 10,
    begrunnelse: 'Stopp i ventilasjonsarbeid i 10 dager grunnet manglende tilgang.',
    frist_varsel_ok: true,
    spesifisert_krav_ok: true,
    vilkar_oppfylt: false,
    begrunnelse_vilkar: 'BH mener arbeidet kan utføres parallelt med andre aktiviteter.',
    bh_resultat: 'avslatt',
    bh_begrunnelse:
      'Fristforlengelse avslås. Ventilasjonsarbeidet kan utføres parallelt med andre pågående arbeider.',
    godkjent_dager: 0,
    differanse_dager: -10,
    siste_oppdatert: '2025-02-05',
    antall_versjoner: 1,
  },

  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Under behandling',
  visningsstatus_frist: 'Avslått',

  overordnet_status: 'UNDER_FORHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'TE',
    handling: 'Vurder forsering eller aksept',
    spor: 'frist',
  },

  sum_krevd: 320000,
  sum_godkjent: 0,

  opprettet: '2025-01-25',
  siste_aktivitet: '2025-02-05',
  antall_events: 6,
};
