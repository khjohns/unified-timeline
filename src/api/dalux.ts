/**
 * Dalux API Client
 *
 * Functions for fetching Dalux data through the sync mapping endpoints.
 */

import { apiFetch } from './client';
import type { DaluxTasksResponse, DaluxFormsResponse } from '../types/dalux';

/**
 * Fetch Dalux tasks for a sync mapping.
 */
export async function fetchDaluxTasks(
  mappingId: string,
  limit: number = 100
): Promise<DaluxTasksResponse> {
  return apiFetch<DaluxTasksResponse>(
    `/api/sync/mappings/${mappingId}/tasks?limit=${limit}`
  );
}

/**
 * Fetch Dalux forms for a sync mapping.
 */
export async function fetchDaluxForms(
  mappingId: string,
  limit: number = 100
): Promise<DaluxFormsResponse> {
  return apiFetch<DaluxFormsResponse>(
    `/api/sync/mappings/${mappingId}/forms?limit=${limit}`
  );
}
