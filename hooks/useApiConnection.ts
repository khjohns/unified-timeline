/**
 * Custom hook for checking API connectivity
 *
 * Performs health check on mount to determine if backend is available.
 * Returns null initially (unknown state), then true/false after check completes.
 *
 * @returns Object with API connection status
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { logger } from '../utils/logger';

export interface UseApiConnectionReturn {
  isApiConnected: boolean | null;
}

/**
 * Custom hook for checking API connectivity
 *
 * Checks if the backend API is available by calling the health check endpoint.
 * Useful for determining if the application should operate in online or offline mode.
 *
 * States:
 * - null: Initial state, health check not yet completed
 * - true: API is connected and responding
 * - false: API is not available (offline mode)
 *
 * @returns Object with isApiConnected status
 */
export const useApiConnection = (): UseApiConnectionReturn => {
  const [isApiConnected, setIsApiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        const connected = await api.healthCheck();
        setIsApiConnected(connected);

        if (!connected) {
          logger.warn('API server not available - running in offline mode');
        } else {
          logger.log('✓ API server connected');
        }
      } catch (error) {
        logger.error('Error checking API connection:', error);
        setIsApiConnected(false);
      }
    };

    checkApiConnection();
  }, []);

  return { isApiConnected };
};
