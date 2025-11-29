/**
 * Custom hook for form submission and validation
 *
 * Handles:
 * 1. Form validation before submission
 * 2. PDF generation and preview
 * 3. API submission with status transitions
 * 4. PDF upload to backend
 * 5. Error handling and user feedback
 *
 * @param params - Configuration parameters
 * @returns Submission handlers and loading state
 */

import { useState } from 'react';
import { FormDataModel } from '../types';
import { Modus, api } from '../services/api';
import { validationService } from '../services/validationService';
import { submissionService } from '../services/submissionService';
import { generatePdfBlob } from '../utils/pdfGeneratorReact';
import { showToast } from '../utils/toastHelpers';
import { focusOnField } from '../utils/focusHelpers';
import { logger } from '../utils/logger';

export interface UseFormSubmissionParams {
  formData: FormDataModel;
  setFormData: (data: FormDataModel | ((prev: FormDataModel) => FormDataModel)) => void;
  modus: Modus | null;
  sakId: string | null;
  topicGuid: string | null;
  activeTab: number;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
  setToastMessage: (message: string) => void;
  isApiConnected: boolean | null;
  onPreview: (blob: Blob, type: Modus) => void;
  onSuccess: () => void;
}

export interface UseFormSubmissionReturn {
  isSubmitting: boolean;
  handleSubmit: () => Promise<void>;
  handleConfirm: () => Promise<void>;
  apiError: string | null;
}

/**
 * Custom hook for form submission and validation
 */
export const useFormSubmission = (params: UseFormSubmissionParams): UseFormSubmissionReturn => {
  const {
    formData,
    setFormData,
    modus,
    sakId,
    topicGuid,
    activeTab,
    errors,
    setErrors,
    setToastMessage,
    isApiConnected,
    onPreview,
    onSuccess,
  } = params;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  /**
   * Validate current tab and show error feedback
   */
  const validateCurrentTab = (): boolean => {
    // Use validationService for business logic (pure function, easily testable)
    const validationResult = validationService.validateTab(formData, activeTab);

    if (!validationResult.isValid) {
      // UI logic: Set errors, show toast, focus on field
      setErrors(validationResult.errors);

      // Show the first error message in toast for specific feedback
      const firstErrorMessage = Object.values(validationResult.errors)[0];
      showToast(setToastMessage, firstErrorMessage);

      // Focus on the first invalid field
      if (validationResult.firstInvalidFieldId) {
        focusOnField(validationResult.firstInvalidFieldId);
      }

      return false;
    }

    setErrors({});
    return true;
  };

  /**
   * Step 1: Validate form and show PDF preview
   * Called when user clicks "Send" button
   */
  const handleSubmit = async (): Promise<void> => {
    if (!validateCurrentTab()) {
      return;
    }

    try {
      // Generate PDF blob for preview
      const { blob } = await generatePdfBlob(formData);

      // Show PDF preview modal
      onPreview(blob, modus || 'koe');
    } catch (error) {
      logger.error('PDF generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ukjent feil';
      showToast(setToastMessage, `Feil ved generering av PDF: ${errorMessage}`);
    }
  };

  /**
   * Step 2: Confirm and submit to API
   * Called from PDF preview modal after user confirms
   */
  const handleConfirm = async (): Promise<void> => {
    setIsSubmitting(true);
    setApiError(null);

    try {
      // 1. Get status transition from submissionService
      const transition = submissionService.getTransition(modus, formData);

      // 2. Update formData with new status/modus
      const updatedFormData = {
        ...formData,
        sak: {
          ...formData.sak,
          status: transition.nextStatus,
          modus: transition.nextModus,
        },
      };
      setFormData(updatedFormData);

      // 3. Call appropriate API endpoint based on modus
      let response;
      if (modus === 'varsel') {
        response = await api.submitVarsel(updatedFormData, topicGuid || undefined, sakId || undefined);
      } else if (modus === 'svar' && sakId) {
        response = await api.submitSvar(updatedFormData, sakId, topicGuid || undefined);
      } else if (modus === 'revidering' && sakId) {
        response = await api.submitRevidering(updatedFormData, sakId);
      } else {
        // KOE submission (claim)
        response = await api.submitKoe(updatedFormData, sakId || undefined, topicGuid || undefined);
      }

      if (response.success && response.data) {
        // 4. Generate PDF blob for upload (without auto-download)
        const { blob, filename } = await generatePdfBlob(updatedFormData);

        // 5. Upload PDF to backend for Catenda integration
        const effectiveSakId = response.data.sakId || sakId;
        if (effectiveSakId && isApiConnected) {
          const pdfResponse = await api.uploadPdf(
            effectiveSakId,
            blob,
            filename,
            modus || 'koe',
            topicGuid || undefined
          );
          if (pdfResponse.success) {
            logger.log('PDF uploaded successfully');
          } else {
            logger.warn('PDF upload failed:', pdfResponse.error);
          }
        }

        // 6. Clear localStorage after successful submission
        localStorage.removeItem('koe_v5_0_draft');

        // 7. Close preview modal and show success message
        onSuccess();
        showToast(setToastMessage, response.data.message || 'Skjema sendt til server');
      } else {
        setApiError(response.error || 'Kunne ikke sende skjema');
        showToast(setToastMessage, `Feil: ${response.error}`);
      }
    } catch (error) {
      logger.error('Submit error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ukjent feil';
      setApiError(errorMessage);
      showToast(setToastMessage, `Feil ved innsending: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    handleSubmit,
    handleConfirm,
    apiError,
  };
};
