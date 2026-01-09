import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-002: Forsinket materialleveranse - Oslo Sykehus
 *
 * Scenario: Ny sak i utkast
 * - Grunnlag: Utkast
 * - Vederlag: Utkast
 * - Frist: Utkast
 *
 * Demonstrerer: Nyopprettet sak som ikke har sendt noe data enda
 */
export const mockSakState2: SakState = {
  sak_id: 'SAK-2025-002',
  sakstittel: 'Forsinket materialleveranse - Oslo Sykehus',

  grunnlag: {
    status: 'utkast',
    kontraktsreferanser: [],
    laast: false,
    antall_versjoner: 0,
  },

  vederlag: {
    status: 'utkast',
    antall_versjoner: 0,
  },

  frist: {
    status: 'utkast',
    antall_versjoner: 0,
  },

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Utkast',
  visningsstatus_frist: 'Utkast',

  overordnet_status: 'UTKAST',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'TE',
    handling: 'Varsle endringsforhold',
    spor: 'grunnlag',
  },

  sum_krevd: 0,
  sum_godkjent: 0,

  opprettet: '2025-01-25',
  siste_aktivitet: '2025-01-25',
  antall_events: 1,
};
