/**
 * useConnectionStatus Hook
 *
 * Monitors backend and Catenda connection status.
 * Uses a Context Provider to share status between all consumers,
 * ensuring only one polling interval runs regardless of how many
 * components use the hook.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ConnectionState = 'connected' | 'disconnected' | 'checking' | 'unconfigured' | 'disabled';

export interface ConnectionStatus {
  backend: ConnectionState;
  catenda: ConnectionState;
  catendaEnabled: boolean;
  lastChecked: Date | null;
  refresh: () => Promise<void>;
}

interface HealthResponse {
  status: string;
  service?: string;
  message?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const POLL_INTERVAL = 30000; // 30 seconds

const ConnectionStatusContext = createContext<ConnectionStatus | null>(null);

export function ConnectionStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Omit<ConnectionStatus, 'refresh'>>({
    backend: 'checking',
    catenda: 'checking',
    catendaEnabled: true,
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
        if (data.status === 'disabled') return 'disabled';
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
      catendaEnabled: catendaState !== 'disabled',
      lastChecked: new Date(),
    });
  }, [checkBackendHealth, checkCatendaHealth]);

  // Initial check and polling - runs only once for the entire app
  // Pauses when tab is hidden to avoid wasting bandwidth
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial fetch, then poll
    checkAll();

    let interval = setInterval(checkAll, POLL_INTERVAL);

    const handleVisibilityChange = () => {
      clearInterval(interval);
      if (!document.hidden) {
        checkAll();
        interval = setInterval(checkAll, POLL_INTERVAL);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkAll]);

  const value: ConnectionStatus = {
    ...status,
    refresh: checkAll,
  };

  return (
    <ConnectionStatusContext.Provider value={value}>
      {children}
    </ConnectionStatusContext.Provider>
  );
}

export function useConnectionStatus(): ConnectionStatus {
  const context = useContext(ConnectionStatusContext);
  if (!context) {
    throw new Error('useConnectionStatus must be used within a ConnectionStatusProvider');
  }
  return context;
}
