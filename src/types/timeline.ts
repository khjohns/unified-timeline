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

// ========== VEDERLAG ENUMS ==========

export type VederlagsMetode =
  | 'kontrakt_ep'      // Kontraktens enhetspriser
  | 'justert_ep'       // Justerte enhetspriser
  | 'regning'          // Regningsarbeid
  | 'tilbud'           // Fastpris / Tilbud
  | 'skjonn';          // Skjønnsmessig vurdering

// Vederlag beregning results (UTEN "avslatt_uenig_grunnlag" - det hører hjemme i Grunnlag!)
export type VederlagBeregningResultat =
  | 'godkjent_fullt'
  | 'delvis_godkjent'
  | 'godkjent_annen_metode'
  | 'avventer_spesifikasjon'
  | 'avslatt_totalt';  // Kun ved f.eks. dobbeltfakturering, ikke grunnlag

// ========== FRIST ENUMS ==========

export type FristVarselType =
  | 'noytralt'      // §33.4 - Nøytralt varsel (uten dager)
  | 'spesifisert'   // §33.6 - Spesifisert krav (med dager)
  | 'begge';        // Først nøytralt, så spesifisert

// Frist beregning results (UTEN "avslatt_uenig_grunnlag" - det hører hjemme i Grunnlag!)
export type FristBeregningResultat =
  | 'godkjent_fullt'
  | 'delvis_godkjent'
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

  // TE's krav
  krevd_belop?: number;
  metode?: VederlagsMetode;
  begrunnelse?: string;
  inkluderer_produktivitetstap?: boolean;
  inkluderer_rigg_drift?: boolean;

  // TE's varselinfo (Port 1)
  saerskilt_varsel_rigg_drift_dato?: string;
  varsel_justert_ep_dato?: string;
  varsel_start_regning_dato?: string;
  krav_fremmet_dato?: string;

  // BH respons - Port 1 (Varsling)
  saerskilt_varsel_rigg_drift_ok?: boolean;
  varsel_justert_ep_ok?: boolean;
  varsel_start_regning_ok?: boolean;
  krav_fremmet_i_tide?: boolean;
  begrunnelse_varsel?: string;

  // BH respons - Port 2 (Beregning)
  bh_resultat?: VederlagBeregningResultat;
  bh_begrunnelse?: string;
  bh_metode?: VederlagsMetode;
  godkjent_belop?: number;

  // Computed
  differanse?: number;
  godkjenningsgrad_prosent?: number;

  // Metadata
  siste_oppdatert?: string;
  antall_versjoner: number;
}

export interface FristTilstand {
  status: SporStatus;

  // TE's krav
  varsel_type?: FristVarselType;
  noytralt_varsel_dato?: string;
  spesifisert_krav_dato?: string;
  krevd_dager?: number;
  frist_type?: 'kalenderdager' | 'arbeidsdager';
  begrunnelse?: string;
  pavirker_kritisk_linje?: boolean;
  milepael_pavirket?: string;
  fremdriftsanalyse_vedlagt?: boolean;

  // BH respons - Port 1 (Varsling)
  noytralt_varsel_ok?: boolean;
  spesifisert_krav_ok?: boolean;
  har_bh_etterlyst?: boolean;
  begrunnelse_varsel?: string;

  // BH respons - Port 2 (Vilkår/Årsakssammenheng)
  vilkar_oppfylt?: boolean;
  begrunnelse_vilkar?: string;

  // BH respons - Port 3 (Beregning)
  bh_resultat?: FristBeregningResultat;
  bh_begrunnelse?: string;
  godkjent_dager?: number;
  ny_sluttdato?: string;
  begrunnelse_beregning?: string;
  frist_for_spesifisering?: string;

  // Computed
  differanse_dager?: number;

  // Metadata
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

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: boolean;
  er_subsidiaert_frist: boolean;
  visningsstatus_vederlag: string;
  visningsstatus_frist: string;

  // Computed - Overordnet
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
  metode: VederlagsMetode;
  begrunnelse: string;
  spesifikasjon?: Record<string, any>;

  // Port 1: Spesifikke varsler
  inkluderer_rigg_drift?: boolean;
  saerskilt_varsel_rigg_drift_dato?: string;
  rigg_drift_belop?: number;
  krever_justert_ep?: boolean;
  varsel_justert_ep_dato?: string;
  krever_regningsarbeid?: boolean;
  varsel_start_regning_dato?: string;
  krav_fremmet_dato?: string;

  inkluderer_produktivitetstap?: boolean;
}

export interface FristEventData {
  // Port 1: Varseltype
  varsel_type: FristVarselType;
  noytralt_varsel_dato?: string;
  spesifisert_krav_dato?: string;

  // Kravet (kun relevant ved spesifisert)
  antall_dager?: number;
  frist_type?: 'kalenderdager' | 'arbeidsdager';
  begrunnelse: string;

  // Fremdriftsinfo (Port 2)
  pavirker_kritisk_linje?: boolean;
  milepael_pavirket?: string;
  fremdriftsanalyse_vedlagt?: boolean;
  ny_sluttdato?: string;
}

// Vederlag response event (Port Model)
export interface ResponsVederlagEventData {
  // Port 1: Spesifikke varsler
  saerskilt_varsel_rigg_drift_ok?: boolean;
  varsel_justert_ep_ok?: boolean;
  varsel_start_regning_ok?: boolean;
  krav_fremmet_i_tide?: boolean;
  begrunnelse_varsel?: string;

  // Port 2: Beregning & Metode
  vederlagsmetode?: VederlagsMetode;
  beregnings_resultat: VederlagBeregningResultat;
  godkjent_belop?: number;
  begrunnelse_beregning?: string;
  frist_for_spesifikasjon?: string;
}

// Frist response event (Port Model)
export interface ResponsFristEventData {
  // Port 1: Preklusjon (Varsling)
  noytralt_varsel_ok?: boolean;
  spesifisert_krav_ok?: boolean;
  har_bh_etterlyst?: boolean;
  begrunnelse_varsel?: string;

  // Port 2: Vilkår (Årsakssammenheng)
  vilkar_oppfylt?: boolean;
  begrunnelse_vilkar?: string;

  // Port 3: Utmåling (Beregning)
  beregnings_resultat: FristBeregningResultat;
  godkjent_dager?: number;
  ny_sluttdato?: string;
  begrunnelse_beregning?: string;
  frist_for_spesifisering?: string;
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
