/**
 * Events API
 *
 * Handles submitting new events to the backend (write operations).
 * All state mutations happen through events.
 */

import { apiFetch } from './client';
import { EventType } from '../types/timeline';

// Storage keys (MUST match their respective sources)
const USER_ROLE_STORAGE_KEY = 'koe-user-role';
const USER_EMAIL_STORAGE_KEY = 'koe-user-email';

/**
 * Get current user role from localStorage.
 * In production, this will come from Catenda API team membership.
 */
function getCurrentUserRole(): 'TE' | 'BH' {
  // TODO: I produksjon hentes rolle fra Catenda API basert på team-tilhørighet
  const stored = localStorage.getItem(USER_ROLE_STORAGE_KEY);
  return stored === 'BH' ? 'BH' : 'TE'; // Default to TE
}

/**
 * Get current user identifier from Supabase Auth.
 * Falls back to 'Ukjent bruker' if not authenticated.
 */
function getCurrentAktor(): string {
  const email = localStorage.getItem(USER_EMAIL_STORAGE_KEY);
  return email || 'Ukjent bruker';
}

export interface EventSubmitResponse {
  event_id: string;
  tidsstempel: string;
  success: boolean;
  message?: string;
  pdf_uploaded?: boolean;
  pdf_source?: 'client' | 'server';
  new_version?: number;
  /** Whether the event was synced to Catenda (prosjekthotellet) */
  catenda_synced?: boolean;
  /** Reason why Catenda sync was skipped or failed */
  catenda_skipped_reason?: 'no_topic_id' | 'not_authenticated' | 'error';
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
  return apiFetch<EventSubmitResponse>(`/api/events`, {
    method: 'POST',
    body: JSON.stringify({
      sak_id: sakId,
      event: {
        event_type: eventType,
        aktor: getCurrentAktor(),
        aktor_rolle: getCurrentUserRole(),
        data: data,
      },
      expected_version: options?.expectedVersion ?? 0,
      catenda_topic_id: options?.catendaTopicId,
      pdf_base64: options?.pdfBase64,
      pdf_filename: options?.pdfFilename,
    }),
  });
}
