/**
 * useTimeline Hook
 *
 * React Query hook for fetching and caching case timeline (event history).
 */

import { useQuery } from '@tanstack/react-query';
import { fetchTimeline } from '../api/state';
import { TimelineResponse } from '../types/api';

export interface UseTimelineOptions {
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  enabled?: boolean;
}

/**
 * Fetch and cache the timeline of a case
 *
 * @param sakId - The case ID
 * @param options - Query options
 * @returns React Query result with timeline data
 */
export function useTimeline(sakId: string, options: UseTimelineOptions = {}) {
  const {
    staleTime = 30_000,
    refetchOnWindowFocus = true,
    enabled = true,
  } = options;

  return useQuery<TimelineResponse, Error>({
    queryKey: ['sak', sakId, 'timeline'],
    queryFn: () => fetchTimeline(sakId),
    staleTime,
    refetchOnWindowFocus,
    enabled: enabled && !!sakId,
  });
}
