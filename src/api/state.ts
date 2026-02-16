/**
 * State API
 *
 * Handles fetching the current state of a case (read-only).
 * State is computed by the backend from the event stream.
 */

import { apiFetch } from './client';
import { StateResponse, TimelineResponse, HistorikkResponse, CaseContextResponse } from '../types/api';

/**
 * Fetch the current state of a case
 *
 * @param sakId - The case ID
 * @returns The current state and version
 */
export async function fetchCaseState(sakId: string): Promise<StateResponse> {
  return apiFetch<StateResponse>(`/api/cases/${sakId}/state`);
}

/**
 * Fetch the timeline (event history) of a case
 *
 * @param sakId - The case ID
 * @returns The timeline events and version
 *
 * Note: Backend returns CloudEvents v1.0 format.
 */
export async function fetchTimeline(sakId: string): Promise<TimelineResponse> {
  return apiFetch<TimelineResponse>(`/api/cases/${sakId}/timeline`);
}

/**
 * Fetch the revision history for vederlag and frist tracks
 *
 * @param sakId - The case ID
 * @returns The revision history for both tracks
 */
export async function fetchHistorikk(sakId: string): Promise<HistorikkResponse> {
  return apiFetch<HistorikkResponse>(`/api/cases/${sakId}/historikk`);
}

/**
 * Fetch combined case context: state + timeline + historikk in one request.
 * Eliminates redundant Supabase round-trips by fetching events once on backend.
 */
export async function fetchCaseContext(sakId: string): Promise<CaseContextResponse> {
  return apiFetch<CaseContextResponse>(`/api/cases/${sakId}/context`);
}
