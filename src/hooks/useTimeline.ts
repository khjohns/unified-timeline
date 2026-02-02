/**
 * useTimeline Hook
 *
 * React Query hook for fetching and caching case timeline (event history).
 */

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { TimelineResponse } from '../types/api';
import { sakQueries } from '../queries';

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
    staleTime,
    refetchOnWindowFocus = true,
    enabled = true,
  } = options;

  return useQuery<TimelineResponse, Error>({
    ...sakQueries.timeline(sakId),
    ...(staleTime !== undefined && { staleTime }),
    refetchOnWindowFocus,
    enabled: enabled && !!sakId,
  });
}

export interface UseTimelineSuspenseOptions {
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

/**
 * Suspense-enabled version of useTimeline.
 * Suspends rendering until data is available - use with React Suspense boundary.
 */
export function useTimelineSuspense(sakId: string, options: UseTimelineSuspenseOptions = {}) {
  const {
    staleTime,
    refetchOnWindowFocus = true,
  } = options;

  return useSuspenseQuery<TimelineResponse, Error>({
    ...sakQueries.timeline(sakId),
    ...(staleTime !== undefined && { staleTime }),
    refetchOnWindowFocus,
  });
}
