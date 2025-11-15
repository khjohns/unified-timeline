export type SakStatus =
  | '100000000' // Under varsling
  | '100000002' // Venter på svar
  | '100000003' // Under avklaring
  | '100000007' // Vurderes av TE
  | '100000005' // Omforent (EO utstedes)
  | '100000013' // Pågår - Under utførelse
  | '100000008' // Under tvist
  | '100000011' // Lukket (Implementert)
  | '100000006' // Lukket (Avslått)
  | '100000009' // Lukket (Tilbakekalt)
  | '100000012' // Lukket (Annullert)
  | '';

export interface Sak {
  sak_id_display: string;
  sakstittel: string;
  opprettet_av: string;
  opprettet_dato: string;
  prosjekt_navn: string;
  kontrakt_referanse: string;
  entreprenor: string;
  byggherre: string;
  status?: SakStatus;
}

export interface Varsel {
  dato_forhold_oppdaget: string;
  dato_varsel_sendt: string;
  hovedkategori: string;
  underkategori: string[]; // Endret til array for å tillate multivalg
  varsel_beskrivelse: string;
  varsel_metode: string; // Kommaseparert string av metoder (f.eks. "E-post, Byggemøte")
  varsel_metode_annet?: string; // Spesifikasjon hvis "Annet" er valgt
  tidligere_varsel_referanse?: string; // Referanse til tidligere varsel (valgfritt)
}

export interface KoeVederlag {
  krav_vederlag: boolean;
  krav_produktivitetstap: boolean;
  saerskilt_varsel_rigg_drift: boolean;
  krav_vederlag_metode: string;
  krav_vederlag_belop: string;
  krav_vederlag_begrunnelse: string;
}

export interface KoeFrist {
  krav_fristforlengelse: boolean;
  krav_frist_type: string;
  krav_frist_antall_dager: string;
  forsinkelse_kritisk_linje: boolean;
  krav_frist_begrunnelse: string;
}

export type KoeStatus =
  | '100000001' // Utkast
  | '100000002' // Sendt til BH
  | '200000001' // Besvart (NY)
  | '100000009' // Tilbakekalt
  | '';

export interface Koe {
  koe_revisjonsnr: string;
  dato_krav_sendt: string;
  for_entreprenor: string;
  vederlag: KoeVederlag;
  frist: KoeFrist;
  status?: KoeStatus;
}

export interface BhSvarVederlag {
  varsel_for_sent: boolean;
  varsel_for_sent_begrunnelse: string;
  bh_svar_vederlag: string;
  bh_vederlag_metode: string;
  bh_godkjent_vederlag_belop: string;
  bh_begrunnelse_vederlag: string;
}

export interface BhSvarFrist {
  varsel_for_sent: boolean;
  varsel_for_sent_begrunnelse: string;
  bh_svar_frist: string;
  bh_godkjent_frist_dager: string;
  bh_frist_for_spesifisering: string;
  bh_begrunnelse_frist: string;
}

export interface BhSvarSign {
  dato_svar_bh: string;
  for_byggherre: string;
}

export type BhSvarStatus =
  | '300000001' // Utkast (NY)
  | '100000004' // Godkjent
  | '300000002' // Delvis Godkjent (NY)
  | '100000010' // Avslått (For sent)
  | '100000006' // Avslått (Uenig)
  | '100000003' // Krever avklaring
  | '';

export interface BhSvar {
  vederlag: BhSvarVederlag;
  frist: BhSvarFrist;
  mote_dato: string;
  mote_referat: string;
  sign: BhSvarSign;
  status?: BhSvarStatus;
}

export interface FormDataModel {
  versjon: string;
  rolle: 'TE' | 'BH';
  sak: Sak;
  varsel: Varsel;
  koe_revisjoner: Koe[];
  bh_svar_revisjoner: BhSvar[];
}

export type Role = 'TE' | 'BH';