/**
 * Integration Types
 *
 * TypeScript types for Dalux-Catenda sync integration.
 * Mirrors backend Pydantic models in backend/models/sync_models.py
 */

/**
 * Task filter configuration for sync mapping.
 * Used to exclude specific task types from synchronization.
 */
export interface TaskFilterConfig {
  exclude_types?: string[];
}

/**
 * Dalux-Catenda sync mapping configuration.
 * Links a Dalux project to a Catenda BCF board.
 */
export interface SyncMapping {
  id?: string;
  project_id: string;
  dalux_project_id: string;
  dalux_base_url: string;
  catenda_project_id: string;
  catenda_board_id: string;
  sync_enabled: boolean;
  sync_interval_minutes: number;
  task_filters?: TaskFilterConfig;
  last_sync_at?: string;
  last_sync_status?: 'success' | 'failed' | 'partial';
  last_sync_error?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Request to create a new sync mapping.
 */
export interface CreateSyncMappingRequest {
  project_id: string;
  dalux_project_id: string;
  dalux_base_url: string;
  catenda_project_id: string;
  catenda_board_id: string;
  sync_enabled?: boolean;
  sync_interval_minutes?: number;
}

/**
 * Request to update an existing sync mapping.
 */
export interface UpdateSyncMappingRequest {
  sync_enabled?: boolean;
  sync_interval_minutes?: number;
  catenda_board_id?: string;
}

/**
 * Individual task sync record.
 * Tracks sync state for a single Dalux task.
 */
export interface TaskSyncRecord {
  id: string;
  sync_mapping_id: string;
  dalux_task_id: string;
  catenda_topic_guid: string;
  dalux_updated_at: string;
  catenda_updated_at: string;
  sync_status: 'synced' | 'pending' | 'failed';
  last_error?: string;
  retry_count: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Result of a single task sync operation.
 */
export interface TaskSyncResult {
  success: boolean;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  dalux_task_id: string;
  catenda_topic_guid?: string;
  error?: string;
  attachments_synced: number;
}

/**
 * Result of a full sync operation.
 */
export interface SyncResult {
  success: boolean;
  status: 'success' | 'partial' | 'failed';
  sync_mapping_id: string;
  tasks_processed: number;
  tasks_created: number;
  tasks_updated: number;
  tasks_skipped: number;
  tasks_failed: number;
  attachments_synced: number;
  errors: string[];
  task_results: TaskSyncResult[];
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
}

/**
 * Response from list mappings endpoint.
 */
export interface SyncMappingsResponse {
  mappings: SyncMapping[];
}

/**
 * Response from sync history endpoint.
 */
export interface SyncHistoryResponse {
  records: TaskSyncRecord[];
  summary: {
    synced: number;
    pending: number;
    failed: number;
    total: number;
  };
}

/**
 * Response from validation endpoint.
 */
export interface SyncValidationResponse {
  valid: boolean;
  dalux_ok: boolean;
  catenda_ok: boolean;
  errors: string[];
}

/**
 * Response from trigger sync endpoint.
 */
export interface TriggerSyncResponse {
  status: 'started';
  mapping_id: string;
  full_sync: boolean;
  message: string;
}

/**
 * SSE sync progress event data.
 */
export interface SyncProgressEvent {
  status: 'idle' | 'starting' | 'running' | 'completed' | 'error';
  sync_mapping_id?: string;
  full_sync?: boolean;
  tasks_processed?: number;
  tasks_created?: number;
  tasks_updated?: number;
  tasks_skipped?: number;
  tasks_failed?: number;
  duration_seconds?: number;
  error?: string;
  message?: string;
}

/**
 * Response from filter-options endpoint.
 * Lists available task types from Dalux.
 */
export interface FilterOptionsResponse {
  types: string[];
  total_tasks: number;
}
