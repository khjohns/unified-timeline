/**
 * useDaluxData Hooks
 *
 * React Query hooks for fetching Dalux data (tasks and forms)
 * through sync mapping endpoints.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchDaluxTasks, fetchDaluxForms } from '../api/dalux';
import type { DaluxTasksResponse, DaluxFormsResponse } from '../types/dalux';
import { STALE_TIME } from '../constants/queryConfig';

// ============================================================
// Query Keys
// ============================================================

export const daluxQueryKeys = {
  all: ['dalux'] as const,
  tasks: (mappingId: string) => [...daluxQueryKeys.all, 'tasks', mappingId] as const,
  forms: (mappingId: string) => [...daluxQueryKeys.all, 'forms', mappingId] as const,
};

// ============================================================
// Queries
// ============================================================

/**
 * Fetch Dalux tasks for a sync mapping.
 *
 * @param mappingId - The sync mapping ID
 * @param limit - Maximum number of tasks to return (default 100)
 */
export function useDaluxTasks(mappingId: string, limit: number = 100) {
  return useQuery<DaluxTasksResponse, Error>({
    queryKey: [...daluxQueryKeys.tasks(mappingId), limit],
    queryFn: () => fetchDaluxTasks(mappingId, limit),
    enabled: !!mappingId,
    staleTime: STALE_TIME.DEFAULT,
  });
}

/**
 * Fetch Dalux forms for a sync mapping.
 *
 * @param mappingId - The sync mapping ID
 * @param limit - Maximum number of forms to return (default 100)
 */
export function useDaluxForms(mappingId: string, limit: number = 100) {
  return useQuery<DaluxFormsResponse, Error>({
    queryKey: [...daluxQueryKeys.forms(mappingId), limit],
    queryFn: () => fetchDaluxForms(mappingId, limit),
    enabled: !!mappingId,
    staleTime: STALE_TIME.DEFAULT,
  });
}
