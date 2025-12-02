/**
 * useSubmitEvent Hook
 *
 * React Query mutation hook for submitting events to the backend.
 * Automatically invalidates case state cache on success.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitEvent, EventSubmitResponse } from '../api/events';
import { EventType } from '../types/timeline';

export interface SubmitEventPayload {
  eventType: EventType;
  data: Record<string, any>;
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
}

/**
 * Submit an event and invalidate cache
 *
 * @param sakId - The case ID
 * @param options - Mutation options
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * const mutation = useSubmitEvent('123', {
 *   onSuccess: () => {
 *     toast.success('Event submitted successfully');
 *     closeModal();
 *   },
 *   onError: (error) => {
 *     toast.error(error.message);
 *   },
 * });
 *
 * const handleSubmit = (data) => {
 *   mutation.mutate({
 *     eventType: 'vederlag_krav_sendt',
 *     data,
 *   });
 * };
 * ```
 */
export function useSubmitEvent(sakId: string, options: UseSubmitEventOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  return useMutation<EventSubmitResponse, Error, SubmitEventPayload>({
    mutationFn: ({ eventType, data }) => submitEvent(sakId, eventType, data),
    onSuccess: (data) => {
      // Invalidate case state to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['sak', sakId, 'state'] });

      // Call user callback
      onSuccess?.(data);
    },
    onError: (error) => {
      // Call user callback
      onError?.(error);
    },
  });
}
