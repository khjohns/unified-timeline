/**
 * Cases API
 *
 * Handles fetching the list of all cases.
 */

import { apiFetch } from './client';
import { CaseListResponse } from '../types/api';

/**
 * Fetch all cases
 *
 * @param sakstype - Optional filter by case type
 * @returns List of all cases with metadata
 */
export async function fetchCaseList(sakstype?: string): Promise<CaseListResponse> {
  const params = sakstype ? `?sakstype=${encodeURIComponent(sakstype)}` : '';
  return apiFetch<CaseListResponse>(`/api/cases${params}`);
}
