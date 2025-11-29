/**
 * Integration tests for useFormSubmission hook
 *
 * Tests the complex form submission flow including:
 * - Validation
 * - PDF generation
 * - API submission
 * - PDF upload
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFormSubmission } from '../../hooks/useFormSubmission';
import { api } from '../../services/api';
import { validationService } from '../../services/validationService';
import { submissionService } from '../../services/submissionService';
import { generatePdfBlob } from '../../utils/pdfGeneratorReact';
import { showToast } from '../../utils/toastHelpers';
import { focusOnField } from '../../utils/focusHelpers';
import { logger } from '../../utils/logger';
import { INITIAL_FORM_DATA } from '../../constants';

// Mock dependencies
vi.mock('../../services/api', () => ({
  api: {
    submitVarsel: vi.fn(),
    submitKoe: vi.fn(),
    submitSvar: vi.fn(),
    submitRevidering: vi.fn(),
    uploadPdf: vi.fn(),
  },
}));

vi.mock('../../services/validationService', () => ({
  validationService: {
    validateTab: vi.fn(),
  },
}));

vi.mock('../../services/submissionService', () => ({
  submissionService: {
    getTransition: vi.fn(),
  },
}));

vi.mock('../../utils/pdfGeneratorReact', () => ({
  generatePdfBlob: vi.fn(),
}));

vi.mock('../../utils/toastHelpers', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../utils/focusHelpers', () => ({
  focusOnField: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useFormSubmission', () => {
  const mockSetFormData = vi.fn();
  const mockSetErrors = vi.fn();
  const mockSetToastMessage = vi.fn();
  const mockOnPreview = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const defaultParams = {
    formData: INITIAL_FORM_DATA,
    setFormData: mockSetFormData,
    modus: 'varsel' as const,
    sakId: null,
    topicGuid: null,
    activeTab: 0,
    errors: {},
    setErrors: mockSetErrors,
    setToastMessage: mockSetToastMessage,
    isApiConnected: true,
    onPreview: mockOnPreview,
    onSuccess: mockOnSuccess,
  };

  describe('handleSubmit - Validation and PDF preview', () => {
    it('should prevent submission if validation fails', async () => {
      vi.mocked(validationService.validateTab).mockReturnValue({
        isValid: false,
        errors: { 'varsel.dato_forhold_oppdaget': 'Dato er påkrevd' },
        firstInvalidFieldId: 'varsel.dato_forhold_oppdaget',
      });

      const { result } = renderHook(() => useFormSubmission(defaultParams));

      await result.current.handleSubmit();

      expect(mockSetErrors).toHaveBeenCalledWith({ 'varsel.dato_forhold_oppdaget': 'Dato er påkrevd' });
      expect(showToast).toHaveBeenCalledWith(mockSetToastMessage, 'Dato er påkrevd');
      expect(focusOnField).toHaveBeenCalledWith('varsel.dato_forhold_oppdaget');
      expect(generatePdfBlob).not.toHaveBeenCalled();
      expect(mockOnPreview).not.toHaveBeenCalled();
    });

    it('should generate PDF and show preview if validation passes', async () => {
      vi.mocked(validationService.validateTab).mockReturnValue({
        isValid: true,
        errors: {},
        firstInvalidFieldId: null,
      });

      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      vi.mocked(generatePdfBlob).mockResolvedValue({
        blob: mockBlob,
        filename: 'test.pdf',
      });

      const { result } = renderHook(() => useFormSubmission(defaultParams));

      await result.current.handleSubmit();

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalledWith({});
        expect(generatePdfBlob).toHaveBeenCalledWith(INITIAL_FORM_DATA);
        expect(mockOnPreview).toHaveBeenCalledWith(mockBlob, 'varsel');
      });
    });

    it('should handle PDF generation errors', async () => {
      vi.mocked(validationService.validateTab).mockReturnValue({
        isValid: true,
        errors: {},
        firstInvalidFieldId: null,
      });

      const pdfError = new Error('PDF generation failed');
      vi.mocked(generatePdfBlob).mockRejectedValue(pdfError);

      const { result } = renderHook(() => useFormSubmission(defaultParams));

      await result.current.handleSubmit();

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('PDF generation error:', pdfError);
        expect(showToast).toHaveBeenCalledWith(
          mockSetToastMessage,
          'Feil ved generering av PDF: PDF generation failed'
        );
      });
    });
  });

  describe('handleConfirm - API submission', () => {
    it('should submit varsel successfully', async () => {
      vi.mocked(submissionService.getTransition).mockReturnValue({
        nextStatus: 'BEHANDLES',
        nextModus: 'koe',
      });

      vi.mocked(api.submitVarsel).mockResolvedValue({
        success: true,
        data: { sakId: 'SAK-001', message: 'Varsel sendt' },
      });

      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      vi.mocked(generatePdfBlob).mockResolvedValue({
        blob: mockBlob,
        filename: 'varsel.pdf',
      });

      vi.mocked(api.uploadPdf).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useFormSubmission(defaultParams));

      expect(result.current.isSubmitting).toBe(false);

      await result.current.handleConfirm();

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(mockSetFormData).toHaveBeenCalled();
      expect(api.submitVarsel).toHaveBeenCalledWith(
        expect.objectContaining({
          sak: expect.objectContaining({
            status: 'BEHANDLES',
            modus: 'koe',
          }),
        }),
        undefined,
        undefined
      );
      expect(api.uploadPdf).toHaveBeenCalledWith('SAK-001', mockBlob, 'varsel.pdf', 'varsel', undefined);
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith(mockSetToastMessage, 'Varsel sendt');
      expect(localStorage.getItem('koe_v5_0_draft')).toBeNull();
    });

    it('should submit KOE successfully', async () => {
      const koeParams = {
        ...defaultParams,
        modus: 'koe' as const,
        sakId: 'SAK-001',
      };

      vi.mocked(submissionService.getTransition).mockReturnValue({
        nextStatus: 'BEHANDLES',
        nextModus: 'svar',
      });

      vi.mocked(api.submitKoe).mockResolvedValue({
        success: true,
        data: { sakId: 'SAK-001', message: 'Krav sendt' },
      });

      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      vi.mocked(generatePdfBlob).mockResolvedValue({
        blob: mockBlob,
        filename: 'koe.pdf',
      });

      vi.mocked(api.uploadPdf).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useFormSubmission(koeParams));

      await result.current.handleConfirm();

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(api.submitKoe).toHaveBeenCalledWith(
        expect.objectContaining({
          sak: expect.objectContaining({
            status: 'BEHANDLES',
            modus: 'svar',
          }),
        }),
        'SAK-001',
        undefined
      );
    });

    it('should submit svar successfully', async () => {
      const svarParams = {
        ...defaultParams,
        modus: 'svar' as const,
        sakId: 'SAK-001',
      };

      vi.mocked(submissionService.getTransition).mockReturnValue({
        nextStatus: 'AVSLUTTET',
        nextModus: null,
      });

      vi.mocked(api.submitSvar).mockResolvedValue({
        success: true,
        data: { sakId: 'SAK-001', message: 'Svar sendt' },
      });

      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      vi.mocked(generatePdfBlob).mockResolvedValue({
        blob: mockBlob,
        filename: 'svar.pdf',
      });

      vi.mocked(api.uploadPdf).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useFormSubmission(svarParams));

      await result.current.handleConfirm();

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(api.submitSvar).toHaveBeenCalledWith(
        expect.objectContaining({
          sak: expect.objectContaining({
            status: 'AVSLUTTET',
            modus: null,
          }),
        }),
        'SAK-001',
        undefined
      );
    });

    it('should submit revidering successfully', async () => {
      const revideringParams = {
        ...defaultParams,
        modus: 'revidering' as const,
        sakId: 'SAK-001',
      };

      vi.mocked(submissionService.getTransition).mockReturnValue({
        nextStatus: 'BEHANDLES',
        nextModus: 'svar',
      });

      vi.mocked(api.submitRevidering).mockResolvedValue({
        success: true,
        data: { sakId: 'SAK-001', message: 'Revisjon sendt' },
      });

      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      vi.mocked(generatePdfBlob).mockResolvedValue({
        blob: mockBlob,
        filename: 'revidering.pdf',
      });

      vi.mocked(api.uploadPdf).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useFormSubmission(revideringParams));

      await result.current.handleConfirm();

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(api.submitRevidering).toHaveBeenCalledWith(
        expect.objectContaining({
          sak: expect.objectContaining({
            status: 'BEHANDLES',
            modus: 'svar',
          }),
        }),
        'SAK-001'
      );
    });

    it('should handle API submission errors', async () => {
      vi.mocked(submissionService.getTransition).mockReturnValue({
        nextStatus: 'BEHANDLES',
        nextModus: 'koe',
      });

      vi.mocked(api.submitVarsel).mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const { result } = renderHook(() => useFormSubmission(defaultParams));

      await result.current.handleConfirm();

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
        expect(result.current.apiError).toBe('API error');
      });

      expect(showToast).toHaveBeenCalledWith(mockSetToastMessage, 'Feil: API error');
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should handle PDF upload failures gracefully', async () => {
      vi.mocked(submissionService.getTransition).mockReturnValue({
        nextStatus: 'BEHANDLES',
        nextModus: 'koe',
      });

      vi.mocked(api.submitVarsel).mockResolvedValue({
        success: true,
        data: { sakId: 'SAK-001', message: 'Varsel sendt' },
      });

      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      vi.mocked(generatePdfBlob).mockResolvedValue({
        blob: mockBlob,
        filename: 'varsel.pdf',
      });

      vi.mocked(api.uploadPdf).mockResolvedValue({
        success: false,
        error: 'Upload failed',
      });

      const { result } = renderHook(() => useFormSubmission(defaultParams));

      await result.current.handleConfirm();

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Should still succeed even if PDF upload fails
      expect(logger.warn).toHaveBeenCalledWith('PDF upload failed:', 'Upload failed');
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith(mockSetToastMessage, 'Varsel sendt');
    });

    it('should handle network errors', async () => {
      vi.mocked(submissionService.getTransition).mockReturnValue({
        nextStatus: 'BEHANDLES',
        nextModus: 'koe',
      });

      const networkError = new Error('Network failure');
      vi.mocked(api.submitVarsel).mockRejectedValue(networkError);

      const { result } = renderHook(() => useFormSubmission(defaultParams));

      await result.current.handleConfirm();

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
        expect(result.current.apiError).toBe('Network failure');
      });

      expect(logger.error).toHaveBeenCalledWith('Submit error:', networkError);
      expect(showToast).toHaveBeenCalledWith(
        mockSetToastMessage,
        'Feil ved innsending: Network failure'
      );
    });
  });

  describe('State management', () => {
    it('should set isSubmitting to true during submission', async () => {
      vi.mocked(submissionService.getTransition).mockReturnValue({
        nextStatus: 'BEHANDLES',
        nextModus: 'koe',
      });

      // Create a promise that we can control
      let resolveSubmit: any;
      const submitPromise = new Promise((resolve) => {
        resolveSubmit = resolve;
      });

      vi.mocked(api.submitVarsel).mockReturnValue(submitPromise as any);

      const { result } = renderHook(() => useFormSubmission(defaultParams));

      expect(result.current.isSubmitting).toBe(false);

      const confirmPromise = result.current.handleConfirm();

      // Should be submitting now
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      // Resolve the promise
      resolveSubmit({
        success: true,
        data: { sakId: 'SAK-001', message: 'Success' },
      });

      await confirmPromise;

      // Should be done submitting
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });
  });
});
