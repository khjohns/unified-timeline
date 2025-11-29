/**
 * Submission service for handling status and modus transitions
 *
 * Pure functions - no React dependencies
 * Determines next status and modus based on current workflow state
 */

import { FormDataModel } from '../types';
import { Modus } from './api';
import { SAK_STATUS } from '../utils/statusHelpers';

export interface StatusTransition {
  nextStatus: string;
  nextModus: string;
  requiresRevision?: boolean;
}

/**
 * Submission service for status/modus workflow transitions
 */
export const submissionService = {
  /**
   * Determine next status and modus after Varsel submission
   *
   * Flow: Varsel → KOE
   * Status: Under varsling → Varslet
   */
  getVarselTransition(): StatusTransition {
    return {
      nextStatus: SAK_STATUS.VARSLET,
      nextModus: 'koe',
    };
  },

  /**
   * Determine next status and modus after Svar submission
   *
   * Flow:
   * - If BH requires revision → Svar → Revidering
   * - If BH approves → Svar → Ferdig (Omforent)
   *
   * BH response codes that require revision:
   * - 100000001: Delvis godkjent
   * - 100000002: Avslått uenig
   * - 100000003: Avslått for sent (TE må begrunne varslingtidspunkt)
   * - 100000004: Avventer (TE må gi mer detaljer)
   *
   * @param formData - Complete form data with BH svar
   * @returns Status transition
   */
  getSvarTransition(formData: FormDataModel): StatusTransition {
    const sisteBhSvar = formData.bh_svar_revisjoner[formData.bh_svar_revisjoner.length - 1];
    const vederlagSvar = sisteBhSvar?.vederlag?.bh_svar_vederlag || '';
    const fristSvar = sisteBhSvar?.frist?.bh_svar_frist || '';

    // Check if revision is needed
    const trengerRevidering = (
      vederlagSvar === '100000001' || vederlagSvar === '100000002' ||
      vederlagSvar === '100000003' || vederlagSvar === '100000004' ||
      fristSvar === '100000001' || fristSvar === '100000002' ||
      fristSvar === '100000003' || fristSvar === '100000004'
    );

    if (trengerRevidering) {
      return {
        nextStatus: SAK_STATUS.VURDERES_AV_TE,
        nextModus: 'revidering',
        requiresRevision: true,
      };
    } else {
      return {
        nextStatus: SAK_STATUS.OMFORENT,
        nextModus: 'ferdig',
        requiresRevision: false,
      };
    }
  },

  /**
   * Determine next status and modus after Revidering submission
   *
   * Flow: Revidering → Svar (waiting for BH response)
   * Status: Vurderes av TE → Venter på svar
   */
  getRevideringTransition(): StatusTransition {
    return {
      nextStatus: SAK_STATUS.VENTER_PAA_SVAR,
      nextModus: 'svar',
    };
  },

  /**
   * Determine next status and modus after KOE submission
   *
   * Flow: KOE → Svar (waiting for BH response)
   * Status: Varslet → Venter på svar
   */
  getKoeTransition(): StatusTransition {
    return {
      nextStatus: SAK_STATUS.VENTER_PAA_SVAR,
      nextModus: 'svar',
    };
  },

  /**
   * Get transition based on current modus
   *
   * Main router function - delegates to specific transition functions
   *
   * @param modus - Current workflow mode
   * @param formData - Complete form data (needed for svar transition logic)
   * @returns Status transition
   */
  getTransition(modus: Modus | null, formData: FormDataModel): StatusTransition {
    switch (modus) {
      case 'varsel':
        return submissionService.getVarselTransition();
      case 'svar':
        return submissionService.getSvarTransition(formData);
      case 'revidering':
        return submissionService.getRevideringTransition();
      case 'koe':
      default:
        return submissionService.getKoeTransition();
    }
  },

  /**
   * Check if BH response requires TE revision
   *
   * Helper function to determine if TE needs to revise their claim
   * based on BH response codes
   *
   * @param formData - Complete form data with BH svar
   * @returns True if revision is required
   */
  requiresRevision(formData: FormDataModel): boolean {
    const transition = submissionService.getSvarTransition(formData);
    return transition.requiresRevision || false;
  },
};
