import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-012: Forseringssak - Samlet forsering for avslåtte fristforlengelser
 *
 * Scenario: Forseringssak opprettet etter at BH avslo flere fristforlengelser
 * - sakstype: 'forsering'
 * - Relatert til SAK-2025-003, SAK-2025-006, og SAK-2025-013
 *
 * Demonstrerer: Den nye modellen der forsering er en egen sak med relasjoner
 * til grunnlagssakene (avslåtte fristforlengelser).
 */
export const mockSakState12: SakState = {
  sak_id: 'SAK-2025-012',
  sakstittel: 'Forsering - Samlekrav etter avslåtte fristforlengelser',
  sakstype: 'forsering',

  // Relasjoner til grunnlagssakene
  relaterte_saker: [
    {
      relatert_sak_id: 'SAK-2025-003',
      relatert_sak_tittel: 'Tilleggsarbeid - Rørføring omlegging',
      bimsync_issue_number: 45,
    },
    {
      relatert_sak_id: 'SAK-2025-006',
      relatert_sak_tittel: 'Forsering - Prosjekteringsforsinkelse',
      bimsync_issue_number: 52,
    },
    {
      relatert_sak_id: 'SAK-2025-013',
      relatert_sak_tittel: 'Forsinkelse - Ventilasjonsmontasje',
      bimsync_issue_number: 58,
    },
  ],

  // Forsering-spesifikke data
  forsering_data: {
    avslatte_fristkrav: ['SAK-2025-003', 'SAK-2025-006', 'SAK-2025-013'],
    dato_varslet: '2025-02-10',
    estimert_kostnad: 1250000,
    bekreft_30_prosent_regel: true,
    avslatte_dager: 45, // Samlet fra alle tre saker
    dagmulktsats: 75000,
    maks_forseringskostnad: 4387500, // 45 * 75000 * 1.3
    er_iverksatt: true,
    dato_iverksatt: '2025-02-12',
    er_stoppet: false,
    kostnad_innenfor_grense: true,
    paalopte_kostnader: 520000,
    bh_aksepterer_forsering: undefined, // Venter på BH svar
  },

  // Grunnlag er ikke relevant for forseringssaker (arves fra relaterte saker)
  grunnlag: {
    status: 'ikke_relevant',
    siste_oppdatert: '2025-02-10',
    antall_versjoner: 0,
  },

  // Vederlag for forseringskostnadene
  vederlag: {
    status: 'under_behandling',
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 1250000,
    begrunnelse:
      'Forseringskostnader for å hente inn forsinkelse fra avslåtte fristforlengelser. Omfatter overtid, ekstra skift og leie av ekstra mannskap.',
    saerskilt_krav: {
      produktivitet: {
        belop: 200000,
        dato_klar_over: '2025-02-10',
      },
    },
    regningsarbeid_varsel: {
      dato_sendt: '2025-02-10',
      metode: ['epost'],
    },
    produktivitetstap_varsel: {
      dato_sendt: '2025-02-10',
      metode: ['epost'],
    },
    siste_oppdatert: '2025-02-15',
    antall_versjoner: 1,
  },

  // Frist er ikke relevant for forseringssaker
  frist: {
    status: 'ikke_relevant',
    siste_oppdatert: '2025-02-10',
    antall_versjoner: 0,
  },

  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Under behandling - Forsering',
  visningsstatus_frist: 'Ikke relevant',

  overordnet_status: 'UNDER_FORHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'BH',
    handling: 'Ta stilling til forseringskrav',
    spor: 'vederlag',
  },

  sum_krevd: 1250000,
  sum_godkjent: 0,

  opprettet: '2025-02-10',
  siste_aktivitet: '2025-02-15',
  antall_events: 4,
};
