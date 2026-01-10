/**
 * useAnalytics Hooks
 *
 * React Query hooks for fetching and caching analytics data.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchAnalyticsSummary,
  fetchCategoryAnalytics,
  fetchTimelineAnalytics,
  fetchVederlagAnalytics,
  fetchFristAnalytics,
  fetchResponseTimesAnalytics,
  fetchActorAnalytics,
  AnalyticsSummary,
  CategoryAnalytics,
  TimelineAnalytics,
  VederlagAnalytics,
  FristAnalytics,
  ResponseTimesAnalytics,
  ActorAnalytics,
} from '../api/analytics';
import { STALE_TIME } from '../constants/queryConfig';

interface UseAnalyticsOptions {
  staleTime?: number;
  enabled?: boolean;
}

/**
 * Fetch analytics summary
 */
export function useAnalyticsSummary(options: UseAnalyticsOptions = {}) {
  const { staleTime = STALE_TIME.DEFAULT, enabled = true } = options;

  return useQuery<AnalyticsSummary, Error>({
    queryKey: ['analytics', 'summary'],
    queryFn: fetchAnalyticsSummary,
    staleTime,
    enabled,
  });
}

/**
 * Fetch category analytics
 */
export function useCategoryAnalytics(options: UseAnalyticsOptions = {}) {
  const { staleTime = STALE_TIME.DEFAULT, enabled = true } = options;

  return useQuery<CategoryAnalytics, Error>({
    queryKey: ['analytics', 'categories'],
    queryFn: fetchCategoryAnalytics,
    staleTime,
    enabled,
  });
}

/**
 * Fetch timeline analytics
 */
export function useTimelineAnalytics(
  period: 'day' | 'week' | 'month' = 'week',
  days: number = 90,
  options: UseAnalyticsOptions = {}
) {
  const { staleTime = STALE_TIME.DEFAULT, enabled = true } = options;

  return useQuery<TimelineAnalytics, Error>({
    queryKey: ['analytics', 'timeline', period, days],
    queryFn: () => fetchTimelineAnalytics(period, days),
    staleTime,
    enabled,
  });
}

/**
 * Fetch vederlag analytics
 */
export function useVederlagAnalytics(options: UseAnalyticsOptions = {}) {
  const { staleTime = STALE_TIME.DEFAULT, enabled = true } = options;

  return useQuery<VederlagAnalytics, Error>({
    queryKey: ['analytics', 'vederlag'],
    queryFn: fetchVederlagAnalytics,
    staleTime,
    enabled,
  });
}

/**
 * Fetch response times analytics
 */
export function useResponseTimesAnalytics(options: UseAnalyticsOptions = {}) {
  const { staleTime = STALE_TIME.DEFAULT, enabled = true } = options;

  return useQuery<ResponseTimesAnalytics, Error>({
    queryKey: ['analytics', 'response-times'],
    queryFn: fetchResponseTimesAnalytics,
    staleTime,
    enabled,
  });
}

/**
 * Fetch frist (deadline extension) analytics
 */
export function useFristAnalytics(options: UseAnalyticsOptions = {}) {
  const { staleTime = STALE_TIME.DEFAULT, enabled = true } = options;

  return useQuery<FristAnalytics, Error>({
    queryKey: ['analytics', 'frist'],
    queryFn: fetchFristAnalytics,
    staleTime,
    enabled,
  });
}

/**
 * Fetch actor analytics
 */
export function useActorAnalytics(options: UseAnalyticsOptions = {}) {
  const { staleTime = STALE_TIME.DEFAULT, enabled = true } = options;

  return useQuery<ActorAnalytics, Error>({
    queryKey: ['analytics', 'actors'],
    queryFn: fetchActorAnalytics,
    staleTime,
    enabled,
  });
}
