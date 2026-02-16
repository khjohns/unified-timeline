/**
 * Sak Query Options
 *
 * Centralized query definitions for case-related data.
 * Using queryOptions ensures consistent queryKeys and caching across the app.
 *
 * @example
 * // In components
 * useQuery(sakQueries.state(sakId))
 * useSuspenseQuery(sakQueries.timeline(sakId))
 *
 * // For invalidation
 * queryClient.invalidateQueries(sakQueries.state(sakId))
 *
 * // For prefetching
 * queryClient.prefetchQuery(sakQueries.state(sakId))
 */

import { queryOptions } from '@tanstack/react-query';
import { fetchCaseState, fetchTimeline, fetchHistorikk, fetchCaseContext } from '../api/state';
import { StateResponse, TimelineResponse, HistorikkResponse, CaseContextResponse } from '../types/api';
import { STALE_TIME } from '../constants/queryConfig';
import { getActiveProjectId } from '../api/client';

/**
 * Query key factory for sak-related queries.
 * Provides type-safe, consistent query keys scoped to active project.
 */
export const sakKeys = {
  all: () => ['sak', getActiveProjectId()] as const,
  detail: (sakId: string) => ['sak', getActiveProjectId(), sakId] as const,
  state: (sakId: string) => ['sak', getActiveProjectId(), sakId, 'state'] as const,
  timeline: (sakId: string) => ['sak', getActiveProjectId(), sakId, 'timeline'] as const,
  historikk: (sakId: string) => ['sak', getActiveProjectId(), sakId, 'historikk'] as const,
  context: (sakId: string) => ['sak', getActiveProjectId(), sakId, 'context'] as const,
};

/**
 * Query options for sak-related queries.
 * Use with useQuery, useSuspenseQuery, prefetchQuery, invalidateQueries, etc.
 */
export const sakQueries = {
  /**
   * Fetch current state of a case
   */
  state: (sakId: string) =>
    queryOptions<StateResponse, Error>({
      queryKey: sakKeys.state(sakId),
      queryFn: () => fetchCaseState(sakId),
      staleTime: STALE_TIME.DEFAULT,
    }),

  /**
   * Fetch timeline (event history) of a case
   */
  timeline: (sakId: string) =>
    queryOptions<TimelineResponse, Error>({
      queryKey: sakKeys.timeline(sakId),
      queryFn: () => fetchTimeline(sakId),
      staleTime: STALE_TIME.DEFAULT,
    }),

  /**
   * Fetch revision history for vederlag and frist tracks
   */
  historikk: (sakId: string) =>
    queryOptions<HistorikkResponse, Error>({
      queryKey: sakKeys.historikk(sakId),
      queryFn: () => fetchHistorikk(sakId),
      staleTime: STALE_TIME.DEFAULT,
    }),

  /**
   * Fetch combined context (state + timeline + historikk) in one request.
   * Eliminates redundant Supabase round-trips.
   */
  context: (sakId: string) =>
    queryOptions<CaseContextResponse, Error>({
      queryKey: sakKeys.context(sakId),
      queryFn: () => fetchCaseContext(sakId),
      staleTime: STALE_TIME.DEFAULT,
    }),
};
