/**
 * useVerifyToken Hook
 *
 * Shared hook for verifying magic link tokens.
 * Used by useSubmitEvent and other components that need to validate tokens before operations.
 */

import { useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/**
 * Hook for verifying magic link tokens.
 * Returns a memoized function that checks if a token is valid.
 *
 * @example
 * ```tsx
 * const verifyToken = useVerifyToken();
 *
 * const handleSubmit = async () => {
 *   const token = getAuthToken();
 *   if (!token) throw new Error('TOKEN_MISSING');
 *
 *   const isValid = await verifyToken(token);
 *   if (!isValid) throw new Error('TOKEN_EXPIRED');
 *
 *   // Proceed with submission...
 * };
 * ```
 */
export function useVerifyToken() {
  return useCallback(async (token: string): Promise<boolean> => {
    // Bypass verification when auth is disabled
    if (import.meta.env.VITE_DISABLE_AUTH === 'true') {
      return true;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/magic-link/verify?token=${token}`);
      return response.ok;
    } catch {
      return false;
    }
  }, []);
}
