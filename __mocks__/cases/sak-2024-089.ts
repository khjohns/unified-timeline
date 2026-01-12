import type { SakState } from '@/types/timeline';

/**
 * SAK-2024-089: Ekstraarbeid - Fasadeendringer
 *
 * Scenario: Fullstendig godkjent sak klar for EO
 * - Grunnlag: Godkjent
 * - Vederlag: Godkjent (FASTPRIS_TILBUD)
 * - Frist: Godkjent
 *
 * Demonstrerer: Standard saksbehandlingsflyt der alle spor er godkjent og EO kan utstedes
 */
export const mockSakState3: SakState = {
  sak_id: 'SAK-2024-089',
  sakstittel: 'Ekstraarbeid - Fasadeendringer',

  grunnlag: {
    status: 'laast',
    tittel: 'Fasadeendring fra betong til glass',
    hovedkategori: 'ENDRING',
    underkategori: 'EO',
    beskrivelse: 'Byggherre ønsker endring av fasademateriale fra betong til glass.',
    dato_oppdaget: '2024-11-10',
    grunnlag_varsel: {
      dato_sendt: '2024-11-10',
      metode: ['epost'],
    },
    kontraktsreferanser: ['§31.1'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Designendring godkjent av arkitekt og byggherre.',
    laast: true,
    siste_oppdatert: '2024-11-15',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'godkjent',
    metode: 'FASTPRIS_TILBUD',
    belop_direkte: 850000,
    begrunnelse: 'Basert på fastpris tilbud for glassarbeider.',
    bh_resultat: 'godkjent',
    bh_begrunnelse: `Byggherren godtar den foreslåtte oppgjørsformen fastpris/tilbud (§34.2.1).

Hva gjelder beløpet:

Hovedkravet på kr 850 000,- godkjennes.

Samlet godkjent beløp utgjør etter dette kr 850 000,- av totalt krevde kr 850 000,-.`,
    godkjent_belop: 850000,
    differanse: 0,
    godkjenningsgrad_prosent: 100,
    siste_oppdatert: '2024-11-18',
    antall_versjoner: 1,
  },

  frist: {
    status: 'godkjent',
    varsel_type: 'spesifisert',
    noytralt_varsel: {
      dato_sendt: '2024-11-10',
      metode: ['epost'],
    },
    spesifisert_varsel: {
      dato_sendt: '2024-11-12',
      metode: ['epost'],
    },
    krevd_dager: 14,
    begrunnelse: 'Tid for levering og montering av glassfasade.',
    noytralt_varsel_ok: true,
    spesifisert_krav_ok: true,
    vilkar_oppfylt: true,
    bh_resultat: 'godkjent',
    bh_begrunnelse: `Varslingskravene i §33.6 anses oppfylt.

Det erkjennes at det påberopte forholdet har forårsaket faktisk hindring av fremdriften, og at det foreligger årsakssammenheng mellom forholdet og forsinkelsen.

Hva gjelder antall dager: Kravet om 14 dagers fristforlengelse godkjennes i sin helhet.

Samlet godkjennes 14 dagers fristforlengelse.`,
    godkjent_dager: 14,
    differanse_dager: 0,
    siste_oppdatert: '2024-11-20',
    antall_versjoner: 1,
  },

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Godkjent: 850.000 NOK',
  visningsstatus_frist: 'Godkjent (14 dager)',

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
