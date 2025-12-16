/**
 * Forsering API
 *
 * Handles API calls for forsering (acceleration) cases.
 * Supports both real API and mock data mode.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { getMockForseringKontekstById, getMockKandidatSaker } from '../mocks';
import type { SakState, TimelineEntry, SakRelasjon } from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export interface ForseringKontekstResponse {
  success: boolean;
  sak_id: string;
  relaterte_saker: SakRelasjon[];
  sak_states: Record<string, SakState>;
  hendelser: Record<string, TimelineEntry[]>;
  oppsummering: {
    antall_relaterte_saker: number;
    total_krevde_dager: number;
    total_avslatte_dager: number;
    grunnlag_oversikt: Array<{
      sak_id: string;
      tittel: string;
      hovedkategori: string;
      bh_resultat: string;
    }>;
  };
}

export interface OpprettForseringRequest {
  avslatte_sak_ids: string[];
  estimert_kostnad: number;
  dagmulktsats: number;
  begrunnelse: string;
  avslatte_dager?: number;
}

export interface OpprettForseringResponse {
  success: boolean;
  forsering_sak_id: string;
  message?: string;
}

export interface KandidatSak {
  sak_id: string;
  sakstittel: string;
  frist_krevd_dager?: number;
  frist_godkjent_dager?: number;
  frist_bh_resultat?: string;
  grunnlag_hovedkategori?: string;
  grunnlag_bh_resultat?: string;
}

export interface LeggTilRelatertSakRequest {
  forsering_sak_id: string;
  relatert_sak_ids: string[];
}

export interface LeggTilRelatertSakResponse {
  success: boolean;
  message?: string;
  oppdatert_relaterte: SakRelasjon[];
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch the complete context for a forsering case
 * Includes related cases, their states, events, and summary
 */
export async function fetchForseringKontekst(
  sakId: string
): Promise<ForseringKontekstResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(400);
    return getMockForseringKontekstById(sakId);
  }

  // Real API call
  return apiFetch<ForseringKontekstResponse>(`/api/forsering/${sakId}/kontekst`);
}

/**
 * Create a new forsering case from rejected frist claims
 */
export async function opprettForseringssak(
  data: OpprettForseringRequest
): Promise<OpprettForseringResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(500);
    // In mock mode, just return success with a generated ID
    return {
      success: true,
      forsering_sak_id: `SAK-2025-${String(Math.floor(Math.random() * 900) + 100)}`,
      message: 'Forseringssak opprettet (mock)',
    };
  }

  // Real API call
  return apiFetch<OpprettForseringResponse>('/api/forsering/opprett', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Fetch related cases for a forsering case
 */
export async function fetchRelaterteSaker(
  sakId: string
): Promise<{ success: boolean; relaterte_saker: SakRelasjon[] }> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    const kontekst = getMockForseringKontekstById(sakId);
    return {
      success: true,
      relaterte_saker: kontekst.relaterte_saker,
    };
  }

  // Real API call
  return apiFetch<{ success: boolean; relaterte_saker: SakRelasjon[] }>(
    `/api/forsering/${sakId}/relaterte`
  );
}

/**
 * Fetch candidate cases that can be added to a forsering
 * Returns cases with rejected or partially approved frist claims
 */
export async function fetchKandidatSaker(): Promise<{
  success: boolean;
  kandidat_saker: KandidatSak[];
}> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300);
    return {
      success: true,
      kandidat_saker: getMockKandidatSaker(),
    };
  }

  // Real API call
  return apiFetch<{ success: boolean; kandidat_saker: KandidatSak[] }>(
    '/api/forsering/kandidater'
  );
}

/**
 * Add related cases to a forsering case
 */
export async function leggTilRelaterteSaker(
  data: LeggTilRelatertSakRequest
): Promise<LeggTilRelatertSakResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(400);
    // In mock mode, simulate adding the cases
    const kandidater = getMockKandidatSaker();
    const nyeRelasjoner: SakRelasjon[] = data.relatert_sak_ids.map((sakId) => {
      const kandidat = kandidater.find((k) => k.sak_id === sakId);
      return {
        relatert_sak_id: sakId,
        relatert_sak_tittel: kandidat?.sakstittel,
      };
    });

    return {
      success: true,
      message: `${data.relatert_sak_ids.length} sak(er) lagt til`,
      oppdatert_relaterte: nyeRelasjoner,
    };
  }

  // Real API call
  return apiFetch<LeggTilRelatertSakResponse>(
    `/api/forsering/${data.forsering_sak_id}/relaterte`,
    {
      method: 'POST',
      body: JSON.stringify({ relatert_sak_ids: data.relatert_sak_ids }),
    }
  );
}
