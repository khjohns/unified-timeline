/**
 * Type Definitions
 *
 * Central export point for all TypeScript types used in the application.
 * These types mirror the backend models and define the API contract.
 */

// Timeline types (state models)
export type {
  SporType,
  SporStatus,
  OverordnetStatus,
  GrunnlagTilstand,
  VederlagTilstand,
  FristTilstand,
  SakState,
  EventType,
  GrunnlagEventData,
  VederlagEventData,
  FristEventData,
  ResponsEventData,
  TimelineEntry,
} from './timeline';

// API types (requests and responses)
export type {
  StateResponse,
  EventSubmitResponse,
  TimelineResponse,
  EventSubmitRequest,
  ApiClientConfig,
} from './api';

export { ApiError } from './api';
