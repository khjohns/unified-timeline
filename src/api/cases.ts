/**
 * Cases API
 *
 * Handles fetching the list of all cases.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { CaseListResponse, CaseListItem } from '../types/api';
import { mockCaseList } from '@mocks';

/**
 * Fetch all cases
 *
 * @param sakstype - Optional filter by case type
 * @returns List of all cases with metadata
 */
export async function fetchCaseList(sakstype?: string): Promise<CaseListResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300);

    // Convert mock case list to CaseListItem format
    let cases: CaseListItem[] = mockCaseList.map((c) => ({
      sak_id: c.id,
      sakstype: (c.sakstype as 'standard' | 'forsering' | 'endringsordre') || 'standard',
      cached_title: c.title,
      cached_status: c.status,
      created_at: new Date().toISOString(),
      created_by: 'demo@example.com',
      last_event_at: new Date().toISOString(),
    }));

    // Filter by sakstype if provided
    if (sakstype) {
      cases = cases.filter((c) => c.sakstype === sakstype);
    }

    return { cases };
  }

  // Real API call
  const params = sakstype ? `?sakstype=${encodeURIComponent(sakstype)}` : '';
  return apiFetch<CaseListResponse>(`/api/cases${params}`);
}
