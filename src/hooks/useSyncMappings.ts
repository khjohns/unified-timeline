/**
 * useSyncMappings Hooks
 *
 * React Query hooks for Dalux-Catenda sync management.
 * Provides CRUD operations, sync triggers, and history fetching.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSyncMappings,
  fetchSyncMapping,
  createSyncMapping,
  updateSyncMapping,
  deleteSyncMapping,
  triggerSync,
  fetchSyncHistory,
  testConnection,
} from '../api/sync';
import type {
  SyncMapping,
  CreateSyncMappingRequest,
  UpdateSyncMappingRequest,
  SyncMappingsResponse,
  SyncHistoryResponse,
} from '../types/integration';
import { STALE_TIME } from '../constants/queryConfig';

// ============================================================
// Query Keys
// ============================================================

export const syncQueryKeys = {
  all: ['sync'] as const,
  mappings: () => [...syncQueryKeys.all, 'mappings'] as const,
  mapping: (id: string) => [...syncQueryKeys.mappings(), id] as const,
  history: (id: string) => [...syncQueryKeys.all, 'history', id] as const,
};

// ============================================================
// Queries
// ============================================================

/**
 * Fetch all sync mappings.
 *
 * @param projectId - Optional filter by project ID
 * @param enabledOnly - Only return enabled mappings
 */
export function useSyncMappings(projectId?: string, enabledOnly: boolean = false) {
  return useQuery<SyncMappingsResponse, Error>({
    queryKey: [...syncQueryKeys.mappings(), projectId, enabledOnly],
    queryFn: () => fetchSyncMappings(projectId, enabledOnly),
    staleTime: STALE_TIME.DEFAULT,
  });
}

/**
 * Fetch a single sync mapping by ID.
 */
export function useSyncMapping(id: string, enabled: boolean = true) {
  return useQuery<SyncMapping, Error>({
    queryKey: syncQueryKeys.mapping(id),
    queryFn: () => fetchSyncMapping(id),
    enabled: !!id && enabled,
    staleTime: STALE_TIME.DEFAULT,
  });
}

/**
 * Fetch sync history for a mapping.
 *
 * @param id - Mapping ID
 * @param limit - Max records to return
 * @param status - Filter by status
 */
export function useSyncHistory(
  id: string,
  limit: number = 50,
  status?: 'synced' | 'pending' | 'failed'
) {
  return useQuery<SyncHistoryResponse, Error>({
    queryKey: [...syncQueryKeys.history(id), limit, status],
    queryFn: () => fetchSyncHistory(id, limit, status),
    enabled: !!id,
    staleTime: STALE_TIME.DEFAULT,
  });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new sync mapping.
 */
export function useCreateSyncMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSyncMappingRequest) => createSyncMapping(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mappings() });
    },
  });
}

/**
 * Update an existing sync mapping.
 */
export function useUpdateSyncMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateSyncMappingRequest }) =>
      updateSyncMapping(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mapping(variables.id) });
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mappings() });
    },
  });
}

/**
 * Delete a sync mapping.
 */
export function useDeleteSyncMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSyncMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mappings() });
    },
  });
}

/**
 * Trigger a manual sync.
 */
export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fullSync }: { id: string; fullSync?: boolean }) =>
      triggerSync(id, fullSync ?? false),
    onSuccess: (_, variables) => {
      // Invalidate mapping to refresh last_sync_at when done
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mapping(variables.id) });
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mappings() });
    },
  });
}

/**
 * Toggle sync enabled/disabled.
 */
export function useToggleSyncEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateSyncMapping(id, { sync_enabled: enabled }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mapping(variables.id) });
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mappings() });
    },
  });
}

/**
 * Test connection for a mapping.
 */
export function useTestConnection() {
  return useMutation({
    mutationFn: (id: string) => testConnection(id),
  });
}
