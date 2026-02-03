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
 * - Shows retry feedback to user during network issues
 */

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { submitEvent, EventSubmitResponse } from '../api/events';
import { EventType } from '../types/timeline';
import { getAuthToken, isRetryableError } from '../api/client';
import { useVerifyToken } from './useVerifyToken';
import { useToast } from '../components/primitives';
import { sakKeys, sakQueries } from '../queries';
import { RETRY_CONFIG, calculateRetryDelay } from '../constants/queryConfig';

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
  const verifyToken = useVerifyToken();
  const toast = useToast();

  // Refs for tracking retry toast state
  const retryToastId = useRef<string | null>(null);
  const didRetry = useRef(false);

  // Fetch current state for PDF generation
  const { data: stateData } = useQuery({
    ...sakQueries.state(sakId),
    enabled: !!sakId && generatePdf,
  });

  const mutation = useMutation<EventSubmitResponse, Error, SubmitEventPayload>({
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

    // Override retry to track retry state for toast notifications
    retry: (failureCount, error) => {
      if (failureCount >= RETRY_CONFIG.MAX_MUTATION_RETRIES) return false;
      if (!isRetryableError(error)) return false;

      // Mark that we're retrying and show/update toast
      didRetry.current = true;
      if (retryToastId.current) {
        toast.dismiss(retryToastId.current);
      }
      retryToastId.current = toast.pending(
        'Tilkoblingsproblem, prøver igjen...',
        `Forsøk ${failureCount + 1} av ${RETRY_CONFIG.MAX_MUTATION_RETRIES + 1}`
      );

      return true;
    },
    retryDelay: calculateRetryDelay,

    onSuccess: (data) => {
      // Dismiss retry toast if present
      if (retryToastId.current) {
        toast.dismiss(retryToastId.current);
        retryToastId.current = null;
      }

      // Show "connection restored" toast if we retried
      if (didRetry.current) {
        toast.success('Gjenopprettet tilkobling', 'Forespørselen ble fullført.');
        didRetry.current = false;
      }

      // Invalidate case state, timeline, and historikk to trigger refetch
      queryClient.invalidateQueries({ queryKey: sakKeys.state(sakId) });
      queryClient.invalidateQueries({ queryKey: sakKeys.timeline(sakId) });
      queryClient.invalidateQueries({ queryKey: sakKeys.historikk(sakId) });

      // Call user callback
      onSuccess?.(data);
    },
    onError: (error) => {
      // Dismiss retry toast if present
      if (retryToastId.current) {
        toast.dismiss(retryToastId.current);
        retryToastId.current = null;
      }
      didRetry.current = false;

      // Call user callback
      onError?.(error);
    },
  });

  // Reset retry state when mutation is reset
  useEffect(() => {
    if (mutation.isIdle) {
      didRetry.current = false;
      if (retryToastId.current) {
        toast.dismiss(retryToastId.current);
        retryToastId.current = null;
      }
    }
  }, [mutation.isIdle, toast]);

  return mutation;
}
