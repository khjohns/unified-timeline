/**
 * useConnectionStatus Hook
 *
 * Monitors backend and Catenda connection status.
 * Polls health endpoints periodically and provides real-time status.
 */

import { useState, useEffect, useCallback } from 'react';

export type ConnectionState = 'connected' | 'disconnected' | 'checking' | 'unconfigured';

export interface ConnectionStatus {
  backend: ConnectionState;
  catenda: ConnectionState;
  lastChecked: Date | null;
}

interface HealthResponse {
  status: string;
  service?: string;
  message?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const POLL_INTERVAL = 30000; // 30 seconds

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    backend: 'checking',
    catenda: 'checking',
    lastChecked: null,
  });

  const checkBackendHealth = useCallback(async (): Promise<ConnectionState> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data: HealthResponse = await response.json();
        return data.status === 'healthy' ? 'connected' : 'disconnected';
      }
      return 'disconnected';
    } catch {
      return 'disconnected';
    }
  }, []);

  const checkCatendaHealth = useCallback(async (): Promise<ConnectionState> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health/catenda`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data: HealthResponse = await response.json();
        if (data.status === 'connected') return 'connected';
        if (data.status === 'unconfigured') return 'unconfigured';
        return 'disconnected';
      }
      return 'disconnected';
    } catch {
      return 'disconnected';
    }
  }, []);

  const checkAll = useCallback(async () => {
    setStatus((prev) => ({
      ...prev,
      backend: prev.backend === 'disconnected' ? 'checking' : prev.backend,
      catenda: prev.catenda === 'disconnected' ? 'checking' : prev.catenda,
    }));

    const [backendState, catendaState] = await Promise.all([
      checkBackendHealth(),
      checkCatendaHealth(),
    ]);

    setStatus({
      backend: backendState,
      catenda: catendaState,
      lastChecked: new Date(),
    });
  }, [checkBackendHealth, checkCatendaHealth]);

  // Initial check and polling
  useEffect(() => {
    checkAll();

    const interval = setInterval(checkAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkAll]);

  return {
    ...status,
    refresh: checkAll,
  };
}
