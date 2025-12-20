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
  VarselInfo,
  SaerskiltKravItem,
  GrunnlagEventData,
  VederlagEventData,
  FristEventData,
  GrunnlagResponsResultat,
  VederlagBeregningResultat,
  FristBeregningResultat,
  VederlagsMetode,
  FristVarselType,
  ForseringTilstand,
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
