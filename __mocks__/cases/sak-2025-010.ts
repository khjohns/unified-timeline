import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-010: Revisjonssyklus - Ekstra sprinkleranlegg
 *
 * Scenario: Fullstendig revisjonssyklus TE→BH→TE→BH
 * - Grunnlag: Godkjent
 * - Vederlag: Revidert 2 ganger (godkjent etter revisjon)
 * - Frist: Godkjent
 *
 * Demonstrerer: Komplett revisjonssyklus der TE reviderer krav og BH oppdaterer respons
 */
export const mockSakState10: SakState = {
  sak_id: 'SAK-2025-010',
  sakstittel: 'Revisjonssyklus - Ekstra sprinkleranlegg',

  // Grunnlag - godkjent
  grunnlag: {
    status: 'godkjent',
    tittel: 'Pålagt sprinklerutvidelse - brannkrav',
    hovedkategori: 'ENDRING',
    underkategori: 'IRREG',
    beskrivelse:
      'Pålagt utvidelse av sprinkleranlegg til teknisk rom etter krav fra brannvesenet. Ikke del av opprinnelig kontrakt.',
    dato_oppdaget: '2025-02-01',
    grunnlag_varsel: {
      dato_sendt: '2025-02-01',
      metode: ['epost'],
    },
    kontraktsreferanser: ['§32.1', '§32.2'],
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
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Revidert krav godkjent i sin helhet.',
    godkjent_belop: 185000,
    differanse: 0,
    godkjenningsgrad_prosent: 100,
    siste_oppdatert: '2025-02-15',
    antall_versjoner: 2, // Har blitt revidert
  },

  // Frist - godkjent (spesifisert direkte, uten nøytralt først)
  frist: {
    status: 'godkjent',
    varsel_type: 'spesifisert',
    spesifisert_varsel: {
      dato_sendt: '2025-02-02',
      metode: ['epost'],
    },
    krevd_dager: 5,
    begrunnelse: '5 dager for installasjon av sprinkleranlegg.',
    spesifisert_krav_ok: true,
    vilkar_oppfylt: true,
    bh_resultat: 'godkjent',
    bh_begrunnelse: `Varslingskravene i §33.6 anses oppfylt.

Det erkjennes at det påberopte forholdet har forårsaket faktisk hindring av fremdriften, og at det foreligger årsakssammenheng mellom forholdet og forsinkelsen.

Hva gjelder antall dager: Kravet om 5 dagers fristforlengelse godkjennes i sin helhet.

Samlet godkjennes 5 dagers fristforlengelse.`,
    godkjent_dager: 5,
    differanse_dager: 0,
    siste_oppdatert: '2025-02-10',
    antall_versjoner: 1,
  },

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Godkjent: 185.000 NOK',
  visningsstatus_frist: 'Godkjent: 5 dager',

  // Status
  overordnet_status: 'OMFORENT',
  kan_utstede_eo: true,
  neste_handling: {
    rolle: 'BH',
    handling: 'Utsted endringsordre',
    spor: null,
  },

  // Aggregates
  sum_krevd: 185000,
  sum_godkjent: 185000,

  // Metadata
  opprettet: '2025-02-01',
  siste_aktivitet: '2025-02-16',
  antall_events: 10,
};
