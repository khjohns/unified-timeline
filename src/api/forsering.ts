/**
 * Forsering API
 *
 * Handles API calls for forsering (acceleration) cases.
 * Supports both real API and mock data mode.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { getMockForseringKontekstById, getMockKandidatSaker } from '../mocks';
import type { SakState, TimelineEvent, SakRelasjon, TimelineEntry } from '../types/timeline';

/**
 * Convert legacy TimelineEntry to CloudEvents format
 * Used for mock data conversion
 */
function convertToCloudEvent(e: TimelineEntry, sakId: string): TimelineEvent {
  return {
    specversion: '1.0' as const,
    id: e.event_id,
    source: `/projects/unknown/cases/${sakId}`,
    type: `no.oslo.koe.${e.event_type || e.type}`,
    time: e.tidsstempel,
    subject: sakId,
    datacontenttype: 'application/json' as const,
    actor: e.aktor,
    actorrole: e.rolle,
    spor: e.spor,
    summary: e.sammendrag,
    data: e.event_data,
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface ForseringKontekstResponse {
  success: boolean;
  sak_id: string;
  relaterte_saker: SakRelasjon[];
  sak_states: Record<string, SakState>;
  hendelser: Record<string, TimelineEvent[]>;
  forsering_hendelser: TimelineEvent[];  // Forsering case's own events
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

export interface FjernRelatertSakRequest {
  forsering_sak_id: string;
  relatert_sak_id: string;
}

export interface FjernRelatertSakResponse {
  success: boolean;
  message?: string;
}

export interface StoppForseringRequest {
  forsering_sak_id: string;
  begrunnelse: string;
  paalopte_kostnader?: number;
  expected_version?: number;
}

export interface StoppForseringResponse {
  success: boolean;
  message?: string;
  dato_stoppet: string;
}

export interface BHResponsForseringRequest {
  forsering_sak_id: string;
  aksepterer: boolean;
  godkjent_kostnad?: number;
  begrunnelse: string;
  expected_version?: number;
}

export interface BHResponsForseringResponse {
  success: boolean;
  message?: string;
}

export interface OppdaterKostnaderRequest {
  forsering_sak_id: string;
  paalopte_kostnader: number;
  kommentar?: string;
  expected_version?: number;
}

export interface OppdaterKostnaderResponse {
  success: boolean;
  message?: string;
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
    const mockData = getMockForseringKontekstById(sakId);

    // Convert legacy mock data to CloudEvents format
    const convertedHendelser: Record<string, TimelineEvent[]> = {};
    for (const [relatertSakId, events] of Object.entries(mockData.hendelser)) {
      convertedHendelser[relatertSakId] = events.map(e =>
        convertToCloudEvent(e, relatertSakId)
      );
    }

    return {
      ...mockData,
      hendelser: convertedHendelser,
      forsering_hendelser: mockData.forsering_hendelser.map(e =>
        convertToCloudEvent(e, sakId)
      ),
    };
  }

  // Real API call - backend returns CloudEvents format
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

/**
 * Remove a related case from a forsering case
 */
export async function fjernRelatertSak(
  data: FjernRelatertSakRequest
): Promise<FjernRelatertSakResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300);
    return {
      success: true,
      message: 'Sak fjernet fra forsering',
    };
  }

  // Real API call
  return apiFetch<FjernRelatertSakResponse>(
    `/api/forsering/${data.forsering_sak_id}/relaterte/${data.relatert_sak_id}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Stop an active forsering
 */
export async function stoppForsering(
  data: StoppForseringRequest
): Promise<StoppForseringResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(400);
    return {
      success: true,
      message: 'Forsering stoppet',
      dato_stoppet: new Date().toISOString(),
    };
  }

  // Real API call
  return apiFetch<StoppForseringResponse>(
    `/api/forsering/${data.forsering_sak_id}/stopp`,
    {
      method: 'POST',
      body: JSON.stringify({
        begrunnelse: data.begrunnelse,
        paalopte_kostnader: data.paalopte_kostnader,
        expected_version: data.expected_version,
      }),
    }
  );
}

/**
 * BH responds to a forsering claim (accept or reject)
 */
export async function bhResponsForsering(
  data: BHResponsForseringRequest
): Promise<BHResponsForseringResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(400);
    return {
      success: true,
      message: data.aksepterer
        ? 'Forsering akseptert'
        : 'Forsering avslått',
    };
  }

  // Real API call
  return apiFetch<BHResponsForseringResponse>(
    `/api/forsering/${data.forsering_sak_id}/bh-respons`,
    {
      method: 'POST',
      body: JSON.stringify({
        aksepterer: data.aksepterer,
        godkjent_kostnad: data.godkjent_kostnad,
        begrunnelse: data.begrunnelse,
        expected_version: data.expected_version,
      }),
    }
  );
}

/**
 * Update incurred costs for an active forsering
 */
export async function oppdaterKostnader(
  data: OppdaterKostnaderRequest
): Promise<OppdaterKostnaderResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300);
    return {
      success: true,
      message: 'Kostnader oppdatert',
    };
  }

  // Real API call
  return apiFetch<OppdaterKostnaderResponse>(
    `/api/forsering/${data.forsering_sak_id}/kostnader`,
    {
      method: 'PUT',
      body: JSON.stringify({
        paalopte_kostnader: data.paalopte_kostnader,
        kommentar: data.kommentar,
        expected_version: data.expected_version,
      }),
    }
  );
}

// ============================================================================
// FORSERING LOOKUP (for related cases)
// ============================================================================

export interface ForseringSomRefererer {
  forsering_sak_id: string;
  forsering_sak_tittel: string;
  dato_varslet: string;
  er_iverksatt: boolean;
  er_stoppet: boolean;
}

export interface FindForseringerResponse {
  success: boolean;
  forseringer: ForseringSomRefererer[];
}

/**
 * Find forsering cases that reference a given case
 * Used to show back-links from related cases to their forsering
 */
export async function findForseringerForSak(
  sakId: string
): Promise<FindForseringerResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    return getMockForseringerForSak(sakId);
  }

  // Real API call
  return apiFetch<FindForseringerResponse>(`/api/forsering/by-relatert/${sakId}`);
}

/**
 * Mock helper to find forsering cases referencing a given case
 */
function getMockForseringerForSak(sakId: string): FindForseringerResponse {
  // Import the mock forsering case and check if it references this sakId
  // For now, we know SAK-2025-012 references SAK-2025-003, SAK-2025-006, SAK-2025-013
  const forseringRelations: Record<string, ForseringSomRefererer> = {
    'SAK-2025-003': {
      forsering_sak_id: 'SAK-2025-012',
      forsering_sak_tittel: 'Forsering - Samlekrav etter avslåtte fristforlengelser',
      dato_varslet: '2025-02-10',
      er_iverksatt: true,
      er_stoppet: false,
    },
    'SAK-2025-006': {
      forsering_sak_id: 'SAK-2025-012',
      forsering_sak_tittel: 'Forsering - Samlekrav etter avslåtte fristforlengelser',
      dato_varslet: '2025-02-10',
      er_iverksatt: true,
      er_stoppet: false,
    },
    'SAK-2025-013': {
      forsering_sak_id: 'SAK-2025-012',
      forsering_sak_tittel: 'Forsering - Samlekrav etter avslåtte fristforlengelser',
      dato_varslet: '2025-02-10',
      er_iverksatt: true,
      er_stoppet: false,
    },
  };

  const forsering = forseringRelations[sakId];
  return {
    success: true,
    forseringer: forsering ? [forsering] : [],
  };
}
