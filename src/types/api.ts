/**
 * API Client Types
 *
 * Type definitions for API requests and responses.
 * These types define the contract between frontend and backend.
 */

import { SakState, EventType } from './timeline';

// ========== API RESPONSES ==========

export interface StateResponse {
  version: number;
  state: SakState;
}

export interface EventSubmitResponse {
  success: boolean;
  event_id?: string;
  new_version?: number;
  state?: SakState;
  error?: string;
  message?: string;
}

export interface TimelineResponse {
  events: Array<{
    event_id: string;
    tidsstempel: string;
    type: string;
    aktor: string;
    rolle: 'TE' | 'BH';
    spor: 'grunnlag' | 'vederlag' | 'frist' | null;
    sammendrag: string;
  }>;
}

// ========== API REQUESTS ==========

export interface EventSubmitRequest {
  event_type: EventType;
  data: Record<string, unknown>;
  actor?: string;
  role?: 'TE' | 'BH';
}

// ========== API ERROR ==========
// Note: ApiError class is defined in api/client.ts to avoid circular dependencies

// ========== API CLIENT CONFIGURATION ==========

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}
