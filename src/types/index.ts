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

// Approval workflow types (mock)
export type {
  ApprovalRole,
  ApprovalStepStatus,
  ApprovalStep,
  ApprovalSporType,
  ApprovalRequestStatus,
  DraftResponseData,
  ApprovalThreshold,
  ApprovalState,
  BhResponsPakke,
} from './approval';

// File attachment types
export interface AttachmentFile {
  /** Unique identifier for the file */
  id: string;
  /** Original File object */
  file: File;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** Base64-encoded content (without data URI prefix) */
  base64?: string;
  /** Preview URL for images (object URL) */
  previewUrl?: string;
  /** Processing status */
  status: 'pending' | 'encoding' | 'ready' | 'error';
  /** Error message if status is 'error' */
  error?: string;
}
