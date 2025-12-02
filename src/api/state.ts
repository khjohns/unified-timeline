/**
 * State API
 *
 * Handles fetching the current state of a case (read-only).
 * State is computed by the backend from the event stream.
 */

import { apiFetch } from './client';
import { SakState } from '../types/timeline';

export interface StateResponse {
  state: SakState;
  timestamp: string;
}

/**
 * Fetch the current state of a case
 *
 * @param sakId - The case ID
 * @returns The current state and timestamp
 */
export async function fetchCaseState(sakId: string): Promise<StateResponse> {
  return apiFetch<StateResponse>(`/api/saker/${sakId}/state`);
}
