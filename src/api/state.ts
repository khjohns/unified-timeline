/**
 * State API
 *
 * Handles fetching the current state of a case (read-only).
 * State is computed by the backend from the event stream.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { StateResponse, TimelineResponse } from '../types/api';
import { getMockStateById, getMockTimelineById } from '../mocks/mockData';

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
 */
export async function fetchTimeline(sakId: string): Promise<TimelineResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    const events = getMockTimelineById(sakId);
    return {
      events: events.map(e => ({
        event_id: e.id,
        tidsstempel: e.timestamp,
        type: e.type,
        aktor: e.actor,
        rolle: e.role,
        spor: e.track,
        sammendrag: e.summary,
      })),
      version: 1,
    };
  }

  // Real API call
  return apiFetch<TimelineResponse>(`/api/cases/${sakId}/timeline`);
}
