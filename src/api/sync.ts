/**
 * Sync API Client
 *
 * API functions for Dalux-Catenda sync management.
 * Uses apiFetch from client.ts for consistent auth and error handling.
 */

import { apiFetch } from './client';
import type {
  SyncMapping,
  CreateSyncMappingRequest,
  UpdateSyncMappingRequest,
  SyncMappingsResponse,
  SyncHistoryResponse,
  SyncValidationResponse,
  TriggerSyncResponse,
} from '../types/integration';

// ============================================================
// CRUD Operations
// ============================================================

/**
 * List all sync mappings.
 *
 * @param projectId - Optional filter by project ID
 * @param enabledOnly - Only return enabled mappings
 */
export async function fetchSyncMappings(
  projectId?: string,
  enabledOnly: boolean = false
): Promise<SyncMappingsResponse> {
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId);
  if (enabledOnly) params.set('enabled_only', 'true');

  const queryString = params.toString();
  const endpoint = queryString ? `/api/sync/mappings?${queryString}` : '/api/sync/mappings';

  return apiFetch<SyncMappingsResponse>(endpoint);
}

/**
 * Get a single sync mapping by ID.
 */
export async function fetchSyncMapping(id: string): Promise<SyncMapping> {
  return apiFetch<SyncMapping>(`/api/sync/mappings/${id}`);
}

/**
 * Create a new sync mapping.
 */
export async function createSyncMapping(
  data: CreateSyncMappingRequest
): Promise<SyncMapping> {
  return apiFetch<SyncMapping>('/api/sync/mappings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing sync mapping.
 */
export async function updateSyncMapping(
  id: string,
  updates: UpdateSyncMappingRequest
): Promise<SyncMapping> {
  return apiFetch<SyncMapping>(`/api/sync/mappings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a sync mapping.
 */
export async function deleteSyncMapping(id: string): Promise<void> {
  await apiFetch<void>(`/api/sync/mappings/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================
// Sync Operations
// ============================================================

/**
 * Trigger a manual sync.
 *
 * @param id - Mapping ID
 * @param fullSync - If true, sync all tasks; otherwise only changes
 */
export async function triggerSync(
  id: string,
  fullSync: boolean = false
): Promise<TriggerSyncResponse> {
  return apiFetch<TriggerSyncResponse>(`/api/sync/mappings/${id}/trigger`, {
    method: 'POST',
    body: JSON.stringify({ full_sync: fullSync }),
  });
}

/**
 * Get sync history for a mapping.
 *
 * @param id - Mapping ID
 * @param limit - Max records to return
 * @param status - Filter by status (synced/pending/failed)
 */
export async function fetchSyncHistory(
  id: string,
  limit: number = 50,
  status?: 'synced' | 'pending' | 'failed'
): Promise<SyncHistoryResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (status) params.set('status', status);

  return apiFetch<SyncHistoryResponse>(
    `/api/sync/mappings/${id}/history?${params.toString()}`
  );
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate sync configuration without creating a mapping.
 */
export async function validateSyncConfig(config: {
  dalux_project_id: string;
  dalux_base_url: string;
  catenda_project_id: string;
  catenda_board_id: string;
}): Promise<SyncValidationResponse> {
  return apiFetch<SyncValidationResponse>('/api/sync/validate', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/**
 * Test connections for an existing mapping.
 */
export async function testConnection(
  id: string
): Promise<{ dalux_ok: boolean; catenda_ok: boolean; errors: string[] }> {
  return apiFetch<{ dalux_ok: boolean; catenda_ok: boolean; errors: string[] }>(
    `/api/sync/mappings/${id}/test`,
    { method: 'POST' }
  );
}

// ============================================================
// SSE Progress URL Helper
// ============================================================

/**
 * Get the SSE endpoint URL for sync progress.
 * Use with EventSource directly.
 */
export function getSyncProgressUrl(mappingId: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  return `${baseUrl}/api/sync/mappings/${mappingId}/progress`;
}
