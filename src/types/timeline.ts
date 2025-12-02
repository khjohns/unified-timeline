/**
 * Unified Timeline Types
 *
 * These types mirror the backend models exactly.
 * State is READ-ONLY - all mutations happen via events.
 */

// ========== ENUMS ==========

export type SporType = 'grunnlag' | 'vederlag' | 'frist';

export type SporStatus =
  | 'ikke_relevant'
  | 'utkast'
  | 'sendt'
  | 'under_behandling'
  | 'godkjent'
  | 'delvis_godkjent'
  | 'avvist'
  | 'under_forhandling'
  | 'trukket'
  | 'laast';

export type ResponsResultat =
  | 'godkjent'
  | 'delvis_godkjent'
  | 'avvist_uenig'
  | 'avvist_for_sent'
  | 'krever_avklaring';

export type OverordnetStatus =
  | 'UTKAST'
  | 'SENDT'
  | 'VENTER_PAA_SVAR'
  | 'UNDER_BEHANDLING'
  | 'UNDER_FORHANDLING'
  | 'OMFORENT'
  | 'LUKKET'
  | 'LUKKET_TRUKKET';

// ========== TRACK STATES (Read-Only) ==========

export interface GrunnlagTilstand {
  status: SporStatus;
  hovedkategori?: string;
  underkategori?: string;
  beskrivelse?: string;
  dato_oppdaget?: string;
  kontraktsreferanser: string[];
  bh_resultat?: ResponsResultat;
  bh_begrunnelse?: string;
  laast: boolean;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

export interface VederlagTilstand {
  status: SporStatus;
  krevd_belop?: number;
  metode?: string;
  begrunnelse?: string;
  bh_resultat?: ResponsResultat;
  bh_begrunnelse?: string;
  godkjent_belop?: number;
  differanse?: number;
  godkjenningsgrad_prosent?: number;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

export interface FristTilstand {
  status: SporStatus;
  krevd_dager?: number;
  frist_type?: 'kalenderdager' | 'arbeidsdager';
  begrunnelse?: string;
  bh_resultat?: ResponsResultat;
  bh_begrunnelse?: string;
  godkjent_dager?: number;
  differanse_dager?: number;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

// ========== MAIN STATE (Read-Only) ==========

export interface SakState {
  sak_id: string;
  sakstittel: string;

  // The three tracks
  grunnlag: GrunnlagTilstand;
  vederlag: VederlagTilstand;
  frist: FristTilstand;

  // Computed
  overordnet_status: OverordnetStatus;
  kan_utstede_eo: boolean;
  neste_handling: {
    rolle: 'TE' | 'BH' | null;
    handling: string;
    spor: SporType | null;
  };

  // Aggregates
  sum_krevd: number;
  sum_godkjent: number;

  // Metadata
  opprettet?: string;
  siste_aktivitet?: string;
  antall_events: number;
}

// ========== EVENT PAYLOADS (for submission) ==========

export type EventType =
  | 'sak_opprettet'
  | 'grunnlag_opprettet'
  | 'grunnlag_oppdatert'
  | 'grunnlag_trukket'
  | 'vederlag_krav_sendt'
  | 'vederlag_krav_oppdatert'
  | 'vederlag_krav_trukket'
  | 'frist_krav_sendt'
  | 'frist_krav_oppdatert'
  | 'frist_krav_trukket'
  | 'respons_grunnlag'
  | 'respons_vederlag'
  | 'respons_frist'
  | 'eo_utstedt';

export interface GrunnlagEventData {
  hovedkategori: string;
  underkategori: string;
  beskrivelse: string;
  dato_oppdaget: string;
  kontraktsreferanser?: string[];
  vedlegg_ids?: string[];
}

export interface VederlagEventData {
  krav_belop: number;
  metode: string;
  begrunnelse: string;
  inkluderer_produktivitetstap?: boolean;
  inkluderer_rigg_drift?: boolean;
}

export interface FristEventData {
  antall_dager: number;
  frist_type: 'kalenderdager' | 'arbeidsdager';
  begrunnelse: string;
  pavirker_kritisk_linje?: boolean;
}

export interface ResponsEventData {
  resultat: ResponsResultat;
  begrunnelse: string;
  godkjent_belop?: number;
  godkjent_dager?: number;
}

// ========== TIMELINE DISPLAY ==========

export interface TimelineEntry {
  event_id: string;
  tidsstempel: string;
  type: string;
  aktor: string;
  rolle: 'TE' | 'BH';
  spor: SporType | null;
  sammendrag: string;
}
