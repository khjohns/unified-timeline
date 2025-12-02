/**
 * State API
 *
 * Handles fetching the current state of a case (read-only).
 * State is computed by the backend from the event stream.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { StateResponse } from '../types/api';
import { getMockStateById } from '../mocks/mockData';

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
  return apiFetch<StateResponse>(`/api/saker/${sakId}/state`);
}
