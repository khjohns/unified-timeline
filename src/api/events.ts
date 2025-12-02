/**
 * Events API
 *
 * Handles submitting new events to the backend (write operations).
 * All state mutations happen through events.
 */

import { apiFetch } from './client';
import { EventType } from '../types/timeline';

export interface EventSubmitResponse {
  event_id: string;
  tidsstempel: string;
  success: boolean;
  message?: string;
}

export interface EventPayload {
  event_type: EventType;
  data: Record<string, any>;
}

/**
 * Submit a new event to the backend
 *
 * @param sakId - The case ID
 * @param eventType - The type of event to submit
 * @param data - The event payload data
 * @returns The event submission result
 */
export async function submitEvent(
  sakId: string,
  eventType: EventType,
  data: Record<string, any>
): Promise<EventSubmitResponse> {
  return apiFetch<EventSubmitResponse>(`/api/saker/${sakId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      event_type: eventType,
      data,
    }),
  });
}
