/**
 * useSubmitEvent Hook
 *
 * React Query mutation hook for submitting events to the backend with PDF generation.
 * Automatically invalidates case state cache on success.
 */

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { submitEvent, EventSubmitResponse } from '../api/events';
import { EventType } from '../types/timeline';
import { generatePdfBlobFromState, blobToBase64 } from '../../utils/pdf/pdfGenerator';
import { fetchCaseState } from '../api/state';

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
      let pdfBase64: string | undefined;
      let pdfFilename: string | undefined;
      let expectedVersion = stateData?.version ?? 0;

      // Generate PDF from current state if enabled
      if (generatePdf && stateData?.state) {
        try {
          console.log('📄 Generating PDF from state...');
          const { blob, filename } = await generatePdfBlobFromState(
            stateData.state,
            expectedVersion + 1
          );
          pdfBase64 = await blobToBase64(blob);
          pdfFilename = filename;
          console.log(`✅ PDF generated: ${filename} (${(blob.size / 1024).toFixed(2)} KB)`);
        } catch (pdfError) {
          console.warn('⚠️ Failed to generate PDF on client, backend will generate as fallback:', pdfError);
          // Continue without PDF - backend will generate
        }
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
      // Log PDF source for monitoring
      if (data.pdf_source === 'server') {
        console.warn('⚠️ Backend generated PDF (client generation failed)');
      } else if (data.pdf_source === 'client') {
        console.log('✅ Client PDF uploaded successfully');
      }

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
