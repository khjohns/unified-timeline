import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-006: Forsering - Prosjekteringsforsinkelse
 *
 * Scenario: Forsering iverksatt etter avslått frist
 * - Grunnlag: Godkjent
 * - Vederlag: Under behandling
 * - Frist: Avslått - forsering iverksatt (§33.8)
 *
 * Demonstrerer: TE har iverksatt forsering etter at BH avslo fristkrav
 */
export const mockSakState6: SakState = {
  sak_id: 'SAK-2025-006',
  sakstittel: 'Forsering - Prosjekteringsforsinkelse',

  grunnlag: {
    status: 'godkjent',
    tittel: 'Forsinket tegningsleveranse - elektro',
    hovedkategori: 'SVIKT',
    underkategori: 'MEDVIRK',
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
      produktivitet: {
        belop: 150000,
        dato_klar_over: '2025-01-20',
      },
    },
    produktivitetstap_varsel: {
      dato_sendt: '2025-01-20',
      metode: ['epost'],
    },
    regningsarbeid_varsel: {
      dato_sendt: '2025-01-20',
      metode: ['epost'],
    },
    siste_oppdatert: '2025-01-28',
    antall_versjoner: 1,
  },

  frist: {
    status: 'avvist',
    varsel_type: 'spesifisert',
    noytralt_varsel: {
      dato_sendt: '2025-01-20',
      metode: ['epost', 'byggemote'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost'],
    },
    krevd_dager: 21,
    begrunnelse: 'Stopp i elektroarbeid i 3 uker.',
    pavirker_kritisk_linje: true,
    noytralt_varsel_ok: true,
    spesifisert_krav_ok: true,
    vilkar_oppfylt: false,
    begrunnelse_vilkar: 'BH mener forsinkelsen kan tas igjen med parallellarbeid.',
    bh_resultat: 'avslatt',
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
