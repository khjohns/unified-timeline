/**
 * Forsering API
 *
 * Handles API calls for forsering (acceleration) cases.
 */

import { apiFetch } from './client';
import type { SakState, TimelineEvent, SakRelasjon } from '../types/timeline';

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

/**
 * Catenda sync status included in mutation responses
 */
export interface CatendaSyncStatus {
  catenda_synced: boolean;
  catenda_comment_posted?: boolean;
  catenda_status_updated?: boolean;
  catenda_skipped_reason?: 'no_topic_id' | 'not_authenticated' | 'no_client' | 'sync_not_attempted' | 'error';
  catenda_error?: string;
}

export interface StoppForseringRequest {
  forsering_sak_id: string;
  begrunnelse: string;
  paalopte_kostnader?: number;
  expected_version?: number;
}

export interface StoppForseringResponse extends CatendaSyncStatus {
  success: boolean;
  message?: string;
  dato_stoppet: string;
}

/** Per-sak vurdering av om avslaget var berettiget */
export interface ForseringsrettVurdering {
  sak_id: string;
  avslag_berettiget: boolean;
}

export interface BHResponsForseringRequest {
  forsering_sak_id: string;
  aksepterer: boolean;
  godkjent_kostnad?: number;
  begrunnelse: string;
  expected_version?: number;

  // Port 1: Per-sak vurdering av forseringsrett (§33.8)
  vurdering_per_sak?: ForseringsrettVurdering[];
  dager_med_forseringsrett?: number;
  // Backward compatibility: old field with inverted semantics
  // grunnlag_fortsatt_gyldig=true means "rejection was justified" (TE has NO right)
  grunnlag_fortsatt_gyldig?: boolean;

  // Port 2: 30%-regel
  trettiprosent_overholdt?: boolean;
  trettiprosent_begrunnelse?: string;

  // Særskilte krav (§34.1.3)
  rigg_varslet_i_tide?: boolean;
  produktivitet_varslet_i_tide?: boolean;
  godkjent_rigg_drift?: number;
  godkjent_produktivitet?: number;

  // Subsidiært
  subsidiaer_triggers?: string[];
  subsidiaer_godkjent_belop?: number;
  subsidiaer_begrunnelse?: string;
}

export interface BHResponsForseringResponse extends CatendaSyncStatus {
  success: boolean;
  message?: string;
}

/**
 * Response fra valider-grunnlag endpoint.
 * Sjekker om forseringsgrunnlaget fortsatt er gyldig.
 */
export interface ValiderGrunnlagResponse {
  success: boolean;
  er_gyldig: boolean;
  grunn?: string;
  pavirket_sak_id?: string;
  ny_status?: string;
}

export interface OppdaterKostnaderRequest {
  forsering_sak_id: string;
  paalopte_kostnader: number;
  kommentar?: string;
  expected_version?: number;
}

export interface OppdaterKostnaderResponse extends CatendaSyncStatus {
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
  return apiFetch<ForseringKontekstResponse>(`/api/forsering/${sakId}/kontekst`);
}

/**
 * Create a new forsering case from rejected frist claims
 */
export async function opprettForseringssak(
  data: OpprettForseringRequest
): Promise<OpprettForseringResponse> {
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
 * BH responds to a forsering claim (accept or reject) - tre-port modell
 */
export async function bhResponsForsering(
  data: BHResponsForseringRequest
): Promise<BHResponsForseringResponse> {
  return apiFetch<BHResponsForseringResponse>(
    `/api/forsering/${data.forsering_sak_id}/bh-respons`,
    {
      method: 'POST',
      body: JSON.stringify({
        aksepterer: data.aksepterer,
        godkjent_kostnad: data.godkjent_kostnad,
        begrunnelse: data.begrunnelse,
        expected_version: data.expected_version,
        // Port 1: Per-sak vurdering av forseringsrett (§33.8)
        vurdering_per_sak: data.vurdering_per_sak,
        dager_med_forseringsrett: data.dager_med_forseringsrett,
        grunnlag_fortsatt_gyldig: data.grunnlag_fortsatt_gyldig,
        // Port 2: 30%-regel
        trettiprosent_overholdt: data.trettiprosent_overholdt,
        trettiprosent_begrunnelse: data.trettiprosent_begrunnelse,
        // Særskilte krav (§34.1.3)
        rigg_varslet_i_tide: data.rigg_varslet_i_tide,
        produktivitet_varslet_i_tide: data.produktivitet_varslet_i_tide,
        godkjent_rigg_drift: data.godkjent_rigg_drift,
        godkjent_produktivitet: data.godkjent_produktivitet,
        // Subsidiært
        subsidiaer_triggers: data.subsidiaer_triggers,
        subsidiaer_godkjent_belop: data.subsidiaer_godkjent_belop,
        subsidiaer_begrunnelse: data.subsidiaer_begrunnelse,
      }),
    }
  );
}

/**
 * Valider om forseringsgrunnlaget fortsatt er gyldig.
 * Brukes av BH for å sjekke Port 1 før de gir respons.
 * Grunnlaget er ugyldig hvis BH har snudd på fristforlengelsen.
 */
export async function validerForseringsgrunnlag(
  sakId: string
): Promise<ValiderGrunnlagResponse> {
  return apiFetch<ValiderGrunnlagResponse>(
    `/api/forsering/${sakId}/valider-grunnlag`
  );
}

/**
 * Update incurred costs for an active forsering
 */
export async function oppdaterKostnader(
  data: OppdaterKostnaderRequest
): Promise<OppdaterKostnaderResponse> {
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
  return apiFetch<FindForseringerResponse>(`/api/forsering/by-relatert/${sakId}`);
}
