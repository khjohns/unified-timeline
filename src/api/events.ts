/**
 * Events API
 *
 * Handles submitting new events to the backend (write operations).
 * All state mutations happen through events.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { EventType } from '../types/timeline';

export interface EventSubmitResponse {
  event_id: string;
  tidsstempel: string;
  success: boolean;
  message?: string;
  pdf_uploaded?: boolean;
  pdf_source?: 'client' | 'server';
  new_version?: number;
}

export interface EventPayload {
  event_type: EventType;
  data: Record<string, any>;
  expected_version?: number;
  catenda_topic_id?: string;
  pdf_base64?: string;
  pdf_filename?: string;
}

/**
 * Submit a new event to the backend
 *
 * @param sakId - The case ID
 * @param eventType - The type of event to submit
 * @param data - The event payload data
 * @param options - Optional submission parameters (version, PDF, etc.)
 * @returns The event submission result
 */
export async function submitEvent(
  sakId: string,
  eventType: EventType,
  data: Record<string, any>,
  options?: {
    expectedVersion?: number;
    catendaTopicId?: string;
    pdfBase64?: string;
    pdfFilename?: string;
  }
): Promise<EventSubmitResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(800); // Simulate network delay for submission
    console.log('Mock event submitted:', { sakId, eventType, data, options });

    // Return mock success response
    return {
      event_id: `evt-mock-${Date.now()}`,
      tidsstempel: new Date().toISOString(),
      success: true,
      message: 'Mock event submitted successfully',
      pdf_uploaded: !!options?.pdfBase64,
      pdf_source: options?.pdfBase64 ? 'client' : undefined,
      new_version: (options?.expectedVersion ?? 0) + 1,
    };
  }

  // Real API call
  return apiFetch<EventSubmitResponse>(`/api/events`, {
    method: 'POST',
    body: JSON.stringify({
      sak_id: sakId,
      event: {
        event_type: eventType,
        ...data,
      },
      expected_version: options?.expectedVersion ?? 0,
      catenda_topic_id: options?.catendaTopicId,
      pdf_base64: options?.pdfBase64,
      pdf_filename: options?.pdfFilename,
    }),
  });
}
