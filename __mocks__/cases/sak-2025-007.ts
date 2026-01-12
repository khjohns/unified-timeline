import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-007: Tilbakeholdelse - Mangler overslag
 *
 * Scenario: Vederlag holdt tilbake (§30.2)
 * - Grunnlag: Godkjent
 * - Vederlag: Hold tilbake (avventer overslag)
 * - Frist: Godkjent
 *
 * Demonstrerer: BH holder tilbake betaling til TE leverer bindende prisoverslag
 */
export const mockSakState7: SakState = {
  sak_id: 'SAK-2025-007',
  sakstittel: 'Tilbakeholdelse - Mangler overslag',

  grunnlag: {
    status: 'godkjent',
    tittel: 'Irregulær endring - resepsjonsutforming',
    hovedkategori: 'ENDRING',
    underkategori: 'IRREG',
    beskrivelse: 'Endret utforming av resepsjon etter muntlig instruks.',
    dato_oppdaget: '2025-02-10',
    grunnlag_varsel: {
      dato_sendt: '2025-02-10',
      metode: ['system'],
    },
    kontraktsreferanser: ['§32.1', '§32.2'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Endringen aksepteres.',
    laast: true,
    siste_oppdatert: '2025-02-12',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    metode: 'REGNINGSARBEID',
    begrunnelse: 'Snekkerarbeid og ny innredning. Overslag ettersendes.',
    regningsarbeid_varsel: {
      dato_sendt: '2025-02-10',
      metode: ['system'],
    },
    // BH is holding back until TE provides kostnads_overslag
    bh_resultat: 'hold_tilbake',
    bh_begrunnelse:
      'Jf. §30.2: Betaling holdes tilbake inntil TE leverer bindende prisoverslag.',
    siste_oppdatert: '2025-02-15',
    antall_versjoner: 1,
  },

  frist: {
    status: 'godkjent',
    varsel_type: 'spesifisert',
    noytralt_varsel: {
      dato_sendt: '2025-02-10',
      metode: ['system'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-02-11',
      metode: ['epost'],
    },
    krevd_dager: 7,
    begrunnelse: 'Enkelt snekkerarbeid.',
    noytralt_varsel_ok: true,
    spesifisert_krav_ok: true,
    vilkar_oppfylt: true,
    bh_resultat: 'godkjent',
    bh_begrunnelse: `Varslingskravene i §33.6 anses oppfylt.

Det erkjennes at det påberopte forholdet har forårsaket faktisk hindring av fremdriften, og at det foreligger årsakssammenheng mellom forholdet og forsinkelsen.

Hva gjelder antall dager: Kravet om 7 dagers fristforlengelse godkjennes i sin helhet.

Samlet godkjennes 7 dagers fristforlengelse.`,
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

  sum_krevd: 0,  // Overslag ikke levert ennå
  sum_godkjent: 0,

  opprettet: '2025-02-10',
  siste_aktivitet: '2025-02-15',
  antall_events: 5,
};
