import { FormDataModel } from '../types';
import { SAK_STATUS, KOE_STATUS, BH_SVAR_STATUS } from '../utils/statusHelpers';

/**
 * Demo data for testing and development
 * Pre-filled with realistic example data
 */
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
        status: SAK_STATUS.VENTER_PAA_SVAR,
    },
    varsel: {
        dato_forhold_oppdaget: '2023-10-10',
        dato_varsel_sendt: '2023-10-12',
        hovedkategori: '100000002',
        underkategori: ['130000000'],
        varsel_beskrivelse: 'Det ble oppdaget avvik mellom tegning F-01 rev. B og faktiske grunnforhold ved akse 1200-1400. Fundament må prosjekteres om for å håndtere uforutsette mengder med løsmasser.',
        varsel_metode: 'E-post',
        vedlegg: [
            'Fotodokumentasjon_grunnforhold_20231010.pdf',
            'Tegning_F-01_rev_B_opprinnelig.pdf',
            'Geoteknisk_rapport_oppdatert.pdf',
        ],
    },
    koe_revisjoner: [
        {
            koe_revisjonsnr: '0',
            dato_krav_sendt: '2023-10-26',
            for_entreprenor: 'Per Olsen',
            status: KOE_STATUS.BESVART,
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
            vedlegg: [
                'Detaljert_kalkyle_fundament_rev0.xlsx',
                'Tegninger_nye_fundamenter_rev0.pdf',
                'Timeregistrering_prosjektering.pdf',
            ],
        },
        {
            koe_revisjonsnr: '1',
            dato_krav_sendt: '2023-11-15',
            for_entreprenor: 'Per Olsen',
            status: KOE_STATUS.BESVART,
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
            vedlegg: [
                'Produktivitetstap_beregning_rev1.xlsx',
                'Dagbok_ventetid_5dager.pdf',
            ],
        },
        {
            koe_revisjonsnr: '2',
            dato_krav_sendt: '',
            for_entreprenor: '',
            status: KOE_STATUS.UTKAST,
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
            status: BH_SVAR_STATUS.DELVIS_GODKJENT,
            vedlegg: [
                'BH_vurdering_krav_rev0.pdf',
                'Møtereferat_20231102.pdf',
            ],
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
            status: BH_SVAR_STATUS.DELVIS_GODKJENT,
            vedlegg: [
                'BH_vurdering_krav_rev1.pdf',
            ],
        }
    ],
};
