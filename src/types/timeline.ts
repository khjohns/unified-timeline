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
  | 'ENHETSPRISER'      // Enhetspriser (§34.3) - kontrakts- eller justerte
  | 'REGNINGSARBEID'    // Regningsarbeid med kostnadsoverslag (§30.2/§34.4)
  | 'FASTPRIS_TILBUD';  // Fastpris / Tilbud (§34.2.1)

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
  | 'erkjenn_fm'       // §33.3 - BH erkjenner Force Majeure (kun frist, ikke vederlag)
  | 'avvist_uenig'
  | 'avvist_for_sent'
  | 'frafalt'          // §32.3 c - BH frafaller pålegget (kun irregulær endring)
  | 'krever_avklaring';

// Årsaker til at subsidiær vurdering er relevant (NS 8407)
export type SubsidiaerTrigger =
  | 'grunnlag_avvist'          // Nivå 0: BH avviste ansvarsgrunnlaget
  | 'preklusjon_rigg'          // Nivå 1: Rigg/drift varslet for sent (§34.1.3)
  | 'preklusjon_produktivitet' // Nivå 1: Produktivitet varslet for sent (§34.1.3)
  | 'preklusjon_ep_justering'  // Nivå 1: EP-justering varslet for sent (§34.3.3)
  | 'preklusjon_noytralt'      // Nivå 1: Nøytralt varsel for sent (§33.4)
  | 'preklusjon_spesifisert'   // Nivå 1: Spesifisert krav for sent (§33.6)
  | 'ingen_hindring'           // Nivå 2: Ingen reell fremdriftshindring (§33.5)
  | 'metode_avvist';           // Nivå 2: BH aksepterer ikke foreslått metode

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
  tittel?: string;                   // Kort beskrivende tittel for varselet
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

  // TE's krav - hovedbeløp
  metode?: VederlagsMetode;
  belop_direkte?: number;        // For ENHETSPRISER/FASTPRIS_TILBUD (kan være negativt = fradrag)
  kostnads_overslag?: number;    // For REGNINGSARBEID (§30.2)
  krever_justert_ep?: boolean;   // For ENHETSPRISER - krever justerte EP
  begrunnelse?: string;

  // Særskilte krav (§34.1.3) - separate frister per kostnadstype
  // Per standarden: TE kan bli klar over rigg/drift og produktivitetstap på ulike tidspunkt
  saerskilt_krav?: {
    rigg_drift?: SaerskiltKravItem;      // §34.1.3 første ledd
    produktivitet?: SaerskiltKravItem;   // §34.1.3 annet ledd
  };

  // TE's varselinfo (Port 1) - Using VarselInfo structure
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
  /** Which version of the claim BH last responded to (0-indexed: 0 = original, 1 = rev 1, etc.) */
  bh_respondert_versjon?: number;

  // Subsidiært standpunkt (når BH tar prinsipalt avslag men subsidiært godkjenner)
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: VederlagBeregningResultat;
  subsidiaer_godkjent_belop?: number;
  subsidiaer_begrunnelse?: string;

  // Computed
  differanse?: number;
  godkjenningsgrad_prosent?: number;
  har_subsidiaert_standpunkt?: boolean;
  visningsstatus?: string;

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

  // Subsidiært standpunkt (når BH tar prinsipalt avslag men subsidiært godkjenner)
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: FristBeregningResultat;
  subsidiaer_godkjent_dager?: number;
  subsidiaer_begrunnelse?: string;

  // Forsering (§33.8)
  forsering?: ForseringTilstand;

  // Computed
  differanse_dager?: number;
  har_subsidiaert_standpunkt?: boolean;
  visningsstatus?: string;

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

// Særskilt krav item (§34.1.3) - separate beløp og datoer per type
export interface SaerskiltKravItem {
  belop?: number;
  dato_klar_over?: string;  // Når TE ble klar over at utgifter ville påløpe
}

export interface GrunnlagEventData {
  tittel: string;                    // Kort beskrivende tittel for varselet
  hovedkategori: string;             // Code from HOVEDKATEGORI_OPTIONS (e.g., "ENDRING")
  underkategori: string | string[];  // Code(s) from UNDERKATEGORI_MAP
  beskrivelse: string;
  dato_oppdaget: string;
  grunnlag_varsel?: VarselInfo;      // Structured varsel info
  kontraktsreferanser?: string[];
  vedlegg_ids?: string[];
}

export interface VederlagEventData {
  metode: VederlagsMetode;
  begrunnelse: string;
  vedlegg_ids?: string[];

  // Beløp - avhenger av metode
  belop_direkte?: number;        // For ENHETSPRISER/FASTPRIS_TILBUD (kan være negativt = fradrag)
  kostnads_overslag?: number;    // For REGNINGSARBEID (§30.2)

  // For ENHETSPRISER
  krever_justert_ep?: boolean;

  // Særskilte krav (§34.1.3) - separate frister per kostnadstype
  saerskilt_krav?: {
    rigg_drift?: SaerskiltKravItem;      // §34.1.3 første ledd
    produktivitet?: SaerskiltKravItem;   // §34.1.3 annet ledd
  };

  // Varsler (VarselInfo structure)
  rigg_drift_varsel?: VarselInfo;
  justert_ep_varsel?: VarselInfo;
  regningsarbeid_varsel?: VarselInfo;
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

  // Subsidiært standpunkt (når BH tar prinsipalt avslag men subsidiært godkjenner)
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: VederlagBeregningResultat;
  subsidiaer_godkjent_belop?: number;
  subsidiaer_begrunnelse?: string;
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

  // Subsidiært standpunkt (når BH tar prinsipalt avslag men subsidiært godkjenner)
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: FristBeregningResultat;
  subsidiaer_godkjent_dager?: number;
  subsidiaer_begrunnelse?: string;
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
  nytt_belop_direkte?: number;      // For ENHETSPRISER/FASTPRIS_TILBUD
  nytt_kostnads_overslag?: number;  // For REGNINGSARBEID (§30.2)
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

// Union type for all possible event data
export type EventData =
  | GrunnlagEventData
  | GrunnlagOppdatertEventData
  | VederlagEventData
  | VederlagOppdatertEventData
  | FristEventData
  | FristOppdatertEventData
  | ResponsGrunnlagEventData
  | ResponsGrunnlagOppdatertEventData
  | ResponsVederlagEventData
  | ResponsVederlagOppdatertEventData
  | ResponsFristEventData
  | ResponsFristOppdatertEventData
  | ForseringVarselEventData;

export interface TimelineEntry {
  event_id: string;
  tidsstempel: string;
  type: string;
  event_type?: EventType;  // Machine-readable event type
  aktor: string;
  rolle: 'TE' | 'BH';
  spor: SporType | null;
  sammendrag: string;
  event_data?: EventData;  // Full submitted form data
}
