import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-008: Force Majeure - Storflom Drammenselva
 *
 * Scenario: Force Majeure-situasjon (§33.3)
 * - Grunnlag: Godkjent (Force Majeure)
 * - Vederlag: Ikke relevant (FM gir ikke vederlagsrett)
 * - Frist: Godkjent
 *
 * Demonstrerer: Force majeure gir kun fristforlengelse, ikke økonomisk kompensasjon
 */
export const mockSakState8: SakState = {
  sak_id: 'SAK-2025-008',
  sakstittel: 'Force Majeure - Storflom Drammenselva',

  grunnlag: {
    status: 'godkjent',
    tittel: 'Force Majeure - Ekstrem flom',
    hovedkategori: 'FORCE_MAJEURE',
    underkategori: 'FM_EGEN',
    beskrivelse:
      'Ekstrem flom i Drammenselva 15.-22. mars 2025 medførte full stopp i arbeidet. Byggeplassen var oversvømt og utilgjengelig. Dokumentert med bilder, værdata fra MET og presseoppslag.',
    dato_oppdaget: '2025-03-15',
    grunnlag_varsel: {
      dato_sendt: '2025-03-15',
      metode: ['epost', 'telefon', 'byggemote'],
    },
    kontraktsreferanser: ['§33.3'],
    bh_resultat: 'godkjent',
    bh_begrunnelse:
      'Force majeure-situasjon bekreftes. Flommen var ekstraordinær og utenfor partenes kontroll.',
    laast: true,
    siste_oppdatert: '2025-03-25',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'ikke_relevant',
    begrunnelse: 'Force majeure gir ikke rett til vederlagsjustering, kun fristforlengelse.',
    antall_versjoner: 0,
  },

  frist: {
    status: 'godkjent',
    varsel_type: 'force_majeure',
    noytralt_varsel: {
      dato_sendt: '2025-03-15',
      metode: ['epost', 'telefon'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-03-23',
      metode: ['epost'],
    },
    krevd_dager: 8,
    begrunnelse:
      'Byggeplass utilgjengelig i 8 kalenderdager. Kunne ikke utføre noe arbeid. Dokumentert med daglige rapporter.',
    noytralt_varsel_ok: true,
    spesifisert_krav_ok: true,
    vilkar_oppfylt: true,
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Fristforlengelse godkjent i henhold til §33.3.',
    godkjent_dager: 8,
    differanse_dager: 0,
    siste_oppdatert: '2025-03-25',
    antall_versjoner: 1,
  },

  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Ikke relevant (Force Majeure)',
  visningsstatus_frist: 'Godkjent (8 dager)',

  overordnet_status: 'OMFORENT',
  kan_utstede_eo: false,  // FM gir ikke EO, kun fristforlengelse
  neste_handling: {
    rolle: null,
    handling: 'Saken er avsluttet - fristforlengelse innvilget',
    spor: null,
  },

  sum_krevd: 0,
  sum_godkjent: 0,

  opprettet: '2025-03-15',
  siste_aktivitet: '2025-03-25',
  antall_events: 4,
};
