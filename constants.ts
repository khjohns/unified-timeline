import { FormDataModel } from './types';

export const TABS = [
    { label: 'Sak', icon: 'information' },
    { label: 'Varsel', icon: 'flag' },
    { label: 'Krav', icon: 'invoice' },
    { label: 'BH Svar', icon: 'signature' },
    { label: 'Oversikt', icon: 'table' },
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
        status: '100000000', // Under varsling
    },
    varsel: {
        dato_forhold_oppdaget: '',
        dato_varsel_sendt: '',
        hovedkategori: '',
        underkategori: '',
        varsel_beskrivelse: '',
        varsel_metode: '',
    },
    koe_revisjoner: [
        {
            koe_revisjonsnr: '0',
            dato_krav_sendt: '',
            for_entreprenor: '',
            status: '100000001', // Under utarbeidelse
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
            status: '300000001', // Utkast
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
        status: '100000002', // Venter på svar (på revisjon 2)
    },
    varsel: {
        dato_forhold_oppdaget: '2023-10-10',
        dato_varsel_sendt: '2023-10-12',
        hovedkategori: '100000002',
        underkategori: 'Uforutsette grunnforhold (§23.1a) - Grunnforhold avviker fra det som var kjent',
        varsel_beskrivelse: 'Det ble oppdaget avvik mellom tegning F-01 rev. B og faktiske grunnforhold ved akse 1200-1400. Fundament må prosjekteres om for å håndtere uforutsette mengder med løsmasser.',
        varsel_metode: 'E-post',
    },
    koe_revisjoner: [
        {
            koe_revisjonsnr: '0',
            dato_krav_sendt: '2023-10-26',
            for_entreprenor: 'Per Olsen',
            status: '200000001', // Besvart
            vederlag: {
                krav_vederlag: true,
                krav_produktivitetstap: false,
                saerskilt_varsel_rigg_drift: false,
                krav_vederlag_metode: '100000003',
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
            status: '200000001', // Besvart
            vederlag: {
                krav_vederlag: true,
                krav_produktivitetstap: true,
                saerskilt_varsel_rigg_drift: false,
                krav_vederlag_metode: '100000003',
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
        },
        {
            koe_revisjonsnr: '2',
            dato_krav_sendt: '',
            for_entreprenor: '',
            status: '100000001', // Utkast
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
                bh_svar_vederlag: '100000001',
                bh_vederlag_metode: '',
                bh_godkjent_vederlag_belop: '195000',
                bh_begrunnelse_vederlag: 'Godkjenner ompresjektering og utførelse, men avviser krav for ventetid da dette ikke var tilstrekkelig dokumentert. Redusert beløp reflekterer dette.',
            },
            frist: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_frist: '100000000',
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
            status: '300000002', // Delvis Godkjent
        },
        {
            vederlag: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_vederlag: '100000001',
                bh_vederlag_metode: '',
                bh_godkjent_vederlag_belop: '75000',
                bh_begrunnelse_vederlag: 'Delvis godkjent. Godkjenner produktivitetstap, men reduserer beløpet da ikke all ventetid kan dokumenteres tilstrekkelig.',
            },
            frist: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_frist: '100000000',
                bh_godkjent_frist_dager: '3',
                bh_frist_for_spesifisering: '',
                bh_begrunnelse_frist: 'Godkjent fullt ut, da forsinkelsen er påvist og forårsaket av vår sene avklaring.',
            },
            mote_dato: '',
            mote_referat: '',
            sign: {
                dato_svar_bh: '2023-11-25',
                for_byggherre: 'Lise Hansen',
            },
            status: '300000002', // Delvis Godkjent
        }
    ],
};

export const HOVEDKATEGORI_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "100000000", label: "Endring initiert av BH - Byggherre igangsetter endring (§31.1)" },
    { value: "100000001", label: "Forsinkelse eller svikt i BHs ytelser - BH oppfyller ikke sine forpliktelser (§22, §24)" },
    { value: "100000002", label: "Risiko for grunnforhold - Uforutsette eller uriktige grunnforhold (§23.1)" },
    { value: "100000003", label: "Offentlige pålegg - Myndighetskrav som endrer forutsetninger (§16.3)" },
    { value: "100000004", label: "Forsering / Tidsmessig omlegging" },
    { value: "100000005", label: "Force majeure - Ekstraordinære hendelser (§33.3)" },
    { value: "100000006", label: "Hindringer BH har risikoen for - Forhold som hindrer fremdrift (§33.1c)" },
    { value: "100000007", label: "Øvrige forhold - Andre grunnlag for fristforlengelse/vederlag" },
];

export const UNDERKATEGORI_MAP: Record<string, string[]> = {
    "100000000": [ // Endring initiert av BH
        "Regulær endringsordre (§31.1, §31.3) - BH har rett til å endre prosjektet",
        "Irregulær endring/pålegg uten EO (§32.1) - BH gir ordre uten forutgående EO",
        "Mengdeendring (§31.1 siste avsnitt, §34.3) - Endring i mengde av kontraktsarbeid",
    ],
    "100000001": [ // Forsinkelse eller svikt i BHs ytelser
        "Prosjektering (§24.1) - Mangler i prosjekteringsunderlag fra BH",
        "Svikt i arbeidsgrunnlaget (§22.3, §25) - BH har ikke levert komplett/korrekt arbeidsgrunnlag",
        "Materialer fra BH (§22.4) - BH-leverte materialer mangler eller er forsinkert",
        "Tillatelser og godkjenninger (§16.3) - BH har ikke skaffet nødvendige tillatelser",
        "Fastmerker og utstikking (§18.4) - BH har ikke etablert korrekte fastmerker",
        "Svikt i BHs foreskrevne løsninger (§24.1) - BHs valgte løsninger er ikke egnet",
        "Koordinering av sideentreprenører (§21) - BH koordinerer ikke andre entreprenører tilfredsstillende",
    ],
    "100000002": [ // Risiko for grunnforhold
        "Uforutsette grunnforhold (§23.1a) - Grunnforhold avviker fra det som var kjent",
        "Uriktige grunnopplysninger fra BH (§23.1b) - BH har gitt feil informasjon",
        "Forurensning i grunnen (§23.1) - Uventet forurensning oppdages",
        "Kulturminner (§23.3) - Funn av kulturminner som krever stans og varsling",
    ],
    "100000003": [ // Offentlige pålegg
        "Myndighetspålegg som endrer forutsetninger",
    ],
    "100000004": [ // Forsering / Tidsmessig omlegging
        "Pålagt forsering / omlegging (§31.2) - BH pålegger endret tidsplan som en endring",
        "Forsering ved uberettiget avslag på fristkrav (§33.8) - TE velger å forsere etter avslag",
    ],
    "100000005": [ // Force majeure
        "Ekstraordinære hendelser utenfor partenes kontroll",
    ],
    "100000006": [ // Hindringer BH har risikoen for
        "Hindringer på byggeplassen (§33.1c) - Fysiske hindringer BH har risikoen for",
        "Offentlige restriksjoner (§33.1c) - Myndighetspålagte begrensninger",
        "Tilstøtende arbeider forsinket (§33.1c) - Andre entreprenører forsinker",
    ],
    "100000007": [ // Øvrige forhold
        "Andre grunnlag (spesifiser i beskrivelse)",
    ]
};

export const VEDERLAGSMETODER_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "100000000", label: "Entreprenørens tilbud (§34.2.1)" },
    { value: "100000001", label: "Kontraktens enhetspriser (§34.3.1)" },
    { value: "100000002", label: "Justerte enhetspriser (§34.3.2)" },
    { value: "100000003", label: "Regningsarbeid (§30.1)" },
];

export const BH_VEDERLAGSSVAR_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "100000000", label: "Godkjent fullt ut" },
    { value: "100000001", label: "Delvis godkjent" },
    { value: "100000002", label: "Avslått (uenig i grunnlag)" },
    { value: "100000003", label: "Avslått (for sent varslet)" },
    { value: "100000004", label: "Avventer (ber om nærmere spesifikasjon)" },
    { value: "100000005", label: "Godkjent med annen metode" },
];

export const BH_FRISTSVAR_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "100000000", label: "Godkjent fullt ut" },
    { value: "100000001", label: "Delvis godkjent (enig i grunnlag, bestrider beregning)" },
    { value: "100000002", label: "Avslått (uenig i grunnlag)" },
    { value: "100000003", label: "Avslått (for sent varslet)" },
    { value: "100000004", label: "Avventer (ber om nærmere spesifikasjon)" },
];
