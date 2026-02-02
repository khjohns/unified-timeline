/**
 * Endringsordre Query Options
 *
 * Centralized query definitions for endringsordre-related data.
 */

import { queryOptions } from '@tanstack/react-query';
import {
  fetchEOKontekst,
  fetchKandidatKOESaker,
  type EOKontekstResponse,
  type KandidatKOE,
} from '../api/endringsordre';
import { STALE_TIME } from '../constants/queryConfig';

/**
 * Query key factory for endringsordre-related queries.
 */
export const endringsordreKeys = {
  all: ['endringsordre'] as const,
  kontekst: (sakId: string) => ['endringsordre', sakId, 'kontekst'] as const,
  kandidater: () => ['endringsordre', 'kandidater'] as const,
  byRelatert: (sakId: string) => ['endringsordre', 'by-relatert', sakId] as const,
};

/**
 * Query options for endringsordre-related queries.
 */
export const endringsordreQueries = {
  /**
   * Fetch endringsordre context (main data + related KOE cases + combined timeline)
   */
  kontekst: (sakId: string) =>
    queryOptions<EOKontekstResponse, Error>({
      queryKey: endringsordreKeys.kontekst(sakId),
      queryFn: () => fetchEOKontekst(sakId),
      staleTime: STALE_TIME.DEFAULT,
    }),

  /**
   * Fetch candidate KOE cases that can be added to an endringsordre
   */
  kandidater: () =>
    queryOptions<{ success: boolean; kandidat_saker: KandidatKOE[] }, Error>({
      queryKey: endringsordreKeys.kandidater(),
      queryFn: fetchKandidatKOESaker,
      staleTime: STALE_TIME.EXTENDED,
    }),
};
