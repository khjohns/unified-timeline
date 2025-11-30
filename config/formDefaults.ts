import { FormDataModel } from '../types';
import { SAK_STATUS, KOE_STATUS, BH_SVAR_STATUS } from '../utils/statusHelpers';

/**
 * Initial form data structure
 * Used when creating a new case
 */
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
        status: SAK_STATUS.UNDER_VARSLING,
    },
    varsel: {
        dato_forhold_oppdaget: '',
        dato_varsel_sendt: '',
        hovedkategori: '',
        underkategori: [],
        varsel_beskrivelse: '',
        varsel_metode: '',
    },
    koe_revisjoner: [
        {
            koe_revisjonsnr: '0',
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
            status: BH_SVAR_STATUS.UTKAST,
        }
    ],
};
