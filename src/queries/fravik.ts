/**
 * Fravik Query Options
 *
 * Centralized query definitions for fravik-related data.
 */

import { queryOptions } from '@tanstack/react-query';
import { fetchFravikState, fetchFravikEvents } from '../api/fravik';
import type { FravikState, FravikEvent } from '../types/fravik';
import { STALE_TIME } from '../constants/queryConfig';

/**
 * Query key factory for fravik-related queries.
 */
export const fravikKeys = {
  all: ['fravik'] as const,
  detail: (sakId: string) => ['fravik', sakId] as const,
  state: (sakId: string) => ['fravik', sakId, 'state'] as const,
  events: (sakId: string) => ['fravik', sakId, 'events'] as const,
  liste: () => ['fravik-liste'] as const,
};

/**
 * Query options for fravik-related queries.
 */
export const fravikQueries = {
  /**
   * Fetch fravik state
   */
  state: (sakId: string) =>
    queryOptions<FravikState, Error>({
      queryKey: fravikKeys.state(sakId),
      queryFn: () => fetchFravikState(sakId),
      staleTime: STALE_TIME.DEFAULT,
    }),

  /**
   * Fetch fravik events (timeline)
   */
  events: (sakId: string) =>
    queryOptions<FravikEvent[], Error>({
      queryKey: fravikKeys.events(sakId),
      queryFn: () => fetchFravikEvents(sakId),
      staleTime: STALE_TIME.DEFAULT,
    }),
};
