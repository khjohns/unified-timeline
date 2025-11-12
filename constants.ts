import { FormDataModel } from './types';

export const TABS = [
    { label: 'Grunninfo', icon: 'information' },
    { label: 'Varsel', icon: 'alert-warning' },
    { label: 'Krav (KOE)', icon: 'document-text' },
    { label: 'BH Svar', icon: 'check-circle' },
    { label: 'Oppsummering', icon: 'list' },
];

export const INITIAL_FORM_DATA: FormDataModel = {
    versjon: '5.0',
    rolle: 'TE',
    sak: {
        sak_id_display: '',
        sakstittel: '',
        opprettet_av: '',
        opprettet_dato: new Date().toISOString().split('T')[0],
        prosjekt_navn: '',
        kontrakt_referanse: '',
        entreprenor: '',
        byggherre: '',
    },
    varsel: {
        dato_forhold_oppdaget: '',
        dato_varsel_sendt: '',
        hovedkategori: '',
        underkategori: '',
        varsel_beskrivelse: '',
        referansedokumenter: '',
        varsel_metode: '',
        signatur_te: '',
    },
    koe_revisjoner: [
        {
            koe_revisjonsnr: '0',
            dato_krav_sendt: '',
            for_entreprenor: '',
            vederlag: {
                krav_vederlag: false,
                krav_produktivitetstap: false,
                saerskilt_varsel_rigg_drift: false,
                krav_vederlag_metode: '',
                krav_vederlag_belop: '',
                krav_vederlag_begrunnelse: '',
            },
            frist: {
                krav_fristforlengelse: false,
                krav_frist_type: '',
                krav_frist_antall_dager: '',
                forsinkelse_kritisk_linje: false,
                krav_frist_begrunnelse: '',
            },
        }
    ],
    bh_svar_revisjoner: [
        {
            vederlag: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_vederlag: '',
                bh_vederlag_metode: '',
                bh_godkjent_vederlag_belop: '',
                bh_begrunnelse_vederlag: '',
            },
            frist: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_frist: '',
                bh_godkjent_frist_dager: '',
                bh_frist_for_spesifisering: '',
                bh_begrunnelse_frist: '',
            },
            mote_dato: '',
            mote_referat: '',
            sign: {
                dato_svar_bh: '',
                for_byggherre: '',
            },
        }
    ],
};

export const DEMO_DATA: FormDataModel = {
    versjon: '5.0',
    rolle: 'TE',
    sak: {
        sak_id_display: 'KOE-2023-015',
        sakstittel: 'Endring av fundament for Støyskjerm A3',
        opprettet_av: 'Kari Nordmann',
        opprettet_dato: '2023-10-26',
        prosjekt_navn: 'E18 Langangen-Rugtvedt',
        kontrakt_referanse: 'K2021/0123',
        entreprenor: 'Veidekke Entreprenør AS',
        byggherre: 'Nye Veier AS',
    },
    varsel: {
        dato_forhold_oppdaget: '2023-10-10',
        dato_varsel_sendt: '2023-10-12',
        hovedkategori: 'Endring fra byggherren (§ 22.1)',
        underkategori: 'Tegnings- eller beskrivelsesfeil',
        varsel_beskrivelse: 'Det ble oppdaget avvik mellom tegning F-01 rev. B og faktiske grunnforhold ved akse 1200-1400. Fundament må prosjekteres om for å håndtere uforutsette mengder med løsmasser.',
        referansedokumenter: 'E-postkorrespondanse 10.10.2023, Referat fra byggemøte #22.',
        varsel_metode: 'E-post',
        signatur_te: 'Per Olsen',
    },
    koe_revisjoner: [
        {
            koe_revisjonsnr: '0',
            dato_krav_sendt: '2023-10-26',
            for_entreprenor: 'Per Olsen',
            vederlag: {
                krav_vederlag: true,
                krav_produktivitetstap: false,
                saerskilt_varsel_rigg_drift: false,
                krav_vederlag_metode: 'Regningsarbeid (§30.1)',
                krav_vederlag_belop: '235000',
                krav_vederlag_begrunnelse: 'Kravet gjelder ompresjektering og utførelse av nye fundamenter for støyskjerm A3, inkludert merarbeid med masseutskifting. Kalkyle basert på timer for prosjektering (15t), maskintimer for gravemaskin (20t), manntimer (80t) og materialkostnader. Se vedlegg A for detaljert kalkyle.',
            },
            frist: {
                krav_fristforlengelse: true,
                krav_frist_type: 'Spesifisert krav (§33.6.1)',
                krav_frist_antall_dager: '5',
                forsinkelse_kritisk_linje: true,
                krav_frist_begrunnelse: 'Arbeidet med støyskjerm A3 er på kritisk linje for ferdigstillelse av delfelt 3. Forsinkelsen forplanter seg til asfaltering som er væravhengig.',
            },
        },
        {
            koe_revisjonsnr: '1',
            dato_krav_sendt: '2023-11-15',
            for_entreprenor: 'Per Olsen',
            vederlag: {
                krav_vederlag: true,
                krav_produktivitetstap: true,
                saerskilt_varsel_rigg_drift: false,
                krav_vederlag_metode: 'Regningsarbeid (§30.1)',
                krav_vederlag_belop: '85000',
                krav_vederlag_begrunnelse: 'Tilleggskrav som følge av forsinkelse forårsaket av sen avklaring fra BH. Inkluderer produktivitetstap for mannskaper (5 dager x 4 mann) og maskiner som stod på stand-by. Kalkulasjonsgrunnlag vedlagt.',
            },
            frist: {
                krav_fristforlengelse: true,
                krav_frist_type: 'Spesifisert krav (§33.6.1)',
                krav_frist_antall_dager: '3',
                forsinkelse_kritisk_linje: true,
                krav_frist_begrunnelse: 'Ytterligere fristforlengelse som følge av at BH ikke godkjente opprinnelig krav i sin helhet. Dette har medført ytterligere forsinkelse i fremdriften.',
            },
        }
    ],
    bh_svar_revisjoner: [
        {
            vederlag: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_vederlag: 'Delvis godkjent',
                bh_vederlag_metode: '',
                bh_godkjent_vederlag_belop: '195000',
                bh_begrunnelse_vederlag: 'Godkjenner ompresjektering og utførelse, men avviser krav for ventetid da dette ikke var tilstrekkelig dokumentert. Redusert beløp reflekterer dette.',
            },
            frist: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_frist: 'Godkjent',
                bh_godkjent_frist_dager: '5',
                bh_frist_for_spesifisering: '',
                bh_begrunnelse_frist: 'Fristforlengelse godkjennes som krevd da arbeidet er på kritisk linje.',
            },
            mote_dato: '2023-11-02',
            mote_referat: 'Referat fra avklaringsmøte 02.11.2023',
            sign: {
                dato_svar_bh: '2023-11-05',
                for_byggherre: 'Lise Hansen',
            },
        },
        {
            vederlag: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_vederlag: '',
                bh_vederlag_metode: '',
                bh_godkjent_vederlag_belop: '',
                bh_begrunnelse_vederlag: '',
            },
            frist: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_frist: '',
                bh_godkjent_frist_dager: '',
                bh_frist_for_spesifisering: '',
                bh_begrunnelse_frist: '',
            },
            mote_dato: '',
            mote_referat: '',
            sign: {
                dato_svar_bh: '',
                for_byggherre: '',
            },
        }
    ],
};

export const HOVEDKATEGORI_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "Endring fra byggherren (§ 22.1)", label: "Endring fra byggherren (§ 22.1)" },
    { value: "Svikt i byggherrens medvirkning (§ 23)", label: "Svikt i byggherrens medvirkning (§ 23)" },
    { value: "Forhold ved grunnen (§ 24.1)", label: "Forhold ved grunnen (§ 24.1)" },
    { value: "Vederlagsjustering for endret mengde (§ 24.2)", label: "Vederlagsjustering for endret mengde (§ 24.2)" },
    { value: "Force majeure (§ 33.3)", label: "Force majeure (§ 33.3)" },
    { value: "Andre forhold", label: "Andre forhold" },
];

export const UNDERKATEGORI_MAP: Record<string, string[]> = {
    "Endring fra byggherren (§ 22.1)": [
        "Endring i omfang",
        "Tegnings- eller beskrivelsesfeil",
        "Endring i materialvalg",
        "Påkrevd fremdriftsendring",
    ],
    "Svikt i byggherrens medvirkning (§ 23)": [
        "Forsinket tilgang til arbeidsområde",
        "Manglende eller forsinkede avklaringer",
        "Svikt fra andre entreprenører",
    ],
    "Forhold ved grunnen (§ 24.1)": [
        "Uforutsette grunnforhold",
        "Funn av forurensning",
        "Arkeologiske funn",
    ],
    "Vederlagsjustering for endret mengde (§ 24.2)": [
        "Avvik fra mengdeforutsetninger",
    ],
    "Force majeure (§ 33.3)": [
        "Ekstreme værforhold",
        "Streik/lockout",
        "Offentlige pålegg",
    ],
    "Andre forhold": [
        "Annet (spesifiser i beskrivelse)",
    ]
};