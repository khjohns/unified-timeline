/**
 * useCaseState Hook
 *
 * React Query hook for fetching and caching case state.
 * Automatically handles loading, error states, and background refetching.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchCaseState } from '../api/state';
import { StateResponse } from '../types/api';

export interface UseCaseStateOptions {
  /**
   * How long to consider data fresh (ms)
   * @default 30000 (30 seconds)
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
    staleTime = 30_000, // 30 seconds
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
