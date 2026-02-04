/**
 * useSyncProgress Hook
 *
 * React hook for real-time sync progress via Server-Sent Events (SSE).
 * Connects to /api/sync/mappings/{id}/progress for live updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSyncProgressUrl } from '../api/sync';
import type { SyncProgressEvent, SyncResult } from '../types/integration';

export interface SyncProgressState {
  /** Current sync status */
  status: 'idle' | 'connecting' | 'running' | 'completed' | 'error';
  /** Whether SSE connection is active */
  isConnected: boolean;
  /** Progress data from sync */
  progress: {
    tasks_processed: number;
    tasks_created: number;
    tasks_updated: number;
    tasks_skipped: number;
    tasks_failed: number;
  };
  /** Final result when completed */
  result?: SyncResult;
  /** Error message if failed */
  error?: string;
  /** Sync duration in seconds */
  duration?: number;
}

const initialProgress = {
  tasks_processed: 0,
  tasks_created: 0,
  tasks_updated: 0,
  tasks_skipped: 0,
  tasks_failed: 0,
};

/**
 * Hook for streaming sync progress via SSE.
 *
 * @param mappingId - The mapping ID to monitor
 * @param enabled - Whether to connect (default true)
 * @returns Sync progress state
 *
 * @example
 * ```tsx
 * const { status, progress, isConnected, error, disconnect } = useSyncProgress(mappingId);
 *
 * if (status === 'running') {
 *   return <ProgressBar value={progress.tasks_processed} />;
 * }
 * ```
 */
export function useSyncProgress(
  mappingId: string | null,
  enabled: boolean = true
): SyncProgressState & { disconnect: () => void } {
  const [state, setState] = useState<SyncProgressState>({
    status: 'idle',
    isConnected: false,
    progress: initialProgress,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, isConnected: false }));
    }
  }, []);

  useEffect(() => {
    // Don't connect if disabled or no mapping ID
    if (!enabled || !mappingId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Cleanup for disabled state
      disconnect();
      return;
    }

    // Create SSE connection
    const url = getSyncProgressUrl(mappingId);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    setState((prev) => ({ ...prev, status: 'connecting' }));

    // Connection opened
    eventSource.onopen = () => {
      setState((prev) => ({
        ...prev,
        status: 'running',
        isConnected: true,
        error: undefined,
      }));
    };

    // Generic message handler (for simple data events)
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SyncProgressEvent;

        if (data.status === 'idle') {
          setState((prev) => ({
            ...prev,
            status: 'idle',
            error: data.message,
          }));
          eventSource.close();
          return;
        }

        if (data.status === 'completed') {
          setState((prev) => ({
            ...prev,
            status: 'completed',
          }));
          eventSource.close();
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e);
      }
    };

    // Specific event handlers
    eventSource.addEventListener('sync.started', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        status: 'running',
        progress: initialProgress,
        result: undefined,
        error: undefined,
      }));
    });

    eventSource.addEventListener('sync.progress', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        progress: {
          tasks_processed: data.tasks_processed ?? prev.progress.tasks_processed,
          tasks_created: data.tasks_created ?? prev.progress.tasks_created,
          tasks_updated: data.tasks_updated ?? prev.progress.tasks_updated,
          tasks_skipped: data.tasks_skipped ?? prev.progress.tasks_skipped,
          tasks_failed: data.tasks_failed ?? prev.progress.tasks_failed,
        },
      }));
    });

    eventSource.addEventListener('sync.completed', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as SyncResult;
      setState((prev) => ({
        ...prev,
        status: 'completed',
        result: data,
        progress: {
          tasks_processed: data.tasks_processed,
          tasks_created: data.tasks_created,
          tasks_updated: data.tasks_updated,
          tasks_skipped: data.tasks_skipped,
          tasks_failed: data.tasks_failed,
        },
        duration: data.duration_seconds,
      }));
      eventSource.close();
    });

    eventSource.addEventListener('sync.error', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: data.error,
      }));
      eventSource.close();
    });

    // Connection error
    eventSource.onerror = () => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
      }));
      // Don't set error state here - SSE auto-reconnects
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [mappingId, enabled, disconnect]);

  return { ...state, disconnect };
}
