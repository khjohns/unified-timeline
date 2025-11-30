import { BhSvar, Koe } from '../types';
import { KOE_STATUS, BH_SVAR_STATUS } from '../utils/statusHelpers';

/**
 * Service for managing revisions (KOE and BH Svar)
 *
 * Pure functions for creating new revision objects.
 * Used when TE needs to revise a claim or BH needs to provide a new response.
 */
export const revisionService = {
  /**
   * Create a new BH Svar revision
   *
   * Creates an empty BH response template with default values.
   * Used when BH needs to respond to a KOE claim.
   *
   * @returns A new BhSvar object with default values
   */
  createBhSvarRevisjon(): BhSvar {
    return {
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
    };
  },

  /**
   * Create a new KOE revision
   *
   * Creates a new KOE claim template based on the previous revision.
   * Increments the revision number and resets status to draft.
   *
   * @param previousKoe - The previous KOE revision to base the new one on
   * @returns A new Koe object with incremented revision number
   */
  createKoeRevisjon(previousKoe: Koe): Koe {
    const nextRevisionNumber = (parseInt(previousKoe.koe_revisjonsnr) + 1).toString();

    return {
      koe_revisjonsnr: nextRevisionNumber,
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
    };
  },
};
