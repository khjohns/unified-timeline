/**
 * Endringsordre API
 *
 * Handles API calls for endringsordre (change order) cases.
 */

import { apiFetch } from './client';
import type {
  SakState,
  TimelineEvent,
  SakRelasjon,
  EndringsordreData,
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
  hendelser: Record<string, TimelineEvent[]>;
  eo_hendelser: TimelineEvent[];  // EO case's own events
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
  tittel: string;
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
  return apiFetch<EOKontekstResponse>(`/api/endringsordre/${sakId}/kontekst`);
}

/**
 * Create a new endringsordre case
 */
export async function opprettEndringsordre(
  data: OpprettEORequest
): Promise<OpprettEOResponse> {
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
  return apiFetch<FjernKOEResponse>(
    `/api/endringsordre/${data.eo_sak_id}/koe/${data.koe_sak_id}`,
    {
      method: 'DELETE',
    }
  );
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
  return apiFetch<FindEOerResponse>(`/api/endringsordre/by-relatert/${sakId}`);
}
