import { useEffect, useRef } from 'react';
import { FormDataModel } from '../types';
import { INITIAL_FORM_DATA } from '../constants';
import { api } from '../services/api';
import { logger } from '../utils/logger';

interface UseAutoSaveOptions {
  data: FormDataModel;
  storageKey: string;
  debounceMs?: number;
  onSave?: () => void;
  sakId?: string | null; // For API persistence
  enableApiSave?: boolean; // Enable/disable API saving
}

/**
 * Custom hook for auto-saving form data to localStorage with debouncing
 *
 * Features:
 * - Loads saved data from localStorage on mount
 * - Auto-saves changes with configurable debounce
 * - Migrates old data structures to new format
 * - Skips save if data matches initial state
 *
 * @param options - Configuration options
 * @param options.data - Current form data to save
 * @param options.storageKey - localStorage key for saving/loading
 * @param options.debounceMs - Debounce delay in milliseconds (default: 1500)
 * @param options.onSave - Optional callback when save completes
 * @param options.sakId - Optional sakId for API persistence
 * @param options.enableApiSave - Enable/disable API saving (default: false)
 * @returns Loaded form data (or null if no saved data)
 */
export const useAutoSave = ({
  data,
  storageKey,
  debounceMs = 1500,
  onSave,
  sakId,
  enableApiSave = false,
}: UseAutoSaveOptions): FormDataModel | null => {
  const debounceTimeoutRef = useRef<number | null>(null);
  const loadedDataRef = useRef<FormDataModel | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        const parsedData = JSON.parse(savedDraft) as FormDataModel;

        // Ensure opprettet_dato exists
        if (!parsedData.sak.opprettet_dato) {
          parsedData.sak.opprettet_dato = new Date().toISOString().split('T')[0];
        }

        // Migrate old data structure to new revision-based structure
        if ((parsedData as any).koe && !parsedData.koe_revisjoner) {
          parsedData.koe_revisjoner = [(parsedData as any).koe];
          delete (parsedData as any).koe;
        }
        if ((parsedData as any).bh_svar && !parsedData.bh_svar_revisjoner) {
          parsedData.bh_svar_revisjoner = [(parsedData as any).bh_svar];
          delete (parsedData as any).bh_svar;
        }

        // Ensure new fields exist (for backwards compatibility)
        if (!parsedData.varsel.varsel_metode) {
          parsedData.varsel.varsel_metode = '';
        }
        if ((parsedData.varsel as any).signatur_te !== undefined) {
          delete (parsedData.varsel as any).signatur_te;
        }

        loadedDataRef.current = parsedData;
      }
    } catch (error) {
      logger.error('Failed to load draft from localStorage', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Auto-save with debounce on data change
  useEffect(() => {
    // Don't save if data matches initial state
    if (JSON.stringify(data) === JSON.stringify(INITIAL_FORM_DATA)) {
      return;
    }

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = window.setTimeout(async () => {
      try {
        // Always save to localStorage as fallback
        localStorage.setItem(storageKey, JSON.stringify(data));

        // Optionally save to API as well
        if (enableApiSave) {
          const response = await api.saveDraft(data, sakId || undefined);
          if (!response.success) {
            logger.warn('Failed to save draft to API:', response.error);
          }
        }

        onSave?.();
      } catch (error) {
        logger.error('Failed to save draft', error);
      }
    }, debounceMs);

    // Cleanup on unmount or before next effect
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [data, storageKey, debounceMs, onSave, sakId, enableApiSave]);

  return loadedDataRef.current;
};
