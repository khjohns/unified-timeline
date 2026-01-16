/**
 * Fravik Types - TypeScript types for fravik-søknader
 *
 * These types mirror the backend models in backend/models/fravik_*.py
 * State is READ-ONLY - all mutations happen via events.
 */

// ========== ENUMS ==========

export type FravikEventType =
  | 'fravik_soknad_opprettet'
  | 'fravik_soknad_oppdatert'
  | 'fravik_soknad_sendt_inn'
  | 'fravik_soknad_trukket'
  | 'fravik_maskin_lagt_til'
  | 'fravik_maskin_oppdatert'
  | 'fravik_maskin_fjernet'
  | 'fravik_infrastruktur_lagt_til'
  | 'fravik_infrastruktur_oppdatert'
  | 'fravik_miljo_vurdering'
  | 'fravik_miljo_returnert'
  | 'fravik_pl_vurdering'
  | 'fravik_pl_returnert'
  | 'fravik_arbeidsgruppe_vurdering'
  | 'fravik_eier_godkjent'
  | 'fravik_eier_avslatt'
  | 'fravik_eier_delvis_godkjent';

export type FravikStatus =
  | 'utkast'
  | 'sendt_inn'
  | 'under_miljo_vurdering'
  | 'returnert_fra_miljo'
  | 'under_pl_vurdering'
  | 'returnert_fra_pl'
  | 'under_arbeidsgruppe'
  | 'under_eier_beslutning'
  | 'godkjent'
  | 'delvis_godkjent'
  | 'avslatt'
  | 'trukket';

export type MaskinType =
  | 'Gravemaskin'
  | 'Hjullaster'
  | 'Lift'
  | 'Asfaltutlegger'
  | 'Bergboremaskin'
  | 'Borerigg'
  | 'Hjuldoser'
  | 'Pælemaskin'
  | 'Spuntmaskin'
  | 'Vals'
  | 'Annet';

export type MaskinVekt =
  | 'liten'    // < 8 tonn
  | 'medium'   // 8-20 tonn
  | 'stor'     // 20-50 tonn
  | 'svart_stor';  // > 50 tonn

export type Arbeidskategori =
  | 'graving'
  | 'lasting'
  | 'lofting'
  | 'boring_peling'
  | 'asfalt_komprimering'
  | 'annet';

export type Bruksintensitet =
  | 'sporadisk'  // < 2 timer/dag
  | 'normal'     // 2-6 timer/dag
  | 'intensiv';  // > 6 timer/dag

export type FravikBeslutning =
  | 'godkjent'
  | 'delvis_godkjent'
  | 'avslatt'
  | 'krever_avklaring';

export type FravikRolle =
  | 'SOKER'
  | 'MILJO'
  | 'PL'
  | 'ARBEIDSGRUPPE'
  | 'EIER';

export type FravikGrunn =
  | 'markedsmangel'
  | 'leveringstid'
  | 'tekniske_begrensninger'
  | 'hms_krav'
  | 'annet';

export type Drivstoff =
  | 'HVO100'
  | 'annet_biodrivstoff'
  | 'diesel';

// Infrastruktur enums
export type StromtilgangStatus =
  | 'ingen_strom'
  | 'utilstrekkelig'
  | 'geografisk_avstand';

export type ProsjektforholdType =
  | 'plassmangel'
  | 'hms_hensyn'
  | 'stoykrav'
  | 'adkomstbegrensninger'
  | 'annet';

export type AggregatType =
  | 'dieselaggregat'
  | 'hybridaggregat'
  | 'annet';

export type Euroklasse =
  | 'euro_5'
  | 'euro_6'
  | 'euro_vi';

export type MaskinVurderingStatus =
  | 'ikke_vurdert'
  | 'godkjent'
  | 'avslatt'
  | 'delvis_godkjent';

export type SoknadType = 'machine' | 'infrastructure';

// ========== DATA MODELS ==========

export interface MaskinData {
  maskin_id: string;
  maskin_type: MaskinType;
  annet_type?: string;
  vekt: MaskinVekt;
  registreringsnummer?: string;
  start_dato: string;
  slutt_dato: string;
  // Grunner for fravik - påkrevd, minst én
  grunner: FravikGrunn[];
  begrunnelse: string;
  alternativer_vurdert: string;  // Påkrevd
  markedsundersokelse: boolean;
  undersøkte_leverandorer?: string;
  // Erstatningsmaskin - påkrevde felt
  erstatningsmaskin: string;
  erstatningsdrivstoff: Drivstoff;
  arbeidsbeskrivelse: string;
  // Nye felter for kategorisering og rapportering
  arbeidskategori: Arbeidskategori;
  bruksintensitet: Bruksintensitet;
  estimert_drivstofforbruk?: number;
}

export interface MaskinVurderingData {
  maskin_id: string;
  beslutning: FravikBeslutning;
  kommentar?: string;
  vilkar?: string[];
}

// ========== VURDERING TILSTANDER ==========

export interface MaskinMiljoVurdering {
  beslutning: FravikBeslutning;
  kommentar?: string;
  vilkar: string[];
  vurdert_av?: string;
  vurdert_tidspunkt?: string;
}

export interface MaskinArbeidsgruppeVurdering {
  beslutning: FravikBeslutning;
  kommentar?: string;
  vilkar: string[];
  vurdert_tidspunkt?: string;
}

export interface MaskinEierBeslutning {
  beslutning: FravikBeslutning;
  kommentar?: string;
  besluttet_tidspunkt?: string;
}

export interface MaskinTilstand {
  maskin_id: string;
  maskin_type: MaskinType;
  annet_type?: string;
  vekt: MaskinVekt;
  registreringsnummer?: string;
  start_dato: string;
  slutt_dato: string;
  grunner: FravikGrunn[];
  begrunnelse: string;
  alternativer_vurdert?: string;
  markedsundersokelse: boolean;
  undersøkte_leverandorer?: string;
  erstatningsmaskin?: string;
  erstatningsdrivstoff?: string;
  arbeidsbeskrivelse?: string;
  arbeidskategori: Arbeidskategori;
  bruksintensitet: Bruksintensitet;
  estimert_drivstofforbruk?: number;

  // Vurderinger
  miljo_vurdering?: MaskinMiljoVurdering;
  arbeidsgruppe_vurdering?: MaskinArbeidsgruppeVurdering;
  eier_beslutning?: MaskinEierBeslutning;

  // Computed
  samlet_status: MaskinVurderingStatus;
}

// ========== GODKJENNINGSKJEDE ==========

export interface VurderingSteg {
  fullfort: boolean;
  beslutning?: FravikBeslutning;
  dokumentasjon_tilstrekkelig?: boolean;
  kommentar?: string;
  manglende_dokumentasjon?: string;
  vurdert_av?: string;
  vurdert_tidspunkt?: string;
}

export interface GodkjenningsKjedeTilstand {
  miljo_vurdering: VurderingSteg;
  pl_vurdering: VurderingSteg;
  arbeidsgruppe_vurdering: VurderingSteg;
  eier_beslutning: VurderingSteg;

  // Computed
  gjeldende_steg: 'miljo' | 'pl' | 'arbeidsgruppe' | 'eier' | 'ferdig';
  neste_godkjenner_rolle?: FravikRolle;
}

// ========== INFRASTRUKTUR ==========

export type InfrastrukturVurderingStatus =
  | 'ikke_vurdert'
  | 'godkjent'
  | 'avslatt';

export interface InfrastrukturVurdering {
  beslutning: FravikBeslutning;
  kommentar?: string;
  vilkar: string[];
  vurdert_av?: string;
  vurdert_tidspunkt?: string;
}

export interface InfrastrukturTilstand {
  // Periode
  start_dato: string;
  slutt_dato: string;

  // Strømtilgang - strukturerte felter
  stromtilgang_status: StromtilgangStatus;
  avstand_til_tilkobling_meter?: number;
  tilgjengelig_effekt_kw?: number;
  effektbehov_kw: number;
  stromtilgang_tilleggsbeskrivelse?: string;

  // Vurderte alternativer
  mobil_batteri_vurdert: boolean;
  midlertidig_nett_vurdert: boolean;
  redusert_effekt_vurdert: boolean;
  faseinndeling_vurdert: boolean;
  alternative_metoder?: string;

  // Prosjektspesifikke forhold - strukturerte felter
  prosjektforhold: ProsjektforholdType[];
  prosjektforhold_beskrivelse?: string;

  // Kostnadsvurdering - strukturerte felter
  kostnad_utslippsfri_nok: number;
  kostnad_fossil_nok: number;
  prosjektkostnad_nok?: number;
  kostnad_tilleggsbeskrivelse?: string;

  // Erstatningsløsning - strukturerte felter
  aggregat_type: AggregatType;
  aggregat_type_annet?: string;
  euroklasse: Euroklasse;
  erstatningsdrivstoff: Drivstoff;
  aggregat_modell?: string;

  // Vurderinger (samlet for hele infrastruktur-søknaden)
  miljo_vurdering?: InfrastrukturVurdering;
  arbeidsgruppe_vurdering?: InfrastrukturVurdering;
  eier_beslutning?: InfrastrukturVurdering;

  // Computed
  samlet_status: InfrastrukturVurderingStatus;
}

/**
 * Data for å legge til eller oppdatere infrastruktur i en søknad.
 * Brukes i fravik_infrastruktur_lagt_til og fravik_infrastruktur_oppdatert events.
 */
export interface InfrastrukturData {
  // Periode
  start_dato: string;
  slutt_dato: string;

  // Strømtilgang - strukturerte felter
  stromtilgang_status: StromtilgangStatus;
  avstand_til_tilkobling_meter?: number;
  tilgjengelig_effekt_kw?: number;
  effektbehov_kw: number;
  stromtilgang_tilleggsbeskrivelse?: string;

  // Vurderte alternativer
  mobil_batteri_vurdert: boolean;
  midlertidig_nett_vurdert: boolean;
  redusert_effekt_vurdert: boolean;
  faseinndeling_vurdert: boolean;
  alternative_metoder?: string;

  // Prosjektspesifikke forhold - strukturerte felter
  prosjektforhold: ProsjektforholdType[];
  prosjektforhold_beskrivelse?: string;

  // Kostnadsvurdering - strukturerte felter
  kostnad_utslippsfri_nok: number;
  kostnad_fossil_nok: number;
  prosjektkostnad_nok?: number;
  kostnad_tilleggsbeskrivelse?: string;

  // Erstatningsløsning - strukturerte felter
  aggregat_type: AggregatType;
  aggregat_type_annet?: string;
  euroklasse: Euroklasse;
  erstatningsdrivstoff: Drivstoff;
  aggregat_modell?: string;
}

// ========== MAIN STATE ==========

export interface FravikState {
  // Identifikasjon
  sak_id: string;
  sakstype: 'fravik';

  // Prosjektinfo
  prosjekt_navn: string;
  prosjekt_nummer?: string;
  rammeavtale?: string;
  entreprenor?: string;

  // Søkerinfo
  soker_navn: string;
  soker_epost?: string;

  // Søknadsdetaljer
  soknad_type: SoknadType;
  frist_for_svar?: string;
  er_haste: boolean;
  haste_begrunnelse?: string;

  // Avbøtende tiltak
  avbotende_tiltak?: string;
  konsekvenser_ved_avslag?: string;

  // Status
  status: FravikStatus;

  // Maskiner
  maskiner: Record<string, MaskinTilstand>;

  // Infrastruktur
  infrastruktur?: InfrastrukturTilstand;

  // Godkjenningskjede
  godkjenningskjede: GodkjenningsKjedeTilstand;

  // Endelig beslutning
  endelig_beslutning?: FravikBeslutning;
  endelig_beslutning_kommentar?: string;
  endelig_beslutning_tidspunkt?: string;
  endelig_beslutning_av?: string;

  // Metadata
  opprettet?: string;
  sendt_inn_tidspunkt?: string;
  siste_oppdatert?: string;
  antall_events: number;

  // Catenda-integrasjon
  catenda_topic_id?: string;
  catenda_project_id?: string;

  // Computed fields
  antall_maskiner: number;
  antall_godkjente_maskiner: number;
  antall_avslatte_maskiner: number;
  alle_maskiner_vurdert: boolean;
  samlet_maskin_beslutning?: FravikBeslutning;
  kan_sendes_inn: boolean;
  er_ferdigbehandlet: boolean;
  neste_handling: {
    rolle: FravikRolle | null;
    handling: string;
  };
  visningsstatus: string;
}

// ========== LISTE ITEM ==========

export interface FravikListeItem {
  sak_id: string;
  prosjekt_navn: string;
  prosjekt_nummer?: string;
  soker_navn: string;
  soknad_type: SoknadType;
  status: FravikStatus;
  antall_maskiner: number;
  opprettet?: string;
  sendt_inn_tidspunkt?: string;
  siste_oppdatert?: string;
  visningsstatus: string;
}

// ========== EVENT PAYLOADS ==========

export interface SoknadOpprettetData {
  prosjekt_navn: string;
  prosjekt_nummer?: string;
  rammeavtale?: string;
  entreprenor?: string;
  soker_navn: string;
  soker_epost?: string;
  soknad_type: SoknadType;
  frist_for_svar?: string;
  er_haste: boolean;
  haste_begrunnelse?: string;
}

export interface SoknadOppdatertData {
  prosjekt_navn?: string;
  prosjekt_nummer?: string;
  rammeavtale?: string;
  entreprenor?: string;
  soker_navn?: string;
  soker_epost?: string;
  frist_for_svar?: string;
  er_haste?: boolean;
  haste_begrunnelse?: string;
  avbotende_tiltak?: string;
  konsekvenser_ved_avslag?: string;
}

export interface MiljoVurderingData {
  dokumentasjon_tilstrekkelig: boolean;
  maskin_vurderinger: MaskinVurderingData[];
  samlet_anbefaling?: FravikBeslutning;
  kommentar?: string;
  manglende_dokumentasjon?: string;
}

export interface PLVurderingData {
  dokumentasjon_tilstrekkelig: boolean;
  anbefaling: FravikBeslutning;
  kommentar?: string;
  manglende_dokumentasjon?: string;
  maskin_vurderinger?: MaskinVurderingData[];
}

export interface ArbeidsgruppeVurderingData {
  maskin_vurderinger: MaskinVurderingData[];
  samlet_innstilling: FravikBeslutning;
  kommentar?: string;
  deltakere?: string[];
}

export interface EierBeslutningData {
  folger_arbeidsgruppen: boolean;
  beslutning: FravikBeslutning;
  begrunnelse?: string;
  maskin_beslutninger?: MaskinVurderingData[];
}

// ========== FRAVIK EVENT ==========

export interface FravikEvent<T = unknown> {
  event_id: string;
  sak_id: string;
  event_type: FravikEventType;
  tidsstempel: string;
  aktor: string;
  aktor_rolle: FravikRolle;
  kommentar?: string;
  refererer_til_event_id?: string;
  data?: T;
}

// ========== API RESPONSE TYPES ==========

export interface FravikStateResponse {
  sak_id: string;
  state: FravikState;
  events: FravikEvent[];
}

export interface FravikListeResponse {
  soknader: FravikListeItem[];
  total: number;
}

export interface OpprettFravikResponse {
  sak_id: string;
  message: string;
}

// ========== HELPER FUNCTIONS ==========

export const FRAVIK_STATUS_LABELS: Record<FravikStatus, string> = {
  utkast: 'Utkast',
  sendt_inn: 'Sendt inn',
  under_miljo_vurdering: 'Til vurdering hos miljørådgiver',
  returnert_fra_miljo: 'Returnert fra miljørådgiver',
  under_pl_vurdering: 'Til godkjenning hos prosjektleder',
  returnert_fra_pl: 'Returnert fra prosjektleder',
  under_arbeidsgruppe: 'Til behandling i arbeidsgruppen',
  under_eier_beslutning: 'Til beslutning hos eier',
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  trukket: 'Trukket',
};

export const FRAVIK_ROLLE_LABELS: Record<FravikRolle, string> = {
  SOKER: 'Søker',
  MILJO: 'Miljørådgiver',
  PL: 'Prosjektleder',
  ARBEIDSGRUPPE: 'Arbeidsgruppe',
  EIER: 'Prosjekteier',
};

export const MASKIN_TYPE_LABELS: Record<MaskinType, string> = {
  Gravemaskin: 'Gravemaskin',
  Hjullaster: 'Hjullaster',
  Lift: 'Lift',
  Asfaltutlegger: 'Asfaltutlegger',
  Bergboremaskin: 'Bergboremaskin',
  Borerigg: 'Borerigg',
  Hjuldoser: 'Hjuldoser',
  Pælemaskin: 'Pælemaskin',
  Spuntmaskin: 'Spuntmaskin',
  Vals: 'Vals',
  Annet: 'Annet',
};

export const MASKIN_VEKT_LABELS: Record<MaskinVekt, string> = {
  liten: 'Liten (< 8 tonn)',
  medium: 'Medium (8–20 tonn)',
  stor: 'Stor (20–50 tonn)',
  svart_stor: 'Svært stor (> 50 tonn)',
};

export const ARBEIDSKATEGORI_LABELS: Record<Arbeidskategori, string> = {
  graving: 'Graving',
  lasting: 'Lasting',
  lofting: 'Løfting',
  boring_peling: 'Boring/pæling',
  asfalt_komprimering: 'Asfalt/komprimering',
  annet: 'Annet',
};

export const BRUKSINTENSITET_LABELS: Record<Bruksintensitet, string> = {
  sporadisk: 'Sporadisk (< 2 timer/dag)',
  normal: 'Normal (2–6 timer/dag)',
  intensiv: 'Intensiv (> 6 timer/dag)',
};

/**
 * Get display status color based on FravikStatus
 */
export function getFravikStatusColor(status: FravikStatus): 'gray' | 'blue' | 'yellow' | 'green' | 'red' {
  switch (status) {
    case 'utkast':
      return 'gray';
    case 'sendt_inn':
    case 'under_miljo_vurdering':
    case 'under_pl_vurdering':
    case 'under_arbeidsgruppe':
    case 'under_eier_beslutning':
      return 'blue';
    case 'returnert_fra_miljo':
    case 'returnert_fra_pl':
      return 'yellow';
    case 'godkjent':
      return 'green';
    case 'delvis_godkjent':
      return 'yellow';
    case 'avslatt':
    case 'trukket':
      return 'red';
    default:
      return 'gray';
  }
}
