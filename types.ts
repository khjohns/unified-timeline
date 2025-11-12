export interface Sak {
  sak_id_display: string;
  sakstittel: string;
  opprettet_av: string;
  opprettet_dato: string;
  prosjekt_navn: string;
  kontrakt_referanse: string;
  entreprenor: string;
  byggherre: string;
}

export interface Varsel {
  dato_forhold_oppdaget: string;
  dato_varsel_sendt: string;
  hovedkategori: string;
  underkategori: string;
  varsel_beskrivelse: string;
  referansedokumenter: string;
  varsel_metode: string;
  signatur_te: string;
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

export interface Koe {
  koe_revisjonsnr: string;
  dato_krav_sendt: string;
  for_entreprenor: string;
  vederlag: KoeVederlag;
  frist: KoeFrist;
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

export interface BhSvar {
  vederlag: BhSvarVederlag;
  frist: BhSvarFrist;
  mote_dato: string;
  mote_referat: string;
  sign: BhSvarSign;
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