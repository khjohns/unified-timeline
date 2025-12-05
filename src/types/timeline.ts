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
  | 'kontrakt_ep'      // Kontraktens enhetspriser (§34.3.1)
  | 'justert_ep'       // Justerte enhetspriser (§34.3.2)
  | 'regning'          // Regningsarbeid (§30.1)
  | 'overslag'         // Regningsarbeid med prisoverslag (§30.2)
  | 'tilbud';          // Fastpris / Tilbud (§34.2.1)

// Vederlag beregning results (UTEN "avslatt_uenig_grunnlag" - det hører hjemme i Grunnlag!)
export type VederlagBeregningResultat =
  | 'godkjent_fullt'
  | 'delvis_godkjent'
  | 'godkjent_annen_metode'
  | 'avventer_spesifikasjon'
  | 'avslatt_totalt'        // Kun ved f.eks. dobbeltfakturering, ikke grunnlag
  | 'hold_tilbake'          // §30.2 - Holder tilbake betaling inntil overslag mottatt
  | 'avvist_preklusjon_rigg'; // §34.1.3 - Rigg/drift varslet for sent

// ========== FRIST ENUMS ==========

export type FristVarselType =
  | 'noytralt'        // §33.4 - Nøytralt varsel (uten dager)
  | 'spesifisert'     // §33.6 - Spesifisert krav (med dager)
  | 'begge'           // Først nøytralt, så spesifisert
  | 'force_majeure';  // §33.3 - Force majeure

// Frist beregning results (UTEN "avslatt_uenig_grunnlag" - det hører hjemme i Grunnlag!)
export type FristBeregningResultat =
  | 'godkjent_fullt'
  | 'delvis_godkjent'
  | 'avventer_spesifikasjon'
  | 'avslatt_ingen_hindring';  // BH mener det ikke medførte forsinkelse

// Grunnlag response result (BH's vurdering av ansvarsgrunnlaget)
export type GrunnlagResponsResultat =
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

  // Varsel info
  grunnlag_varsel?: {
    dato_sendt?: string;
    metode?: string[];
  };

  kontraktsreferanser: string[];
  bh_resultat?: GrunnlagResponsResultat;
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
  rigg_drift_belop?: number;
  produktivitetstap_belop?: number;

  // TE's varselinfo (Port 1) - NEW: Using VarselInfo structure
  rigg_drift_varsel?: VarselInfo;
  justert_ep_varsel?: VarselInfo;
  regningsarbeid_varsel?: VarselInfo;
  produktivitetstap_varsel?: VarselInfo;
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
  noytralt_varsel?: VarselInfo;  // NEW: Structured info
  spesifisert_varsel?: VarselInfo;  // NEW: Structured info
  krevd_dager?: number;
  frist_type?: 'kalenderdager' | 'arbeidsdager';
  begrunnelse?: string;
  pavirker_kritisk_linje?: boolean;
  milepael_pavirket?: string;
  fremdriftsanalyse_vedlagt?: boolean;
  berorte_aktiviteter?: string;  // Critical path activities

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

  // Forsering (§33.8)
  forsering?: ForseringTilstand;

  // Computed
  differanse_dager?: number;

  // Metadata
  siste_oppdatert?: string;
  antall_versjoner: number;
}

// Forsering state (§33.8)
export interface ForseringTilstand {
  er_varslet: boolean;
  dato_varslet?: string;
  estimert_kostnad?: number;
  begrunnelse?: string;
  bekreft_30_prosent_regel?: boolean;  // TE bekrefter at kostnad < dagmulkt + 30%
  er_iverksatt: boolean;
  dato_iverksatt?: string;
  er_stoppet: boolean;               // True if BH godkjenner frist etter varsling
  dato_stoppet?: string;
  paalopte_kostnader?: number;       // Costs incurred before stop
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
  | 'respons_grunnlag_oppdatert'   // BH's "snuoperasjon" - endrer standpunkt
  | 'respons_vederlag'
  | 'respons_vederlag_oppdatert'   // BH opphever tilbakeholdelse eller endrer standpunkt
  | 'respons_frist'
  | 'respons_frist_oppdatert'      // BH endrer standpunkt, evt stopper forsering
  | 'forsering_varsel'             // §33.8 - TE varsler om iverksettelse av forsering
  | 'eo_utstedt';

// Varsel info structure (reusable)
export interface VarselInfo {
  dato_sendt?: string;
  metode?: string[];
}

export interface GrunnlagEventData {
  hovedkategori: string; // Code from HOVEDKATEGORI_OPTIONS (e.g., "endring_initiert_bh")
  underkategori: string | string[]; // Code(s) from UNDERKATEGORI_MAP
  beskrivelse: string;
  dato_oppdaget: string;
  grunnlag_varsel?: VarselInfo; // NEW: Structured varsel info
  kontraktsreferanser?: string[];
  vedlegg_ids?: string[];
}

export interface VederlagEventData {
  krav_belop: number;
  metode: VederlagsMetode;
  begrunnelse: string;
  vedlegg_ids?: string[];

  // Port 1: Spesifikke varsler (NEW: Using VarselInfo structure)
  inkluderer_rigg_drift?: boolean;
  rigg_drift_belop?: number;
  rigg_drift_varsel?: VarselInfo;

  krever_justert_ep?: boolean;
  justert_ep_varsel?: VarselInfo;

  krever_regningsarbeid?: boolean;
  regningsarbeid_varsel?: VarselInfo;

  inkluderer_produktivitetstap?: boolean;
  produktivitetstap_belop?: number;
  produktivitetstap_varsel?: VarselInfo;

  krav_fremmet_dato?: string;
}

export interface FristEventData {
  // Port 1: Varseltype
  varsel_type: FristVarselType;
  noytralt_varsel?: VarselInfo;  // NEW: Structured info (dato + metode)
  spesifisert_varsel?: VarselInfo;  // NEW: Structured info (dato + metode)

  // Kravet (kun relevant ved spesifisert)
  antall_dager?: number;
  begrunnelse: string;

  // Fremdriftsinfo (Port 2)
  fremdriftshindring_dokumentasjon?: string;
  ny_sluttdato?: string;
  vedlegg_ids?: string[];
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

// Grunnlag response event
export interface ResponsGrunnlagEventData {
  resultat: GrunnlagResponsResultat;
  begrunnelse: string;
  akseptert_kategori?: string;
  krever_dokumentasjon?: string[];
  varsel_for_sent?: boolean;
  varsel_begrunnelse?: string;
}

// ========== UPDATE EVENT PAYLOADS (for revisions/updates) ==========

// Grunnlag update event (TE updates previously sent grunnlag)
export interface GrunnlagOppdatertEventData {
  original_event_id: string;
  tittel?: string;
  beskrivelse?: string;
  dato_oppdaget?: string;
  hovedkategori?: string;
  underkategori?: string | string[];
  endrings_begrunnelse: string;
}

// Grunnlag response update event (BH's "snuoperasjon")
export interface ResponsGrunnlagOppdatertEventData {
  original_respons_id: string;
  nytt_resultat: GrunnlagResponsResultat;
  begrunnelse: string;
  dato_endret: string;
}

// Vederlag update event (TE revises claim amount)
export interface VederlagOppdatertEventData {
  original_event_id: string;
  nytt_belop?: number;
  nytt_overslag?: number;  // For regningsarbeid
  begrunnelse: string;
  dato_revidert: string;
}

// Vederlag response update event (BH opphever tilbakeholdelse etc)
export interface ResponsVederlagOppdatertEventData {
  original_respons_id: string;
  nytt_resultat: VederlagBeregningResultat;
  kommentar: string;
  dato_endret: string;
}

// Frist update event (TE revises days claim)
export interface FristOppdatertEventData {
  original_event_id: string;
  nytt_antall_dager?: number;
  begrunnelse: string;
  dato_revidert: string;
}

// Frist response update event (BH changes mind, stops forsering)
export interface ResponsFristOppdatertEventData {
  original_respons_id: string;
  nytt_resultat: FristBeregningResultat;
  ny_godkjent_dager?: number;
  kommentar: string;
  stopper_forsering?: boolean;
  dato_endret: string;
}

// Forsering varsel event (§33.8 - TE varsler om forsering)
export interface ForseringVarselEventData {
  frist_krav_id: string;  // Reference to the rejected frist claim
  estimert_kostnad: number;
  begrunnelse: string;
  bekreft_30_prosent: boolean;  // TE confirms cost < dagmulkt + 30%
  dato_iverksettelse: string;
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
