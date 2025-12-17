/**
 * Endringsordre API
 *
 * Handles API calls for endringsordre (change order) cases.
 * Supports both real API and mock data mode.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import type {
  SakState,
  TimelineEntry,
  SakRelasjon,
  EndringsordreData,
  EOKonsekvenser,
  VederlagsMetode,
} from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export interface EOKontekstResponse {
  success: boolean;
  sak_id: string;
  relaterte_saker: SakRelasjon[];
  sak_states: Record<string, SakState>;
  hendelser: Record<string, TimelineEntry[]>;
  eo_hendelser: TimelineEntry[];  // EO case's own events
  oppsummering: {
    antall_koe_saker: number;
    total_krevd_vederlag: number;
    total_godkjent_vederlag: number;
    total_krevd_dager: number;
    total_godkjent_dager: number;
    koe_oversikt: Array<{
      sak_id: string;
      tittel: string;
      grunnlag_status?: string;
      vederlag_status?: string;
      frist_status?: string;
      krevd_vederlag?: number;
      godkjent_vederlag?: number;
      krevd_dager?: number;
      godkjent_dager?: number;
    }>;
  };
}

export interface OpprettEORequest {
  eo_nummer: string;
  beskrivelse: string;
  koe_sak_ids?: string[];
  konsekvenser?: {
    sha?: boolean;
    kvalitet?: boolean;
    fremdrift?: boolean;
    pris?: boolean;
    annet?: boolean;
  };
  konsekvens_beskrivelse?: string;
  oppgjorsform?: VederlagsMetode;
  kompensasjon_belop?: number;
  fradrag_belop?: number;
  er_estimat?: boolean;
  frist_dager?: number;
  ny_sluttdato?: string;
  utstedt_av?: string;
}

export interface OpprettEOResponse {
  success: boolean;
  sak_id: string;
  sakstype: string;
  relaterte_saker: SakRelasjon[];
  endringsordre_data: EndringsordreData;
  message?: string;
}

export interface KandidatKOE {
  sak_id: string;
  tittel: string;
  overordnet_status: string;
  sum_godkjent?: number;
  godkjent_dager?: number;
}

export interface LeggTilKOERequest {
  eo_sak_id: string;
  koe_sak_id: string;
}

export interface LeggTilKOEResponse {
  success: boolean;
  message?: string;
}

export interface FjernKOERequest {
  eo_sak_id: string;
  koe_sak_id: string;
}

export interface FjernKOEResponse {
  success: boolean;
  message?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch the complete context for an endringsordre case
 * Includes related KOE cases, their states, events, and summary
 */
export async function fetchEOKontekst(
  sakId: string
): Promise<EOKontekstResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(400);
    return getMockEOKontekst(sakId);
  }

  // Real API call
  return apiFetch<EOKontekstResponse>(`/api/endringsordre/${sakId}/kontekst`);
}

/**
 * Create a new endringsordre case
 */
export async function opprettEndringsordre(
  data: OpprettEORequest
): Promise<OpprettEOResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(500);
    return getMockOpprettEOResponse(data);
  }

  // Real API call
  return apiFetch<OpprettEOResponse>('/api/endringsordre/opprett', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Fetch related KOE cases for an endringsordre
 */
export async function fetchRelatertKOESaker(
  sakId: string
): Promise<{ success: boolean; relaterte_saker: SakRelasjon[] }> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    const kontekst = getMockEOKontekst(sakId);
    return {
      success: true,
      relaterte_saker: kontekst.relaterte_saker,
    };
  }

  // Real API call
  return apiFetch<{ success: boolean; relaterte_saker: SakRelasjon[] }>(
    `/api/endringsordre/${sakId}/relaterte`
  );
}

/**
 * Fetch candidate KOE cases that can be added to an endringsordre
 * Returns cases where kan_utstede_eo is true
 */
export async function fetchKandidatKOESaker(): Promise<{
  success: boolean;
  kandidat_saker: KandidatKOE[];
}> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300);
    return {
      success: true,
      kandidat_saker: getMockKandidatKOESaker(),
    };
  }

  // Real API call
  return apiFetch<{ success: boolean; kandidat_saker: KandidatKOE[] }>(
    '/api/endringsordre/kandidater'
  );
}

/**
 * Add a KOE case to an endringsordre
 */
export async function leggTilKOE(
  data: LeggTilKOERequest
): Promise<LeggTilKOEResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(400);
    return {
      success: true,
      message: 'KOE lagt til endringsordre',
    };
  }

  // Real API call
  return apiFetch<LeggTilKOEResponse>(
    `/api/endringsordre/${data.eo_sak_id}/koe`,
    {
      method: 'POST',
      body: JSON.stringify({ koe_sak_id: data.koe_sak_id }),
    }
  );
}

/**
 * Remove a KOE case from an endringsordre
 */
export async function fjernKOE(
  data: FjernKOERequest
): Promise<FjernKOEResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300);
    return {
      success: true,
      message: 'KOE fjernet fra endringsordre',
    };
  }

  // Real API call
  return apiFetch<FjernKOEResponse>(
    `/api/endringsordre/${data.eo_sak_id}/koe/${data.koe_sak_id}`,
    {
      method: 'DELETE',
    }
  );
}

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

function getMockEOKontekst(sakId: string): EOKontekstResponse {
  // Return a mock EO context
  return {
    success: true,
    sak_id: sakId,
    relaterte_saker: [
      {
        relatert_sak_id: 'SAK-2025-001',
        relatert_sak_tittel: 'KOE - Fundamentendring',
        bimsync_issue_number: 1,
      },
      {
        relatert_sak_id: 'SAK-2025-002',
        relatert_sak_tittel: 'KOE - Tilleggsarbeid ventilasjon',
        bimsync_issue_number: 2,
      },
    ],
    sak_states: {},
    hendelser: {},
    eo_hendelser: [
      {
        event_id: 'evt-eo-1',
        tidsstempel: new Date().toISOString(),
        type: 'eo_utstedt',
        event_type: 'eo_utstedt',
        aktor: 'Ole Byggherre',
        rolle: 'BH',
        spor: null,
        sammendrag: 'Endringsordre utstedt',
      },
    ],
    oppsummering: {
      antall_koe_saker: 2,
      total_krevd_vederlag: 350000,
      total_godkjent_vederlag: 300000,
      total_krevd_dager: 15,
      total_godkjent_dager: 10,
      koe_oversikt: [
        {
          sak_id: 'SAK-2025-001',
          tittel: 'KOE - Fundamentendring',
          grunnlag_status: 'godkjent',
          vederlag_status: 'godkjent',
          frist_status: 'delvis_godkjent',
          krevd_vederlag: 200000,
          godkjent_vederlag: 180000,
          krevd_dager: 10,
          godkjent_dager: 7,
        },
        {
          sak_id: 'SAK-2025-002',
          tittel: 'KOE - Tilleggsarbeid ventilasjon',
          grunnlag_status: 'godkjent',
          vederlag_status: 'godkjent',
          frist_status: 'godkjent',
          krevd_vederlag: 150000,
          godkjent_vederlag: 120000,
          krevd_dager: 5,
          godkjent_dager: 3,
        },
      ],
    },
  };
}

function getMockOpprettEOResponse(data: OpprettEORequest): OpprettEOResponse {
  const sakId = `SAK-EO-${String(Math.floor(Math.random() * 900) + 100)}`;
  const netto = (data.kompensasjon_belop || 0) - (data.fradrag_belop || 0);

  return {
    success: true,
    sak_id: sakId,
    sakstype: 'endringsordre',
    relaterte_saker: (data.koe_sak_ids || []).map((id) => ({
      relatert_sak_id: id,
    })),
    endringsordre_data: {
      relaterte_koe_saker: data.koe_sak_ids || [],
      eo_nummer: data.eo_nummer,
      revisjon_nummer: 0,
      beskrivelse: data.beskrivelse,
      konsekvenser: {
        sha: data.konsekvenser?.sha || false,
        kvalitet: data.konsekvenser?.kvalitet || false,
        fremdrift: data.konsekvenser?.fremdrift || false,
        pris: data.konsekvenser?.pris || false,
        annet: data.konsekvenser?.annet || false,
      },
      konsekvens_beskrivelse: data.konsekvens_beskrivelse,
      oppgjorsform: data.oppgjorsform,
      kompensasjon_belop: data.kompensasjon_belop,
      fradrag_belop: data.fradrag_belop,
      er_estimat: data.er_estimat || false,
      frist_dager: data.frist_dager,
      ny_sluttdato: data.ny_sluttdato,
      status: 'utstedt',
      dato_utstedt: new Date().toISOString().split('T')[0],
      utstedt_av: data.utstedt_av,
      netto_belop: netto,
      har_priskonsekvens: data.konsekvenser?.pris || netto !== 0,
      har_fristkonsekvens: data.konsekvenser?.fremdrift || (data.frist_dager !== undefined && data.frist_dager > 0),
    },
    message: 'Endringsordre opprettet (mock)',
  };
}

function getMockKandidatKOESaker(): KandidatKOE[] {
  // Return mock candidate KOE cases (cases where kan_utstede_eo is true)
  return [
    {
      sak_id: 'SAK-2025-001',
      tittel: 'KOE - Fundamentendring',
      overordnet_status: 'OMFORENT',
      sum_godkjent: 180000,
      godkjent_dager: 7,
    },
    {
      sak_id: 'SAK-2025-002',
      tittel: 'KOE - Tilleggsarbeid ventilasjon',
      overordnet_status: 'OMFORENT',
      sum_godkjent: 120000,
      godkjent_dager: 3,
    },
    {
      sak_id: 'SAK-2025-005',
      tittel: 'KOE - Endring i bæresystem',
      overordnet_status: 'OMFORENT',
      sum_godkjent: 450000,
      godkjent_dager: 14,
    },
  ];
}

// ============================================================================
// EO LOOKUP (for related cases)
// ============================================================================

export interface EOSomRefererer {
  eo_sak_id: string;
  eo_nummer: string;
  dato_utstedt?: string;
  status: string;
}

export interface FindEOerResponse {
  success: boolean;
  endringsordrer: EOSomRefererer[];
}

/**
 * Find endringsordre cases that reference a given KOE case
 * Used to show back-links from KOE cases to their EO
 */
export async function findEOerForSak(
  sakId: string
): Promise<FindEOerResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    return getMockEOerForSak(sakId);
  }

  // Real API call
  return apiFetch<FindEOerResponse>(`/api/endringsordre/by-relatert/${sakId}`);
}

function getMockEOerForSak(sakId: string): FindEOerResponse {
  // Mock: SAK-2025-001 and SAK-2025-002 are referenced by EO-001
  const eoRelations: Record<string, EOSomRefererer> = {
    'SAK-2025-001': {
      eo_sak_id: 'SAK-EO-001',
      eo_nummer: 'EO-001',
      dato_utstedt: '2025-02-15',
      status: 'utstedt',
    },
    'SAK-2025-002': {
      eo_sak_id: 'SAK-EO-001',
      eo_nummer: 'EO-001',
      dato_utstedt: '2025-02-15',
      status: 'utstedt',
    },
  };

  const eo = eoRelations[sakId];
  return {
    success: true,
    endringsordrer: eo ? [eo] : [],
  };
}
