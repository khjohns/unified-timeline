/**
 * useCaseState Hook
 *
 * React Query hook for fetching and caching case state.
 * Automatically handles loading, error states, and background refetching.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchCaseState } from '../api/state';
import { StateResponse } from '../types/api';
import { STALE_TIME } from '../constants/queryConfig';

export interface UseCaseStateOptions {
  /**
   * How long to consider data fresh (ms)
   * @default STALE_TIME.DEFAULT (30 seconds)
   */
  staleTime?: number;

  /**
   * Refetch when window regains focus
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Enable the query
   * @default true
   */
  enabled?: boolean;
}

/**
 * Fetch and cache the current state of a case
 *
 * @param sakId - The case ID
 * @param options - Query options
 * @returns React Query result with state data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useCaseState('123');
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return <StatusDashboard state={data.state} />;
 * ```
 */
export function useCaseState(sakId: string, options: UseCaseStateOptions = {}) {
  const {
    staleTime = STALE_TIME.DEFAULT,
    refetchOnWindowFocus = true,
    enabled = true,
  } = options;

  return useQuery<StateResponse, Error>({
    queryKey: ['sak', sakId, 'state'],
    queryFn: () => fetchCaseState(sakId),
    staleTime,
    refetchOnWindowFocus,
    enabled: enabled && !!sakId,
  });
}
