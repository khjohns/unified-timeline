/**
 * Unified Timeline Types
 *
 * These types mirror the backend models exactly.
 * State is READ-ONLY - all mutations happen via events.
 *
 * TERMINOLOGI - Versjon vs Revisjon:
 * - `versjon`: Tellende nummer for innsendinger (1, 2, 3...).
 *   Versjon 1 er original, versjon 2 er første oppdatering.
 * - `revisjon`: UI-visning for oppdateringer. Revisjon = versjon - 1.
 *   Original har ingen revisjon, første oppdatering er "Rev. 1".
 * - `respondert_versjon`: 0-indeksert referanse til TE-versjon.
 *   respondert_versjon=0 betyr respons på versjon 1 (original).
 * - `bh_respondert_versjon`: Samme som respondert_versjon, i state.
 * - `antall_versjoner`: Totalt antall versjoner sendt (1-indeksert).
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
  | 'avslatt'
  | 'under_forhandling'
  | 'trukket'
  | 'laast';

// ========== VEDERLAG ENUMS ==========

export type VederlagsMetode =
  | 'ENHETSPRISER'      // Enhetspriser (§34.3) - kontrakts- eller justerte
  | 'REGNINGSARBEID'    // Regningsarbeid med kostnadsoverslag (§30.2/§34.4)
  | 'FASTPRIS_TILBUD';  // Fastpris / Tilbud (§34.2.1)

/**
 * Felles base-modell for vederlagskompensasjon.
 *
 * Brukes av både VederlagData (TEs krav) og EOUtstedtData (BHs formelle EO).
 * Følger NS 8407 §34 for vederlagsjustering.
 *
 * Beløpsstrukturen avhenger av metode:
 * - ENHETSPRISER / FASTPRIS_TILBUD: belop_direkte
 * - REGNINGSARBEID: kostnads_overslag (alltid >= 0)
 *
 * Fradrag (§34.4): "For fradrag skal det gjøres en reduksjon i vederlaget som
 * tilsvarer den besparelsen fradraget har ført til."
 */
export interface VederlagKompensasjon {
  metode: VederlagsMetode;
  belop_direkte?: number;      // For ENHETSPRISER/FASTPRIS_TILBUD
  kostnads_overslag?: number;  // For REGNINGSARBEID (§30.2)
  fradrag_belop?: number;      // Fradrag (§34.4)
  er_estimat?: boolean;        // Om beløpet er et estimat
  // Computed (fra backend)
  netto_belop?: number;        // brutto - fradrag
  krevd_belop?: number;        // alias for netto_belop
}

// Vederlag beregning results - forenklet til tre hovedkategorier
// Årsaken til avslag fanges av `subsidiaer_triggers`
// NB: 'avventer' er fjernet - BH må enten avslå eller delvis godkjenne med forklaring
export type VederlagBeregningResultat =
  | 'godkjent'              // BH aksepterer kravet (sum og metode)
  | 'delvis_godkjent'       // BH aksepterer deler (uenighet om beløp/metode)
  | 'avslatt'               // BH avviser kravet
  | 'hold_tilbake';         // §30.2 tilbakeholdelse (kun ved manglende overslag)

// ========== FRIST ENUMS ==========

export type FristVarselType =
  | 'varsel'             // §33.4 - Varsel om fristforlengelse (uten dager)
  | 'spesifisert'        // §33.6 - Spesifisert krav (med dager)
  | 'begrunnelse_utsatt'; // §33.6.2 b - Begrunnelse for hvorfor beregning ikke er mulig

// Frist beregning results - forenklet til tre hovedkategorier
// Årsaken til avslag fanges av `subsidiaer_triggers`
// NB: 'avventer' er fjernet - BH må enten avslå eller delvis godkjenne med forklaring
export type FristBeregningResultat =
  | 'godkjent'              // BH aksepterer kravet (enighet om antall dager)
  | 'delvis_godkjent'       // BH aksepterer deler (uenighet om antall dager)
  | 'avslatt';              // BH avviser kravet

// Grunnlag response result (BH's vurdering av ansvarsgrunnlaget)
// Med ett ansvarsgrunnlag per sak er det binært: godkjent eller avslått
export type GrunnlagResponsResultat =
  | 'godkjent'
  | 'avslatt'          // BH avslår ansvarsgrunnlaget
  | 'frafalt';         // §32.3 c - BH frafaller pålegget (kun irregulær endring)

// Årsaker til at subsidiær vurdering er relevant (NS 8407)
export type SubsidiaerTrigger =
  | 'grunnlag_avslatt'         // Nivå 0: BH avslo ansvarsgrunnlaget
  | 'grunnlag_prekludert_32_2' // Nivå 0: Grunnlag varslet for sent (§32.2) - kun ENDRING
  | 'forseringsrett_avslatt'   // Nivå 0: TE har ikke forseringsrett (§33.8)
  | 'preklusjon_hovedkrav'     // Nivå 1: Hovedkrav varslet for sent (§34.1.2) - kun SVIKT/ANDRE
  | 'preklusjon_rigg'          // Nivå 1: Rigg/drift varslet for sent (§34.1.3)
  | 'preklusjon_produktivitet' // Nivå 1: Produktivitet varslet for sent (§34.1.3)
  | 'reduksjon_ep_justering'   // Nivå 1: EP-justering varslet for sent (§34.3.3) - begrenset til det BH "måtte forstå"
  | 'preklusjon_varsel'        // Nivå 1: Varsel om fristforlengelse for sent (§33.4)
  | 'reduksjon_spesifisert'    // Nivå 1: Spesifisert krav for sent (§33.6) - begrenset til det BH "måtte forstå"
  | 'ingen_hindring'           // Nivå 2: Ingen reell fremdriftshindring (§33.5)
  | 'metode_avslatt';          // Nivå 2: BH aksepterer ikke foreslått metode

export type OverordnetStatus =
  | 'UTKAST'
  | 'SENDT'
  | 'VENTER_PAA_SVAR'
  | 'UNDER_BEHANDLING'
  | 'UNDER_FORHANDLING'
  | 'OMFORENT'
  | 'LUKKET'
  | 'LUKKET_TRUKKET';

// ========== SAKSTYPE OG RELASJONER ==========

/**
 * Type sak.
 * - standard: Ordinær endringssak med grunnlag/vederlag/frist-spor
 * - forsering: § 33.8 forseringssak som refererer til avslåtte fristforlengelser
 * - endringsordre: Formell endringsordre (§31.3) som samler en eller flere KOE-er
 */
export type SaksType = 'standard' | 'forsering' | 'endringsordre';

/**
 * Relasjon til en annen sak.
 *
 * Merk: Catenda API lagrer kun related_topic_guid uten semantisk type.
 * Relasjonstype utledes fra sakstype i UI-laget:
 * - forsering sak → relaterte saker er "basert_paa" (avslåtte fristforlengelser)
 */
export interface SakRelasjon {
  relatert_sak_id: string;
  relatert_sak_tittel?: string;
  // Fra Catenda API response:
  bimsync_issue_board_ref?: string;  // Topic board ID for cross-board relasjoner
  bimsync_issue_number?: number;     // Lesbart saksnummer i Catenda
}

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

  bh_resultat?: GrunnlagResponsResultat;
  bh_begrunnelse?: string;
  /** §32.2: Har BH påberopt at grunnlagsvarselet kom for sent? (kun ENDRING) */
  grunnlag_varslet_i_tide?: boolean;
  laast: boolean;
  /** Which version of the claim BH last responded to (0-indexed: 0 = original, 1 = rev 1, etc.) */
  bh_respondert_versjon?: number;

  /** True hvis entreprenør har akseptert byggherrens respons (partene er enige) */
  te_akseptert?: boolean;

  // Tilbaketrekking
  /** Begrunnelse for tilbaketrekking av grunnlag */
  trukket_begrunnelse?: string;
  /** True hvis grunnlag ble trukket som følge av at alle krav (vederlag+frist) ble trukket */
  trukket_alle_krav?: boolean;

  /** CloudEvents ID of the last event that modified this track */
  siste_event_id?: string;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

export interface VederlagTilstand {
  status: SporStatus;

  // TE's krav - hovedbeløp (følger VederlagKompensasjon struktur)
  metode?: VederlagsMetode;
  belop_direkte?: number;        // For ENHETSPRISER/FASTPRIS_TILBUD
  kostnads_overslag?: number;    // For REGNINGSARBEID (§30.2)
  fradrag_belop?: number;        // Fradrag (§34.4) - reduksjon for besparelser
  er_estimat?: boolean;          // Om beløpet er et estimat
  krever_justert_ep?: boolean;   // For ENHETSPRISER - krever justerte EP
  begrunnelse?: string;

  // Computed beløp (fra backend)
  netto_belop?: number;          // brutto - fradrag
  krevd_belop?: number;          // alias for netto_belop

  // Særskilte krav (§34.1.3) - separate frister per kostnadstype
  // Per standarden: TE kan bli klar over rigg/drift og produktivitetstap på ulike tidspunkt
  saerskilt_krav?: {
    rigg_drift?: SaerskiltKravItem;      // §34.1.3 første ledd
    produktivitet?: SaerskiltKravItem;   // §34.1.3 annet ledd
  };

  // TE's varselinfo (Port 1) - Using VarselInfo structure
  rigg_drift_varsel?: VarselInfo;
  justert_ep_varsel?: VarselInfo;
  /** Ble BH varslet før regningsarbeidet startet? (§34.4) */
  varslet_for_oppstart?: boolean;
  produktivitetstap_varsel?: VarselInfo;

  // BH respons - Port 1 (Varsling)
  varsel_justert_ep_ok?: boolean;
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

  /** True hvis entreprenør har akseptert byggherrens respons (partene er enige) */
  te_akseptert?: boolean;

  // Tilbaketrekking
  /** Begrunnelse for tilbaketrekking av vederlagskrav */
  trukket_begrunnelse?: string;
  /** True hvis vederlag ble trukket som følge av at grunnlag ble trukket */
  trukket_via_grunnlag?: boolean;

  // Metadata
  /** CloudEvents ID of the last event that modified this track */
  siste_event_id?: string;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

export interface FristTilstand {
  status: SporStatus;

  // TE's krav
  varsel_type?: FristVarselType;
  /** Varsel om fristforlengelse (§33.4) */
  frist_varsel?: VarselInfo;
  spesifisert_varsel?: VarselInfo;
  krevd_dager?: number;
  begrunnelse?: string;

  // BH respons - Port 1 (Varsling)
  /** Var varsel om fristforlengelse (§33.4) rettidig? */
  frist_varsel_ok?: boolean;
  spesifisert_krav_ok?: boolean;
  /** §33.6.2/§5: Var svar på forespørsel rettidig? */
  foresporsel_svar_ok?: boolean;
  /** Har BH sendt forespørsel om spesifisering (§33.6.2)? */
  har_bh_foresporsel?: boolean;
  /** Dato BH sendte forespørsel om spesifisering (§33.6.2) - YYYY-MM-DD */
  dato_bh_foresporsel?: string;
  begrunnelse_varsel?: string;

  // BH respons - Port 2 (Vilkår/Årsakssammenheng)
  vilkar_oppfylt?: boolean;

  // BH respons - Port 3 (Beregning)
  bh_resultat?: FristBeregningResultat;
  bh_begrunnelse?: string;
  godkjent_dager?: number;
  ny_sluttdato?: string;
  frist_for_spesifisering?: string;

  // Subsidiært standpunkt (når BH tar prinsipalt avslag men subsidiært godkjenner)
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: FristBeregningResultat;
  subsidiaer_godkjent_dager?: number;
  subsidiaer_begrunnelse?: string;

  // Computed
  differanse_dager?: number;
  har_subsidiaert_standpunkt?: boolean;
  visningsstatus?: string;

  /** Which version of the claim BH last responded to (0-indexed: 0 = original, 1 = rev 1, etc.) */
  bh_respondert_versjon?: number;

  /** True hvis entreprenør har akseptert byggherrens respons (partene er enige) */
  te_akseptert?: boolean;

  // Tilbaketrekking
  /** Begrunnelse for tilbaketrekking av fristkrav */
  trukket_begrunnelse?: string;
  /** True hvis frist ble trukket som følge av at grunnlag ble trukket */
  trukket_via_grunnlag?: boolean;

  // Metadata
  /** CloudEvents ID of the last event that modified this track */
  siste_event_id?: string;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

/**
 * Vederlagsstruktur for forsering (§33.8 + §34.1.3).
 *
 * Forsering er et pengekrav som følger vederlagsreglene i §34.
 * Per §34.4 brukes typisk regningsarbeid når ingen enhetspriser finnes.
 */
export interface ForseringVederlag {
  // Metode (§34.4 - typisk regningsarbeid for forsering)
  metode: string;  // Default "REGNINGSARBEID"

  // Særskilte krav (§34.1.3)
  saerskilt_krav?: {
    rigg_drift?: { belop: number; dato_klar_over?: string };
    produktivitet?: { belop: number; dato_klar_over?: string };
  };

  // Varselinfo for særskilte krav
  rigg_drift_varsel?: VarselInfo;
  produktivitet_varsel?: VarselInfo;
}

/** Per-sak vurdering av om avslaget var berettiget */
export interface ForseringsrettVurdering {
  sak_id: string;
  avslag_berettiget: boolean;
}

/**
 * BHs strukturerte respons på forseringskrav (tre-port modell).
 *
 * - Port 1: Per-sak vurdering av om avslagene var berettiget
 * - Port 2: Er 30%-regelen overholdt?
 * - Port 3: Beløpsvurdering (hovedkrav + særskilte krav)
 */
export interface ForseringBHRespons {
  // Port 1: Per-sak vurdering av forseringsrett (§33.8)
  vurdering_per_sak?: ForseringsrettVurdering[];
  dager_med_forseringsrett?: number;
  // Legacy field for backward compatibility
  grunnlag_fortsatt_gyldig?: boolean;
  grunnlag_begrunnelse?: string;

  // Port 2: 30%-regel validering
  trettiprosent_overholdt?: boolean;
  trettiprosent_begrunnelse?: string;

  // Port 3: Beløpsvurdering
  aksepterer: boolean;
  godkjent_belop?: number;
  begrunnelse: string;

  // Port 3b: Særskilte krav vurdering (§34.1.3)
  rigg_varslet_i_tide?: boolean;
  produktivitet_varslet_i_tide?: boolean;
  godkjent_rigg_drift?: number;
  godkjent_produktivitet?: number;

  // Subsidiært standpunkt
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_godkjent_belop?: number;
  subsidiaer_begrunnelse?: string;
  // dato_respons fjernet - bruk event tidsstempel i stedet

  // Computed (fra backend)
  total_godkjent?: number;
}

/**
 * Data spesifikk for forseringssaker (§ 33.8) som egen sak.
 *
 * Denne interfacen brukes når forsering er modellert som en egen sak
 * med relasjoner til avslåtte fristforlengelsessaker (relasjonell modell).
 *
 * Forskjell fra ForseringTilstand:
 * - ForseringTilstand: Embedded i FristTilstand (gammel modell)
 * - ForseringData: For forseringssak som egen sak (ny modell)
 */
export interface ForseringData {
  // Referanser til opprinnelige saker
  avslatte_fristkrav: string[];  // SAK-IDs til avslåtte fristforlengelser

  // Varsling
  dato_varslet: string;
  estimert_kostnad: number;
  bekreft_30_prosent_regel: boolean;
  begrunnelse?: string;

  // Kalkulasjonsgrunnlag
  avslatte_dager: number;           // Sum av avslåtte dager
  dagmulktsats: number;             // NOK per dag
  maks_forseringskostnad: number;   // Beregnet: avslatte_dager * dagmulktsats * 1.3

  // Status
  er_iverksatt: boolean;
  dato_iverksatt?: string;
  er_stoppet: boolean;
  dato_stoppet?: string;
  paalopte_kostnader?: number;

  // BH respons (legacy - beholdes for bakoverkompatibilitet)
  bh_aksepterer_forsering?: boolean;
  bh_godkjent_kostnad?: number;
  bh_begrunnelse?: string;

  // Ny vederlagsstruktur (§34)
  vederlag?: ForseringVederlag;

  // Ny strukturert BH-respons (tre-port modell)
  bh_respons?: ForseringBHRespons;

  // Computed (fra backend)
  kostnad_innenfor_grense: boolean;
}

// ========== ENDRINGSORDRE (§31.3) ==========

/**
 * Status for endringsordre.
 *
 * Livssyklus:
 * UTKAST → UTSTEDT → AKSEPTERT/BESTRIDT → (evt. REVIDERT → AKSEPTERT)
 */
export type EOStatus =
  | 'utkast'       // BH forbereder EO
  | 'utstedt'      // BH har utstedt EO
  | 'akseptert'    // TE har akseptert EO
  | 'bestridt'     // TE har bestridt EO (fremmer nytt KOE)
  | 'revidert';    // BH har revidert EO etter bestridelse

/**
 * Konsekvenser av endringen (fra Endringsordre-malen).
 * Checkboxes som angir hvilke områder som påvirkes.
 */
export interface EOKonsekvenser {
  sha: boolean;        // SHA-konsekvenser (Sikkerhet, Helse, Arbeidsmiljø)
  kvalitet: boolean;   // Kvalitetskonsekvenser
  fremdrift: boolean;  // Fremdriftskonsekvenser (fristforlengelse)
  pris: boolean;       // Priskonsekvenser (vederlag)
  annet: boolean;      // Andre konsekvenser
  // Computed (fra backend)
  har_konsekvenser?: boolean;
}

/**
 * Data for formell utstedelse av endringsordre (event payload).
 *
 * Dette er data som sendes når BH formelt utsteder en EO.
 * Bruker VederlagKompensasjon for vederlagsdelen for konsistens med VederlagData.
 *
 * Vederlagskompensasjonen kan enten sendes via:
 * - Nytt `vederlag` felt (VederlagKompensasjon) - foretrukket
 * - Legacy-felter (oppgjorsform, kompensasjon_belop, etc.) - for bakoverkompatibilitet
 */
export interface EOUtstedtData {
  // Identifikasjon
  eo_nummer: string;
  revisjon_nummer?: number;

  // Beskrivelse
  beskrivelse: string;
  vedlegg_ids?: string[];

  // Konsekvenser
  konsekvenser?: EOKonsekvenser;
  konsekvens_beskrivelse?: string;

  // Vederlag/oppgjør
  oppgjorsform?: VederlagsMetode;
  kompensasjon_belop?: number;
  fradrag_belop?: number;
  er_estimat?: boolean;

  // Frist
  frist_dager?: number;
  ny_sluttdato?: string;

  // Relaterte saker
  relaterte_koe_saker?: string[];

  // Computed (fra backend)
  netto_belop?: number;
  har_priskonsekvens?: boolean;
  har_fristkonsekvens?: boolean;
}

/**
 * Data spesifikk for endringsordresaker (§31.3) som egen sak.
 *
 * Endringsordre (EO) er det formelle dokumentet som bekrefter en endring
 * i kontrakten. En EO kan samle flere KOE-er (Krav om Endringsordre).
 *
 * Oppgjørsform og indeksregulering:
 * - ENHETSPRISER: Full indeksregulering (§26.2)
 * - REGNINGSARBEID: Delvis indeksregulering (timerater)
 * - FASTPRIS_TILBUD: Ingen indeksregulering
 */
export interface EndringsordreData {
  // Referanser til KOE-saker som inngår i denne EO-en
  relaterte_koe_saker: string[];  // SAK-IDs til KOE-er

  // Identifikasjon
  eo_nummer: string;
  revisjon_nummer: number;

  // Beskrivelse av endringen (§31.3)
  beskrivelse: string;
  vedlegg_ids?: string[];

  // Konsekvenser (fra Endringsordre-malen)
  konsekvenser: EOKonsekvenser;
  konsekvens_beskrivelse?: string;

  // Vederlag/oppgjør
  oppgjorsform?: VederlagsMetode;
  kompensasjon_belop?: number;   // Tillegg
  fradrag_belop?: number;        // Fratrekk
  er_estimat: boolean;

  // Fristkonsekvens
  frist_dager?: number;
  ny_sluttdato?: string;

  // Status og metadata
  status: EOStatus;
  dato_utstedt?: string;
  utstedt_av?: string;

  // TE-respons
  te_akseptert?: boolean;
  te_kommentar?: string;
  dato_te_respons?: string;

  // Computed (fra backend)
  netto_belop?: number;
  har_priskonsekvens?: boolean;
  har_fristkonsekvens?: boolean;
}

// ========== MAIN STATE (Read-Only) ==========

export interface SakState {
  sak_id: string;
  sakstittel: string;

  // Prosjekt- og partsinfo
  prosjekt_navn?: string;
  entreprenor?: string;
  byggherre?: string;

  // Sakstype og relasjoner (ny relasjonell modell for forsering/endringsordre)
  sakstype?: SaksType;  // Default: 'standard'
  relaterte_saker?: SakRelasjon[];  // Kun for sakstype='forsering' eller 'endringsordre'
  forsering_data?: ForseringData;  // Kun for sakstype='forsering'
  endringsordre_data?: EndringsordreData;  // Kun for sakstype='endringsordre'

  // The three tracks (kun relevant for sakstype='standard')
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
  | 'frist_krav_spesifisert'     // TE specifies days for neutral notice (§33.6.1/§33.6.2)
  | 'frist_krav_trukket'
  | 'respons_grunnlag'
  | 'respons_grunnlag_oppdatert'   // BH's "snuoperasjon" - endrer standpunkt
  | 'respons_vederlag'
  | 'respons_vederlag_oppdatert'   // BH opphever tilbakeholdelse eller endrer standpunkt
  | 'respons_frist'
  | 'respons_frist_oppdatert'      // BH endrer standpunkt, evt stopper forsering
  | 'forsering_varsel'             // §33.8 - TE varsler om iverksettelse av forsering
  | 'forsering_stoppet'            // TE stopper forsering (eller BH godkjenner frist)
  | 'forsering_respons'            // BH aksepterer/avslår forseringen
  | 'forsering_kostnader_oppdatert' // TE oppdaterer påløpte kostnader
  | 'forsering_koe_lagt_til'       // KOE lagt til forseringssak
  | 'forsering_koe_fjernet'        // KOE fjernet fra forseringssak
  // Endringsordre-events (§31.3)
  | 'eo_opprettet'                 // EO-sak opprettet (av BH)
  | 'eo_koe_lagt_til'              // KOE lagt til EO
  | 'eo_koe_fjernet'               // KOE fjernet fra EO
  | 'eo_utstedt'                   // BH utsteder EO formelt
  | 'eo_akseptert'                 // TE aksepterer EO
  | 'eo_bestridt'                  // TE bestrider EO
  | 'eo_revidert'                  // BH reviderer EO
  | 'te_aksepterer_respons';       // TE aksepterer BHs svar (per spor)

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
  /** Ble BH varslet før regningsarbeidet startet? (§34.4) */
  varslet_for_oppstart?: boolean;
  produktivitetstap_varsel?: VarselInfo;
}

export interface FristEventData {
  // Port 1: Varseltype
  varsel_type: FristVarselType;
  /** Varsel om fristforlengelse (§33.4) */
  frist_varsel?: VarselInfo;
  spesifisert_varsel?: VarselInfo;

  // Kravet (kun relevant ved spesifisert)
  antall_dager?: number;
  begrunnelse: string;

  // Fremdriftsinfo (Port 2)
  fremdriftshindring_dokumentasjon?: string;
  ny_sluttdato?: string;
  vedlegg_ids?: string[];
}

// Beløpsvurdering for enkelt krav
// NB: 'prekludert' er IKKE en beløpsvurdering - preklusjon bestemmes av
// rigg_varslet_i_tide/produktivitet_varslet_i_tide i Port 1.
// Beløpsvurderingen representerer BH's faktiske vurdering av kravet.
export type BelopVurdering = 'godkjent' | 'delvis' | 'avslatt';

// Vederlag response event (Port Model)
export interface ResponsVederlagEventData {
  // Referanse og sporbarhet
  vederlag_krav_id?: string;
  /** Hvilken TE-versjon (0-indeksert) denne responsen gjelder. Settes automatisk av backend. */
  respondert_versjon?: number;

  // Port 1: Preklusjon av særskilte krav (§34.1.3)
  rigg_varslet_i_tide?: boolean;
  produktivitet_varslet_i_tide?: boolean;

  // Port 1: Andre varsler
  varsel_justert_ep_ok?: boolean;
  begrunnelse_varsel?: string;

  // Port 2: Metode
  aksepterer_metode?: boolean;
  oensket_metode?: VederlagsMetode;
  ep_justering_akseptert?: boolean;
  hold_tilbake?: boolean;
  vederlagsmetode?: VederlagsMetode;  // BH's valgte metode (legacy)

  // Port 3: Beløpsvurdering - Hovedkrav
  hovedkrav_vurdering?: BelopVurdering;
  hovedkrav_godkjent_belop?: number;

  // Port 3: Beløpsvurdering - Særskilte krav (§34.1.3)
  rigg_vurdering?: BelopVurdering;
  rigg_godkjent_belop?: number;
  produktivitet_vurdering?: BelopVurdering;
  produktivitet_godkjent_belop?: number;

  // Port 4: Samlet resultat
  beregnings_resultat: VederlagBeregningResultat;
  total_godkjent_belop?: number;
  total_krevd_belop?: number;
  begrunnelse?: string;  // Samlet begrunnelse
  frist_for_spesifikasjon?: string;

  // Subsidiært standpunkt (når BH tar prinsipalt avslag men subsidiært godkjenner)
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: VederlagBeregningResultat;
  subsidiaer_godkjent_belop?: number;
  subsidiaer_begrunnelse?: string;
}

// Frist response event (Port Model)
export interface ResponsFristEventData {
  /** Hvilken TE-versjon (0-indeksert) denne responsen gjelder. Settes automatisk av backend. */
  respondert_versjon?: number;

  // Port 1: Preklusjon (Varsling)
  /** Var varsel om fristforlengelse (§33.4) rettidig? */
  frist_varsel_ok?: boolean;
  spesifisert_krav_ok?: boolean;
  /** §33.6.2/§5: Var svar på forespørsel rettidig? */
  foresporsel_svar_ok?: boolean;
  /** Har BH sendt forespørsel om spesifisering (§33.6.2)? */
  har_bh_foresporsel?: boolean;
  /** Dato BH sendte forespørsel om spesifisering (§33.6.2) - YYYY-MM-DD */
  dato_bh_foresporsel?: string;
  begrunnelse_varsel?: string;

  // Port 2: Vilkår (Årsakssammenheng)
  vilkar_oppfylt?: boolean;

  // Port 3: Utmåling (Beregning)
  beregnings_resultat: FristBeregningResultat;
  godkjent_dager?: number;
  ny_sluttdato?: string;
  frist_for_spesifisering?: string;

  // Subsidiært standpunkt (når BH tar prinsipalt avslag men subsidiært godkjenner)
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: FristBeregningResultat;
  subsidiaer_godkjent_dager?: number;
  subsidiaer_begrunnelse?: string;

  // Port 4: Samlet begrunnelse (Oppsummering)
  begrunnelse?: string;
}

// Grunnlag response event
export interface ResponsGrunnlagEventData {
  /** Hvilken TE-versjon (0-indeksert) denne responsen gjelder. Settes automatisk av backend. */
  respondert_versjon?: number;
  resultat: GrunnlagResponsResultat;
  begrunnelse: string;
  akseptert_kategori?: string;
  /** §32.2: Var grunnlagsvarselet rettidig? (kun ENDRING) */
  grunnlag_varslet_i_tide?: boolean;
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
  resultat?: GrunnlagResponsResultat;
  begrunnelse?: string;
  dato_endret?: string;
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
  beregnings_resultat?: VederlagBeregningResultat;

  // Oppdaterte beløp per kravtype (valgfritt - kun de som endres)
  hovedkrav_godkjent_belop?: number;
  rigg_godkjent_belop?: number;
  produktivitet_godkjent_belop?: number;

  // Totalt godkjent beløp (beregnet fra individuelle poster)
  total_godkjent_belop?: number;

  // Subsidiært standpunkt (hvis oppdateringen gjelder subsidiær)
  subsidiaer_resultat?: VederlagBeregningResultat;
  subsidiaer_godkjent_belop?: number;

  begrunnelse?: string;
  dato_endret?: string;
}

// Frist update event (TE revises days claim)
export interface FristOppdatertEventData {
  original_event_id: string;
  nytt_antall_dager?: number;
  begrunnelse: string;
  dato_revidert: string;
}

// Frist specification event (TE specifies days for neutral notice - §33.6.1/§33.6.2)
export interface FristSpesifisertEventData {
  original_event_id: string;
  antall_dager: number;
  begrunnelse: string;
  /** True if responding to BH's demand (§33.6.2) */
  er_svar_pa_foresporsel?: boolean;
  ny_sluttdato?: string;
  dato_spesifisert: string;
}

// Frist response update event (BH changes mind, stops forsering)
export interface ResponsFristOppdatertEventData {
  original_respons_id: string;
  beregnings_resultat?: FristBeregningResultat;
  godkjent_dager?: number;
  // Port 2: Preklusjon
  /** Var varsel om fristforlengelse (§33.4) rettidig? */
  frist_varsel_ok?: boolean;
  spesifisert_krav_ok?: boolean;
  /** §33.6.2/§5: Var svar på forespørsel rettidig? */
  foresporsel_svar_ok?: boolean;
  // Port 3: Vilkår
  vilkar_oppfylt?: boolean;
  // Subsidiært standpunkt (hvis oppdateringen gjelder subsidiær)
  subsidiaer_resultat?: FristBeregningResultat;
  subsidiaer_godkjent_dager?: number;
  // Metadata
  kommentar?: string;
  stopper_forsering?: boolean;
  dato_endret?: string;
}

// Forsering varsel event (§33.8 - TE varsler om forsering)
export interface ForseringVarselEventData {
  frist_krav_id: string;  // Reference to the rejected frist claim
  respons_frist_id: string;  // Reference to BH's frist response that triggered this
  estimert_kostnad: number;
  begrunnelse: string;
  bekreft_30_prosent: boolean;  // TE confirms cost < dagmulkt + 30%
  dato_iverksettelse: string;
  avslatte_dager: number;  // Number of days rejected by BH
  dagmulktsats: number;  // Daily liquidated damages rate in NOK
  grunnlag_avslag_trigger: boolean;  // True if triggered by grunnlag rejection
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
  | FristSpesifisertEventData
  | ResponsGrunnlagEventData
  | ResponsGrunnlagOppdatertEventData
  | ResponsVederlagEventData
  | ResponsVederlagOppdatertEventData
  | ResponsFristEventData
  | ResponsFristOppdatertEventData
  | ForseringVarselEventData;

// ========== CLOUDEVENTS v1.0 ==========

/**
 * CloudEvents v1.0 envelope.
 *
 * This is the primary format for all events in the system.
 * See: https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
 */
export interface CloudEvent<T = EventData> {
  // Required attributes
  specversion: '1.0';
  id: string;
  source: string;  // /projects/{prosjekt_id}/cases/{sak_id}
  type: string;    // no.oslo.koe.{event_type}

  // Optional attributes
  time?: string;   // ISO 8601 with Z suffix
  subject?: string;  // sak_id
  datacontenttype?: 'application/json';
  dataschema?: string;

  // Extension attributes (KOE-specific)
  actor?: string;           // Hvem som utførte handlingen
  actorrole?: 'TE' | 'BH';  // Rolle
  comment?: string;         // Valgfri kommentar
  referstoid?: string;      // Referanse til annen event
  summary?: string;         // Human-readable summary
  spor?: SporType | null;   // Track/category (grunnlag, vederlag, frist)

  // Payload
  data?: T;
}

/**
 * CloudEvents namespace for this project.
 */
export const CLOUDEVENTS_NAMESPACE = 'no.oslo.koe';

/**
 * Extract event type from CloudEvents type string.
 *
 * @example
 * extractEventType('no.oslo.koe.grunnlag_opprettet') // 'grunnlag_opprettet'
 */
export function extractEventType(ceType: string): EventType | null {
  if (!ceType) return null;  // Defensive check for undefined/null
  const prefix = `${CLOUDEVENTS_NAMESPACE}.`;
  if (ceType.startsWith(prefix)) {
    return ceType.substring(prefix.length) as EventType;
  }
  return ceType as EventType;
}

/**
 * Extract spor (track) from CloudEvents type string.
 */
export function extractSpor(ceType: string): SporType | null {
  const eventType = extractEventType(ceType);
  if (!eventType) return null;

  if (eventType.includes('grunnlag')) return 'grunnlag';
  if (eventType.includes('vederlag')) return 'vederlag';
  if (eventType.includes('frist')) return 'frist';
  // Note: forsering is a case type (sakstype), not a spor
  return null;
}

/**
 * Type alias for timeline events (CloudEvents format).
 */
export type TimelineEvent = CloudEvent<EventData>;

// ========== LEGACY TIMELINE ENTRY (deprecated) ==========

/**
 * @deprecated Use CloudEvent<EventData> instead.
 * This interface is kept for backward compatibility during migration.
 */
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
