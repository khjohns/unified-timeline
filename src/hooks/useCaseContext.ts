/**
 * useCaseContext Hook
 *
 * Fetches state + timeline + historikk in a single API call.
 * Eliminates 2 of 3 redundant Supabase round-trips by using
 * the combined /api/cases/{sak_id}/context endpoint.
 */

import { useSuspenseQuery } from '@tanstack/react-query';
import { CaseContextResponse, StateResponse, TimelineResponse, GrunnlagHistorikkEntry, VederlagHistorikkEntry, FristHistorikkEntry } from '../types/api';
import { sakQueries } from '../queries';
import { POLL_INTERVAL } from '../constants/queryConfig';

export interface UseCaseContextResult {
  /** State data (same shape as useCaseStateSuspense) */
  data: StateResponse;
  /** Timeline data (same shape as useTimelineSuspense) */
  timelineData: TimelineResponse;
  /** Historikk for all three tracks */
  grunnlagHistorikk: GrunnlagHistorikkEntry[];
  vederlagHistorikk: VederlagHistorikkEntry[];
  fristHistorikk: FristHistorikkEntry[];
}

/**
 * Suspense-enabled hook that fetches all case data in one request.
 *
 * Replaces the combination of:
 * - useCaseStateSuspense(sakId)
 * - useTimelineSuspense(sakId)
 * - useHistorikk(sakId)
 *
 * @param sakId - The case ID
 * @returns Combined case data structured for drop-in replacement
 */
export function useCaseContext(sakId: string): UseCaseContextResult {
  const { data: context } = useSuspenseQuery<CaseContextResponse, Error>({
    ...sakQueries.context(sakId),
    refetchOnWindowFocus: true,
    refetchInterval: POLL_INTERVAL,
  });

  return {
    data: { version: context.version, state: context.state },
    timelineData: { version: context.version, events: context.timeline },
    grunnlagHistorikk: context.historikk.grunnlag,
    vederlagHistorikk: context.historikk.vederlag,
    fristHistorikk: context.historikk.frist,
  };
}
