/**
 * State API
 *
 * Handles fetching the current state of a case (read-only).
 * State is computed by the backend from the event stream.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { StateResponse, TimelineResponse, HistorikkResponse } from '../types/api';
import { getMockStateById, getMockTimelineById, getMockHistorikkById } from '../mocks';

/**
 * Fetch the current state of a case
 *
 * @param sakId - The case ID
 * @returns The current state and version
 */
export async function fetchCaseState(sakId: string): Promise<StateResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300); // Simulate network delay
    const state = getMockStateById(sakId);
    return {
      version: 1,
      state,
    };
  }

  // Real API call
  return apiFetch<StateResponse>(`/api/cases/${sakId}/state`);
}

/**
 * Fetch the timeline (event history) of a case
 *
 * @param sakId - The case ID
 * @returns The timeline events and version
 *
 * Note: Backend returns CloudEvents v1.0 format.
 * Mock data uses legacy format and is converted here.
 */
export async function fetchTimeline(sakId: string): Promise<TimelineResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    const legacyEvents = getMockTimelineById(sakId);
    // Convert legacy mock data to CloudEvents format
    return {
      events: legacyEvents.map(e => ({
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
      })),
      version: 1,
    };
  }

  // Real API call - backend returns CloudEvents v1.0 format
  return apiFetch<TimelineResponse>(`/api/cases/${sakId}/timeline`);
}

/**
 * Fetch the revision history for vederlag and frist tracks
 *
 * @param sakId - The case ID
 * @returns The revision history for both tracks
 */
export async function fetchHistorikk(sakId: string): Promise<HistorikkResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    return getMockHistorikkById(sakId);
  }

  // Real API call
  return apiFetch<HistorikkResponse>(`/api/cases/${sakId}/historikk`);
}
