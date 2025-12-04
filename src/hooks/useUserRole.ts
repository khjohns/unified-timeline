/**
 * useUserRole Hook
 *
 * Manages user role selection for testing purposes.
 * Persists selection in localStorage to maintain state across page reloads.
 */

import { useState, useEffect } from 'react';

export type UserRole = 'TE' | 'BH';

const STORAGE_KEY = 'unified-timeline-user-role';

/**
 * Hook to manage and persist user role selection
 * Defaults to 'TE' if no stored value exists
 */
export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole>(() => {
    // Initialize from localStorage if available
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'TE' || stored === 'BH') ? stored : 'TE';
  });

  // Persist to localStorage whenever role changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, userRole);
  }, [userRole]);

  return {
    userRole,
    setUserRole,
    isTE: userRole === 'TE',
    isBH: userRole === 'BH',
  };
}
