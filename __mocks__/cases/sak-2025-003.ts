import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-003: Tilleggsarbeid - Rørføring omlegging
 *
 * Scenario: Sak med krav avslått pga manglende spesifikasjon
 * - Grunnlag: Godkjent
 * - Vederlag: Avslått (mangler spesifikasjon - TE kan revidere kravet)
 * - Frist: Avslått (mangler spesifikasjon - TE kan revidere kravet)
 *
 * Demonstrerer: BH avslår krav som mangler dokumentasjon, men gir TE mulighet
 * til å revidere og sende på nytt med fullstendig spesifikasjon.
 */
export const mockSakState4: SakState = {
  sak_id: 'SAK-2025-003',
  sakstittel: 'Tilleggsarbeid - Rørføring omlegging',

  grunnlag: {
    status: 'godkjent',
    tittel: 'Avvik i eksisterende rørføring',
    hovedkategori: 'SVIKT',
    underkategori: 'PROSJ_RISIKO',
    beskrivelse:
      'Eksisterende rørføring for vann og avløp avviker fra tegninger. Må legges om for å unngå kollisjon med nye konstruksjoner.',
    dato_oppdaget: '2025-01-28',
    grunnlag_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost', 'telefon'],
    },
    kontraktsreferanser: ['§24.1', '§25.2'],
    bh_resultat: 'godkjent',
    bh_begrunnelse: 'Grunnlag godkjent. Dokumentert med foto og nye målinger.',
    laast: true,
    siste_oppdatert: '2025-01-30',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    metode: 'ENHETSPRISER',
    belop_direkte: 450000,
    begrunnelse:
      'Krav basert på kontraktens enhetspriser for rørlegging. Endelig spesifikasjon med detaljert mengdeoversikt følger innen fastsatt frist.',
    saerskilt_krav: {
      produktivitet: {
        belop: 50000,
        dato_klar_over: '2025-01-28',
      },
      rigg_drift: {
        belop: 30000,
        dato_klar_over: '2025-01-28',
      },
    },
    rigg_drift_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost'],
    },
    produktivitetstap_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost'],
    },
    bh_resultat: 'avslatt',
    bh_begrunnelse:
      'Grunnlaget er akseptert, men vederlagskravet avslås da det mangler tilstrekkelig spesifikasjon. TE oppfordres til å revidere kravet med detaljert kostnadskalkyle og dokumentasjon.',
    siste_oppdatert: '2025-02-01',
    antall_versjoner: 1,
  },

  frist: {
    status: 'under_behandling',
    varsel_type: 'varsel',
    frist_varsel: {
      dato_sendt: '2025-01-28',
      metode: ['epost', 'telefon'],
    },
    // krevd_dager kommer først med spesifisert krav
    begrunnelse:
      'Nøytralt varsel sendt. Spesifisert krav med framdriftsplan følger.',
    frist_varsel_ok: true,
    vilkar_oppfylt: true,
    bh_resultat: 'avslatt',
    bh_begrunnelse:
      'Fristkravet avslås da det mangler dokumentasjon av arbeidsoperasjoner og påvirkning på framdrift. TE oppfordres til å revidere kravet med detaljert framdriftsplan.',
    siste_oppdatert: '2025-02-01',
    antall_versjoner: 1,
  },

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Avslått - mangler spesifikasjon',
  visningsstatus_frist: 'Avslått - mangler spesifikasjon',

  overordnet_status: 'UNDER_FORHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'TE',
    handling: 'Revider krav med fullstendig spesifikasjon',
    spor: null,
  },

  sum_krevd: 450000,
  sum_godkjent: 0,

  opprettet: '2025-01-28',
  siste_aktivitet: '2025-02-01',
  antall_events: 5,
};
