import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-001: Endring av grunnforhold - Bjørvika
 *
 * Scenario: Aktiv sak under behandling med blandet status
 * - Grunnlag: Godkjent
 * - Vederlag: Under behandling (REGNINGSARBEID)
 * - Frist: Delvis godkjent (30 av 45 dager)
 *
 * Demonstrerer: Standard saksbehandlingsflyt med flere spor
 */
export const mockSakState1: SakState = {
  sak_id: 'SAK-2025-001',
  sakstittel: 'Endring av grunnforhold - Bjørvika Utbyggingsprosjekt',

  // Grunnlag track
  grunnlag: {
    status: 'godkjent',
    tittel: 'Uventet fjell ved fundament B3',
    hovedkategori: 'SVIKT',
    underkategori: 'GRUNN',
    beskrivelse:
      'Ved peling av fundament B3 ble det påtruffet uventet fjell 2,5 meter høyere enn antatt i prosjekteringsgrunnlaget. Dette krever omprosjektering og endrede løsninger for fundamentering.',
    dato_oppdaget: '2025-01-15',
    grunnlag_varsel: {
      dato_sendt: '2025-01-15',
      metode: ['epost', 'byggemote'],
    },
    kontraktsreferanser: ['§23.1', 'Vedlegg A - Geoteknisk rapport'],
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
      rigg_drift: {
        belop: 200000,
        dato_klar_over: '2025-01-15',
      },
    },
    rigg_drift_varsel: {
      dato_sendt: '2025-01-15',
      metode: ['epost'],
    },
    regningsarbeid_varsel: {
      dato_sendt: '2025-01-15',
      metode: ['epost'],
    },
    siste_oppdatert: '2025-01-18',
    antall_versjoner: 1,
  },

  // Frist track
  frist: {
    status: 'delvis_godkjent',
    varsel_type: 'spesifisert',
    noytralt_varsel: {
      dato_sendt: '2025-01-15',
      metode: ['epost', 'byggemote'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-01-18',
      metode: ['epost'],
    },
    krevd_dager: 45,
    begrunnelse:
      'Fristforlengelse nødvendig pga. omprosjektering av fundament (20 dager) og ekstra boring/sprengning (25 dager). Påvirker kritisk linje.',
    noytralt_varsel_ok: true,
    vilkar_oppfylt: true,
    bh_resultat: 'delvis_godkjent',
    bh_begrunnelse:
      '30 dager godkjent. Omprosjektering kan gjøres parallelt med andre arbeider. Sprengningsarbeider påvirker kritisk linje.',
    godkjent_dager: 30,
    differanse_dager: -15,
    siste_oppdatert: '2025-01-22',
    antall_versjoner: 2,
  },

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Under behandling',
  visningsstatus_frist: 'Delvis godkjent (30 av 45 dager)',

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
