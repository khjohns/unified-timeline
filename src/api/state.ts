/**
 * State API
 *
 * Handles fetching the current state of a case (read-only).
 * State is computed by the backend from the event stream.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { StateResponse, TimelineResponse, HistorikkResponse } from '../types/api';
import { getMockStateById, getMockTimelineById, getMockHistorikkById } from '../mocks/mockData';

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
 * Note: Both mock data and real backend return TimelineEvent[] with:
 * - event_id, tidsstempel, type, event_type, aktor, rolle, spor, sammendrag, event_data
 */
export async function fetchTimeline(sakId: string): Promise<TimelineResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    const events = getMockTimelineById(sakId);
    // Mock data already has correct TimelineEntry structure - map to TimelineEvent
    return {
      events: events.map(e => ({
        event_id: e.event_id,
        tidsstempel: e.tidsstempel,
        type: e.type,
        event_type: e.event_type,
        aktor: e.aktor,
        rolle: e.rolle,
        spor: e.spor,
        sammendrag: e.sammendrag,
        event_data: e.event_data,
      })),
      version: 1,
    };
  }

  // Real API call - backend returns TimelineResponse with full event data
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
