/**
 * Forsering Query Options
 *
 * Centralized query definitions for forsering-related data.
 */

import { queryOptions } from '@tanstack/react-query';
import {
  fetchForseringKontekst,
  fetchKandidatSaker,
  type ForseringKontekstResponse,
  type KandidatSak,
} from '../api/forsering';
import { STALE_TIME } from '../constants/queryConfig';
import { getActiveProjectId } from '../api/client';

/**
 * Query key factory for forsering-related queries.
 */
export const forseringKeys = {
  all: () => ['forsering', getActiveProjectId()] as const,
  kontekst: (sakId: string) => ['forsering', getActiveProjectId(), sakId, 'kontekst'] as const,
  kandidater: () => ['forsering', getActiveProjectId(), 'kandidater'] as const,
  byRelatert: (sakId: string) => ['forsering', getActiveProjectId(), 'by-relatert', sakId] as const,
  validerGrunnlag: (sakId: string) => ['forsering', getActiveProjectId(), sakId, 'valider-grunnlag'] as const,
};

/**
 * Query options for forsering-related queries.
 */
export const forseringQueries = {
  /**
   * Fetch forsering context (main data + related cases + combined timeline)
   */
  kontekst: (sakId: string) =>
    queryOptions<ForseringKontekstResponse, Error>({
      queryKey: forseringKeys.kontekst(sakId),
      queryFn: () => fetchForseringKontekst(sakId),
      staleTime: STALE_TIME.DEFAULT,
    }),

  /**
   * Fetch candidate cases that can be added to a forsering
   */
  kandidater: () =>
    queryOptions<{ success: boolean; kandidat_saker: KandidatSak[] }, Error>({
      queryKey: forseringKeys.kandidater(),
      queryFn: fetchKandidatSaker,
      staleTime: STALE_TIME.EXTENDED,
    }),
};
