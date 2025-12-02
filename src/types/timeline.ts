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

// Vederlag response results (includes "godkjent med annen metode")
export type VederlagResponsResultat =
  | 'godkjent_fullt'
  | 'delvis_godkjent'
  | 'avslatt_uenig_grunnlag'
  | 'avslatt_for_sent'
  | 'avventer_spesifikasjon'
  | 'godkjent_annen_metode';

// Frist response results (includes "delvis godkjent bestrider beregning")
export type FristResponsResultat =
  | 'godkjent_fullt'
  | 'delvis_godkjent_bestrider_beregning'
  | 'avslatt_uenig_grunnlag'
  | 'avslatt_for_sent'
  | 'avventer_spesifikasjon';

// Generic response result (for backward compatibility)
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
  underkategori?: string | string[]; // Support both single and multiple underkategorier
  beskrivelse?: string;
  dato_oppdaget?: string;
  dato_varsel_sendt?: string; // NEW: Separate date for when warning was sent
  varsel_metode?: string[]; // NEW: Methods used to notify (e.g., ["epost", "byggemote"])
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
  metode?: string; // Uses codes from VEDERLAGSMETODER_OPTIONS
  begrunnelse?: string;
  inkluderer_produktivitetstap?: boolean;
  inkluderer_rigg_drift?: boolean;
  saerskilt_varsel_rigg_drift?: boolean; // NEW: Separate notification for rigg/drift
  bh_resultat?: VederlagResponsResultat; // Use specific vederlag response type
  bh_begrunnelse?: string;
  bh_metode?: string; // NEW: If BH approves with different method
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
  pavirker_kritisk_linje?: boolean; // NEW: Whether this affects critical path
  bh_resultat?: FristResponsResultat; // Use specific frist response type
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
  hovedkategori: string; // Code from HOVEDKATEGORI_OPTIONS (e.g., "endring_initiert_bh")
  underkategori: string | string[]; // Code(s) from UNDERKATEGORI_MAP
  beskrivelse: string;
  dato_oppdaget: string;
  dato_varsel_sendt?: string; // NEW: When the warning was actually sent
  varsel_metode?: string[]; // NEW: Methods used (e.g., ["epost", "byggemote"])
  kontraktsreferanser?: string[];
  vedlegg_ids?: string[];
}

export interface VederlagEventData {
  krav_belop: number;
  metode: string; // Code from VEDERLAGSMETODER_OPTIONS (e.g., "entreprenorens_tilbud")
  begrunnelse: string;
  inkluderer_produktivitetstap?: boolean;
  inkluderer_rigg_drift?: boolean;
  saerskilt_varsel_rigg_drift?: boolean; // NEW: From legacy
}

export interface FristEventData {
  antall_dager: number;
  frist_type: 'kalenderdager' | 'arbeidsdager';
  begrunnelse: string;
  pavirker_kritisk_linje?: boolean;
}

// Vederlag response event
export interface ResponsVederlagEventData {
  resultat: VederlagResponsResultat; // Use specific vederlag response type
  begrunnelse: string;
  godkjent_belop?: number;
  godkjent_metode?: string; // NEW: If approved with different method
}

// Frist response event
export interface ResponsFristEventData {
  resultat: FristResponsResultat; // Use specific frist response type
  begrunnelse: string;
  godkjent_dager?: number;
}

// Generic response event (for backward compatibility)
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
