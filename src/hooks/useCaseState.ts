/**
 * useCaseState Hook
 *
 * React Query hook for fetching and caching case state.
 * Automatically handles loading, error states, and background refetching.
 */

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { StateResponse } from '../types/api';
import { sakQueries } from '../queries';

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
 * const { data, isPending, error } = useCaseState('123');
 *
 * if (isPending) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return <StatusDashboard state={data.state} />;
 * ```
 */
export function useCaseState(sakId: string, options: UseCaseStateOptions = {}) {
  const {
    staleTime,
    refetchOnWindowFocus = true,
    enabled = true,
  } = options;

  return useQuery<StateResponse, Error>({
    ...sakQueries.state(sakId),
    ...(staleTime !== undefined && { staleTime }),
    refetchOnWindowFocus,
    enabled: enabled && !!sakId,
  });
}

export interface UseCaseStateSuspenseOptions {
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

/**
 * Suspense-enabled version of useCaseState.
 * Suspends rendering until data is available - use with React Suspense boundary.
 *
 * @param sakId - The case ID
 * @param options - Query options
 * @returns React Query result with guaranteed state data (no isPending)
 *
 * @example
 * ```tsx
 * // Wrap in Suspense boundary
 * <Suspense fallback={<LoadingState />}>
 *   <CasePage />
 * </Suspense>
 *
 * // In CasePage - data is guaranteed to exist
 * const { data } = useCaseStateSuspense('123');
 * return <StatusDashboard state={data.state} />;
 * ```
 */
export function useCaseStateSuspense(sakId: string, options: UseCaseStateSuspenseOptions = {}) {
  const {
    staleTime,
    refetchOnWindowFocus = true,
  } = options;

  return useSuspenseQuery<StateResponse, Error>({
    ...sakQueries.state(sakId),
    ...(staleTime !== undefined && { staleTime }),
    refetchOnWindowFocus,
  });
}
