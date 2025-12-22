/**
 * useCaseList Hook
 *
 * React Query hook for fetching and caching the list of all cases.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchCaseList } from '../api/cases';
import { CaseListResponse } from '../types/api';
import { STALE_TIME } from '../constants/queryConfig';

export interface UseCaseListOptions {
  /**
   * Filter by case type
   */
  sakstype?: 'standard' | 'forsering' | 'endringsordre';

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
 * Fetch and cache the list of all cases
 *
 * @param options - Query options
 * @returns React Query result with case list data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useCaseList();
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <ul>
 *     {data.cases.map(c => <li key={c.sak_id}>{c.cached_title}</li>)}
 *   </ul>
 * );
 * ```
 */
export function useCaseList(options: UseCaseListOptions = {}) {
  const {
    sakstype,
    staleTime = STALE_TIME.DEFAULT,
    refetchOnWindowFocus = true,
    enabled = true,
  } = options;

  return useQuery<CaseListResponse, Error>({
    queryKey: ['cases', sakstype ?? 'all'],
    queryFn: () => fetchCaseList(sakstype),
    staleTime,
    refetchOnWindowFocus,
    enabled,
  });
}
