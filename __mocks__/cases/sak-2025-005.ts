import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-005: Omtvistet endring - Teknisk rom
 *
 * Scenario: Subsidiær respons på omtvistet sak
 * - Grunnlag: Avslått
 * - Vederlag: Subsidiært delvis godkjent
 * - Frist: Subsidiært godkjent
 *
 * Demonstrerer: BH bestrider grunnlaget men gir subsidiær godkjenning av vederlag og frist
 */
export const mockSakState5: SakState = {
  sak_id: 'SAK-2025-005',
  sakstittel: 'Omtvistet endring - Teknisk rom',

  grunnlag: {
    status: 'avslatt',
    tittel: 'Irregulær endring - plassering av teknisk rom',
    hovedkategori: 'ENDRING',
    underkategori: 'IRREG',
    beskrivelse:
      'Entreprenøren hevder at muntlig beskjed om endret plassering av teknisk rom utgjør en irregulær endring.',
    dato_oppdaget: '2025-02-01',
    grunnlag_varsel: {
      dato_sendt: '2025-02-02',
      metode: ['epost'],
    },
    kontraktsreferanser: ['§32.1', '§32.2'],
    bh_resultat: 'avslatt',
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
      rigg_drift: {
        belop: 50000,
        dato_klar_over: '2025-02-01',
      },
    },
    rigg_drift_varsel: {
      dato_sendt: '2025-02-02',
      metode: ['epost'],
    },
    regningsarbeid_varsel: {
      dato_sendt: '2025-02-02',
      metode: ['epost'],
    },
    saerskilt_varsel_rigg_drift_ok: true,
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
    noytralt_varsel: {
      dato_sendt: '2025-02-02',
      metode: ['epost'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-02-03',
      metode: ['epost'],
    },
    krevd_dager: 14,
    begrunnelse: 'Omlegging av rør krever 14 ekstra dager.',
    noytralt_varsel_ok: true,
    spesifisert_krav_ok: true,
    vilkar_oppfylt: false,
    begrunnelse_vilkar: 'Subsidiært: Grunnlaget bestrides, men dersom ansvar avklares godkjennes dagene.',
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Subsidiært: Dagene godkjennes dersom ansvar avklares.',
    godkjent_dager: 14,
    differanse_dager: 0,
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
  siste_aktivitet: '2025-02-07',
  antall_events: 7,
};
