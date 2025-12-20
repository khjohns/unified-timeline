/**
 * useSubmitEvent Hook
 *
 * React Query mutation hook for submitting events to the backend with PDF generation.
 * Automatically invalidates case state cache on success.
 *
 * Features:
 * - Pre-validates magic link token before submission
 * - Generates client-side PDF for Catenda upload
 * - Throws TOKEN_EXPIRED error if token is invalid
 */

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { submitEvent, EventSubmitResponse } from '../api/events';
import { EventType } from '../types/timeline';
import { fetchCaseState } from '../api/state';
import { getAuthToken, ApiError } from '../api/client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/**
 * Verify the magic link token is still valid
 */
async function verifyToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/magic-link/verify?token=${token}`);
    return response.ok;
  } catch {
    return false;
  }
}

export interface SubmitEventPayload {
  eventType: EventType;
  data: Record<string, any>;
  catendaTopicId?: string;
}

export interface UseSubmitEventOptions {
  /**
   * Callback on successful submission
   */
  onSuccess?: (data: EventSubmitResponse) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;

  /**
   * Whether to generate and submit PDF (default: true)
   */
  generatePdf?: boolean;
}

/**
 * Submit an event with optional PDF generation and invalidate cache
 *
 * @param sakId - The case ID
 * @param options - Mutation options
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const mutation = useSubmitEvent('123', {
 *   onSuccess: (result) => {
 *     toast.success('Event submitted successfully');
 *     if (result.pdf_source === 'server') {
 *       toast.info('PDF was generated on server');
 *     }
 *     closeModal();
 *   },
 *   onError: (error) => {
 *     toast.error(error.message);
 *   },
 *   generatePdf: true, // Enable PDF generation
 * });
 *
 * const handleSubmit = (data) => {
 *   mutation.mutate({
 *     eventType: 'vederlag_krav_sendt',
 *     data,
 *     catendaTopicId: 'topic-guid-123',
 *   });
 * };
 * ```
 */
export function useSubmitEvent(sakId: string, options: UseSubmitEventOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, generatePdf = true } = options;

  // Fetch current state for PDF generation
  const { data: stateData } = useQuery({
    queryKey: ['sak', sakId, 'state'],
    queryFn: () => fetchCaseState(sakId),
    enabled: !!sakId && generatePdf,
  });

  return useMutation<EventSubmitResponse, Error, SubmitEventPayload>({
    mutationFn: async ({ eventType, data, catendaTopicId }) => {
      // 1. Validate token before proceeding
      const token = getAuthToken();
      if (!token) {
        throw new Error('TOKEN_MISSING');
      }

      const isTokenValid = await verifyToken(token);
      if (!isTokenValid) {
        throw new Error('TOKEN_EXPIRED');
      }

      // 2. Prepare submission
      let pdfBase64: string | undefined;
      let pdfFilename: string | undefined;
      let expectedVersion = stateData?.version ?? 0;

      // Generate PDF from current state if enabled (lazy load PDF module)
      if (generatePdf && stateData?.state) {
        try {
          console.log('📄 Generating PDF from state...');
          const { generateContractorClaimPdf, blobToBase64 } = await import('../pdf/generator');
          const { blob, filename } = await generateContractorClaimPdf(stateData.state);
          pdfBase64 = await blobToBase64(blob);
          pdfFilename = filename;
          console.log('✅ PDF generated:', filename, `(${blob.size} bytes)`);
        } catch (error) {
          console.error('❌ PDF generation failed:', error);
          // Continue without PDF - backend will generate as fallback
        }
      } else if (generatePdf) {
        console.warn('⚠️ PDF generation skipped: stateData not available');
      }

      // Submit event with optional PDF
      return submitEvent(sakId, eventType, data, {
        expectedVersion,
        catendaTopicId,
        pdfBase64,
        pdfFilename,
      });
    },
    onSuccess: (data) => {
      // Invalidate case state and timeline to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['sak', sakId, 'state'] });
      queryClient.invalidateQueries({ queryKey: ['sak', sakId, 'timeline'] });

      // Call user callback
      onSuccess?.(data);
    },
    onError: (error) => {
      // Call user callback
      onError?.(error);
    },
  });
}
