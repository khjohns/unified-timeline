/**
 * API Client Types
 *
 * Type definitions for API requests and responses.
 * These types define the contract between frontend and backend.
 */

import { SakState, EventType, EventData, SporType, TimelineEvent } from './timeline';

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

/**
 * @deprecated Use TimelineEvent from timeline.ts (CloudEvents format) instead.
 * This interface is kept for backward compatibility during migration.
 */
export interface LegacyTimelineEvent {
  event_id: string;
  tidsstempel: string;
  type: string;
  event_type?: EventType;
  aktor: string;
  rolle: 'TE' | 'BH';
  spor: SporType | null;
  sammendrag: string;
  event_data?: EventData;
}

/**
 * Timeline API response.
 * Now uses CloudEvents v1.0 format (TimelineEvent from timeline.ts).
 */
export interface TimelineResponse {
  events: TimelineEvent[];
  version: number;
}

// ========== HISTORIKK (REVISION HISTORY) ==========

export interface AktorInfo {
  navn: string;
  rolle: 'TE' | 'BH';
  tidsstempel: string;
}

export type GrunnlagEndringType = 'opprettet' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert';
export type VederlagEndringType = 'sendt' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert';
export type FristEndringType = 'sendt' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert' | 'spesifisert';

export interface GrunnlagHistorikkEntry {
  versjon: number;
  tidsstempel: string;
  aktor: AktorInfo;
  endring_type: GrunnlagEndringType;
  event_id: string;

  // TE-krav felter (for opprettet/oppdatert/trukket)
  tittel?: string | null;
  hovedkategori?: string | null;
  underkategori?: string | string[] | null;
  beskrivelse?: string | null;
  dato_oppdaget?: string | null; // Kritisk for preklusjonsvurdering (§33.4)

  // BH-respons felter (for respons/respons_oppdatert)
  bh_resultat?: string | null;
  bh_resultat_label?: string | null;
  bh_begrunnelse?: string | null;
}

export interface VederlagHistorikkEntry {
  versjon: number;
  tidsstempel: string;
  aktor: AktorInfo;
  endring_type: VederlagEndringType;
  event_id: string;

  // TE-krav felter (for sendt/oppdatert/trukket)
  krav_belop?: number | null;
  metode?: string | null;
  metode_label?: string | null;
  begrunnelse?: string | null;
  inkluderer_rigg_drift?: boolean | null;
  inkluderer_produktivitet?: boolean | null;
  rigg_drift_belop?: number | null; // Særskilt krav §34.1.3
  produktivitet_belop?: number | null; // Særskilt krav §34.1.3

  // BH-respons felter (for respons/respons_oppdatert)
  bh_resultat?: string | null;
  bh_resultat_label?: string | null;
  godkjent_belop?: number | null; // Total (sum av alle komponenter)
  bh_begrunnelse?: string | null;
  hold_tilbake?: boolean | null; // §30.2 tilbakeholdelse

  // BH-respons: Oppdelt godkjent beløp
  hovedkrav_godkjent_belop?: number | null; // Hovedkrav godkjent
  rigg_godkjent_belop?: number | null; // Rigg/drift godkjent (§34.1.3)
  produktivitet_godkjent_belop?: number | null; // Produktivitet godkjent (§34.1.3)

  // Subsidiært standpunkt (inkluderer prekluderte krav)
  subsidiaer_resultat?: string | null;
  subsidiaer_godkjent_belop?: number | null; // Total subsidiært (inkl. prekluderte)
}

export interface FristHistorikkEntry {
  versjon: number;
  tidsstempel: string;
  aktor: AktorInfo;
  endring_type: FristEndringType;
  event_id: string;

  // TE-krav felter (for sendt/oppdatert/trukket)
  krav_dager?: number | null;
  varsel_type?: string | null;
  varsel_type_label?: string | null;
  begrunnelse?: string | null;
  ny_sluttdato?: string | null;
  frist_varsel_dato?: string | null; // §33.4 varseldato
  spesifisert_varsel_dato?: string | null; // §33.6 varseldato

  // BH-respons felter (for respons/respons_oppdatert)
  bh_resultat?: string | null;
  bh_resultat_label?: string | null;
  godkjent_dager?: number | null;
  bh_begrunnelse?: string | null;

  // Subsidiært standpunkt
  subsidiaer_resultat?: string | null;
  subsidiaer_godkjent_dager?: number | null;
}

export interface HistorikkResponse {
  version: number;
  grunnlag: GrunnlagHistorikkEntry[];
  vederlag: VederlagHistorikkEntry[];
  frist: FristHistorikkEntry[];
}

// ========== CASE LIST ==========

export interface CaseListItem {
  sak_id: string;
  sakstype: 'standard' | 'forsering' | 'endringsordre';
  cached_title: string | null;
  cached_status: string | null;
  created_at: string | null;
  created_by: string;
  last_event_at: string | null;
}

export interface CaseListResponse {
  cases: CaseListItem[];
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
