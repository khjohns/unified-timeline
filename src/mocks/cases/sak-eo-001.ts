import type { SakState } from '@/types/timeline';

/**
 * SAK-EO-001: Endringsordre - Sprinkler og fasadeendringer
 *
 * Scenario: Endringsordre i utkast som samler to KOE-saker
 * - sakstype: 'endringsordre'
 * - Relatert til SAK-2025-010 og SAK-2024-089
 * - Status: Utkast, BH kan redigere og legge til/fjerne KOE-saker
 *
 * Demonstrerer: Endringsordre-siden med relaterte KOE-saker og oppgjørsoversikt
 */
export const mockSakStateEO001: SakState = {
  sak_id: 'SAK-EO-001',
  sakstittel: 'Endringsordre EO-001 - Sprinkler og fasadeendringer',
  sakstype: 'endringsordre',

  // Relasjoner til KOE-sakene som inngår
  relaterte_saker: [
    {
      relatert_sak_id: 'SAK-2025-010',
      relatert_sak_tittel: 'Revisjonssyklus - Ekstra sprinkleranlegg',
      bimsync_issue_number: 61,
    },
    {
      relatert_sak_id: 'SAK-2024-089',
      relatert_sak_tittel: 'Ekstraarbeid - Fasadeendringer',
      bimsync_issue_number: 89,
    },
  ],

  // Endringsordre-spesifikke data
  endringsordre_data: {
    relaterte_koe_saker: ['SAK-2025-010', 'SAK-2024-089'],
    eo_nummer: 'EO-001',
    revisjon_nummer: 0,
    beskrivelse:
      'Endringsordre for utvidelse av sprinkleranlegg til teknisk rom (brannkrav) samt fasadeendringer iht. revidert arkitektprosjekt. Samler godkjente KOE-saker for formell avtaleinngåelse.',
    konsekvenser: {
      sha: false,
      kvalitet: false,
      fremdrift: true,
      pris: true,
      annet: false,
    },
    konsekvens_beskrivelse:
      'Arbeidene medfører fristforlengelse og økt vederlag som angitt nedenfor.',
    oppgjorsform: 'ENHETSPRISER',
    kompensasjon_belop: 1035000, // 185000 + 850000 fra KOE-sakene
    fradrag_belop: 0,
    er_estimat: false,
    frist_dager: 19, // 5 + 14 fra KOE-sakene
    ny_sluttdato: '2025-04-15',
    status: 'utkast',
    // dato_utstedt: '2025-02-20',  // Ikke utstedt ennå
    // utstedt_av: 'Kari Byggherre',
    netto_belop: 1035000,
    har_priskonsekvens: true,
    har_fristkonsekvens: true,
  },

  // Grunnlag er ikke relevant for endringsordresaker (arves fra relaterte KOE-saker)
  grunnlag: {
    status: 'ikke_relevant',
    siste_oppdatert: '2025-02-20',
    antall_versjoner: 0,
  },

  // Vederlag - oppsummert fra KOE-sakene
  vederlag: {
    status: 'under_behandling',
    metode: 'ENHETSPRISER',
    belop_direkte: 1035000,
    begrunnelse: 'Samlet vederlag fra inkluderte KOE-saker.',
    siste_oppdatert: '2025-02-20',
    antall_versjoner: 1,
  },

  // Frist - oppsummert fra KOE-sakene
  frist: {
    status: 'under_behandling',
    krevd_dager: 19,
    begrunnelse: 'Samlet fristforlengelse fra inkluderte KOE-saker.',
    siste_oppdatert: '2025-02-20',
    antall_versjoner: 1,
  },

  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'EO utkast: 1.035.000 kr',
  visningsstatus_frist: 'EO utkast: 19 dager',

  overordnet_status: 'UTKAST',
  kan_utstede_eo: true,
  neste_handling: {
    rolle: 'BH',
    handling: 'Fullfør og utstede endringsordre',
    spor: null,
  },

  sum_krevd: 1035000,
  sum_godkjent: 1035000,

  opprettet: '2025-02-20',
  siste_aktivitet: '2025-02-20',
  antall_events: 3,
};
