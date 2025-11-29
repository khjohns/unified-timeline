/**
 * Validation service for form data
 *
 * Pure functions - no React dependencies
 * Can be unit tested easily
 */

import { FormDataModel } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  firstInvalidFieldId: string | null;
}

/**
 * Validation service for form data
 */
export const validationService = {
  /**
   * Validate Varsel tab
   *
   * Required fields:
   * - dato_forhold_oppdaget
   * - hovedkategori
   *
   * Note: dato_varsel_sendt is conditionally required and validated in VarselPanel
   */
  validateVarsel(varsel: FormDataModel['varsel']): ValidationResult {
    const errors: Record<string, string> = {};
    let firstInvalidFieldId: string | null = null;

    if (!varsel.dato_forhold_oppdaget.trim()) {
      errors['varsel.dato_forhold_oppdaget'] = 'Dato forhold oppdaget er påkrevd';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'varsel.dato_forhold_oppdaget';
    }

    if (!varsel.hovedkategori.trim()) {
      errors['varsel.hovedkategori'] = 'Hovedkategori er påkrevd';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'varsel.hovedkategori';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstInvalidFieldId,
    };
  },

  /**
   * Validate KOE tab (latest revision)
   *
   * Validates:
   * - Revision number
   * - At least one claim type selected (vederlag or frist)
   * - Vederlag fields if vederlag is selected
   * - Frist fields if frist is selected
   * - Email signature
   */
  validateKoe(koeRevisjoner: FormDataModel['koe_revisjoner']): ValidationResult {
    const errors: Record<string, string> = {};
    let firstInvalidFieldId: string | null = null;

    const sisteKrav = koeRevisjoner[koeRevisjoner.length - 1];
    const revisionIndex = koeRevisjoner.length - 1;

    // Validate revision number
    if (!sisteKrav.koe_revisjonsnr.toString().trim()) {
      errors['koe_revisjoner.koe_revisjonsnr'] = 'Revisjonsnummer er påkrevd';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'koe_revisjoner.koe_revisjonsnr';
    }

    // At least one claim type must be selected
    if (!sisteKrav.vederlag.krav_vederlag && !sisteKrav.frist.krav_fristforlengelse) {
      errors['krav_type'] = 'Du må velge minst ett krav (vederlag eller fristforlengelse)';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'kravstype-vederlag-' + revisionIndex;
    }

    // Validate vederlag if selected
    if (sisteKrav.vederlag.krav_vederlag) {
      if (!sisteKrav.vederlag.krav_vederlag_metode) {
        errors['koe.vederlag.krav_vederlag_metode'] = 'Oppgjørsmetode er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_metode.' + revisionIndex;
      }

      if (!sisteKrav.vederlag.krav_vederlag_belop || sisteKrav.vederlag.krav_vederlag_belop <= 0) {
        errors['koe.vederlag.krav_vederlag_belop'] = 'Krevd beløp er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_belop.' + revisionIndex;
      }

      if (!sisteKrav.vederlag.krav_vederlag_begrunnelse || sisteKrav.vederlag.krav_vederlag_begrunnelse.trim() === '') {
        errors['koe.vederlag.krav_vederlag_begrunnelse'] = 'Begrunnelse for vederlagskrav er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_begrunnelse.' + revisionIndex;
      }
    }

    // Validate frist if selected
    if (sisteKrav.frist.krav_fristforlengelse) {
      if (!sisteKrav.frist.krav_frist_type) {
        errors['koe.frist.krav_frist_type'] = 'Type fristkrav er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_type.' + revisionIndex;
      }

      if (!sisteKrav.frist.krav_frist_antall_dager || sisteKrav.frist.krav_frist_antall_dager <= 0) {
        errors['koe.frist.krav_frist_antall_dager'] = 'Antall dager fristforlengelse er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_antall_dager.' + revisionIndex;
      }

      if (!sisteKrav.frist.krav_frist_begrunnelse || sisteKrav.frist.krav_frist_begrunnelse.trim() === '') {
        errors['koe.frist.krav_frist_begrunnelse'] = 'Begrunnelse for fristforlengelse er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_begrunnelse.' + revisionIndex;
      }
    }

    // Validate email/signature
    if (!sisteKrav.for_entreprenor || sisteKrav.for_entreprenor.trim() === '') {
      errors['koe.signerende_epost'] = 'E-post for signering må valideres';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.signerende_epost.' + revisionIndex;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstInvalidFieldId,
    };
  },

  /**
   * Validate tab based on activeTab index
   *
   * @param formData - Complete form data
   * @param activeTab - Active tab index (0 = Varsel, 1 = KOE, 2 = BH Svar)
   * @returns Validation result
   */
  validateTab(formData: FormDataModel, activeTab: number): ValidationResult {
    switch (activeTab) {
      case 0:
        return validationService.validateVarsel(formData.varsel);
      case 1:
        return validationService.validateKoe(formData.koe_revisjoner);
      case 2:
        // BH Svar tab - no validation needed yet
        return { isValid: true, errors: {}, firstInvalidFieldId: null };
      default:
        // Unknown tab - no validation
        return { isValid: true, errors: {}, firstInvalidFieldId: null };
    }
  },
};
