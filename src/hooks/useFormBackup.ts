/**
 * useFormBackup Hook
 *
 * Automatically backs up form data to localStorage to prevent data loss
 * when token expires or user accidentally closes the browser.
 */

import { useEffect, useCallback, useState } from 'react';

const STORAGE_PREFIX = 'koe-form-backup-';

export interface UseFormBackupResult<T> {
  /** Check if backup exists and return the data */
  getBackup: () => T | null;
  /** Clear the backup (call on successful submission) */
  clearBackup: () => void;
  /** Whether a backup exists for this form */
  hasBackup: boolean;
}

/**
 * Hook to backup form data to localStorage
 *
 * @param sakId - The case ID
 * @param eventType - The event type (used as part of storage key)
 * @param formData - Current form data to backup
 * @param isDirty - Whether the form has been modified
 * @returns Backup utilities
 *
 * @example
 * ```tsx
 * const { getBackup, clearBackup, hasBackup } = useFormBackup(
 *   sakId,
 *   'vederlag_krav_sendt',
 *   watch(),
 *   isDirty
 * );
 *
 * // On mount, check for backup
 * useEffect(() => {
 *   if (hasBackup) {
 *     const backup = getBackup();
 *     if (backup && confirm('Gjenopprette lagrede data?')) {
 *       reset(backup);
 *     }
 *   }
 * }, []);
 *
 * // On success, clear backup
 * onSuccess: () => {
 *   clearBackup();
 * }
 * ```
 */
export function useFormBackup<T extends Record<string, unknown>>(
  sakId: string,
  eventType: string,
  formData: T,
  isDirty: boolean
): UseFormBackupResult<T> {
  const storageKey = `${STORAGE_PREFIX}${sakId}_${eventType}`;
  // Initialize with actual localStorage state to avoid effect-based setState
  const [hasBackup, setHasBackup] = useState(() => {
    try {
      return !!localStorage.getItem(storageKey);
    } catch {
      return false;
    }
  });

  // Save form data when dirty - setState after localStorage write is intentional
  useEffect(() => {
    if (isDirty && formData && Object.keys(formData).length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(formData));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external storage
        setHasBackup(true);
      } catch (error) {
        console.warn('Failed to backup form data:', error);
      }
    }
  }, [formData, isDirty, storageKey]);

  // Get backup data
  const getBackup = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Failed to parse backup data:', error);
      return null;
    }
  }, [storageKey]);

  // Clear backup (call on successful submission)
  const clearBackup = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasBackup(false);
  }, [storageKey]);

  return { getBackup, clearBackup, hasBackup };
}
