/**
 * Custom hook for loading case data and managing authentication flow
 *
 * This is the most complex hook - it handles:
 * 1. Magic token verification
 * 2. Loading case data from API
 * 3. Setting role based on modus
 * 4. Managing loading and error states
 *
 * @param params - Configuration parameters
 * @returns Form data, handlers, and loading states
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FormDataModel, Role } from '../types';
import { api, Modus } from '../services/api';
import { logger } from '../utils/logger';
import { showToast } from '../utils/toastHelpers';
import { INITIAL_FORM_DATA } from '../config';
import { getRoleFromModus, getTabIndexFromModus } from '../utils/modusHelpers';

export interface UseCaseLoaderParams {
  magicToken: string | null;
  sakId: string | null;
  modus: Modus | null;
  topicGuid: string | null;
  isFromMagicLink: boolean;
  isApiConnected: boolean | null;
  clearMagicToken: () => void;
  loadedData: FormDataModel | null; // From useAutoSave
  setToastMessage: (message: string) => void;
}

export interface UseCaseLoaderReturn {
  formData: FormDataModel;
  setFormData: (data: FormDataModel | ((prev: FormDataModel) => FormDataModel)) => void;
  internalSakId: string | null;
  topicGuid: string | null;
  isLoading: boolean;
  apiError: string | null;
  activeTab: number;
  setActiveTab: (tab: number) => void;
}

/**
 * Custom hook for loading case data and managing authentication flow
 *
 * Combines magic token verification, case data loading, and role management
 * into a single cohesive hook.
 */
export const useCaseLoader = (params: UseCaseLoaderParams): UseCaseLoaderReturn => {
  const {
    magicToken,
    sakId,
    modus,
    topicGuid: initialTopicGuid,
    isFromMagicLink,
    isApiConnected,
    clearMagicToken,
    loadedData,
    setToastMessage,
  } = params;

  const [searchParams, setSearchParams] = useSearchParams();

  // Internal state
  const [formData, setFormData] = useState<FormDataModel>(INITIAL_FORM_DATA);
  const [internalSakId, setInternalSakId] = useState<string | null>(() => {
    // Initialize from sessionStorage if available (HMR resilience)
    const savedSakId = sessionStorage.getItem('currentSakId');
    if (isFromMagicLink && savedSakId) {
      return savedSakId;
    }
    return sakId;
  });
  const [topicGuid, setTopicGuid] = useState<string | null>(initialTopicGuid);
  const [isLoading, setIsLoading] = useState(!!magicToken);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(modus ? getTabIndexFromModus(modus) : 0);

  // Effect 1: Verify magic token
  useEffect(() => {
    let isMounted = true;

    const verifyToken = async () => {
      if (!magicToken || isApiConnected === false) return;

      setIsLoading(true);
      setApiError(null);

      // Clear localStorage when using magic link to prevent old data from interfering
      localStorage.removeItem('koe_v5_0_draft');

      try {
        const response = await api.verifyMagicToken(magicToken);

        if (!isMounted) return;

        if (response.success && response.data?.sakId) {
          const sakId = response.data.sakId;
          setInternalSakId(sakId);

          // Store sakId in sessionStorage to survive HMR reloads
          sessionStorage.setItem('currentSakId', sakId);

          // Clean the URL, remove the token
          clearMagicToken();
        } else {
          setApiError(response.error || 'Lenken er ugyldig eller utløpt.');
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          logger.error('Magic token verification error:', error);
          setApiError('Feil ved verifisering av lenke');
          setIsLoading(false);
        }
      }
    };

    if (magicToken && isApiConnected) {
      verifyToken();
    }

    return () => {
      isMounted = false;
    };
  }, [magicToken, isApiConnected, clearMagicToken]);

  // Effect 2: Load data from API when sakId is available
  useEffect(() => {
    let isMounted = true;

    const loadFromApi = async () => {
      if (!internalSakId) return;

      // Only start loading if not already loading from token verification
      if (!magicToken) setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.getCase(internalSakId, modus || undefined);

        if (!isMounted) return;

        if (response.success && response.data) {
          // Ensure rolle is set (defensive programming)
          const loadedFormData = response.data.formData;
          if (!loadedFormData.rolle) {
            loadedFormData.rolle = 'TE';
          }

          // Set rolle based on modus if modus is provided
          if (modus) {
            loadedFormData.rolle = getRoleFromModus(modus);
          }

          // Mark magic link as consumed in sessionStorage
          sessionStorage.setItem('isFromMagicLink', 'consumed');

          setFormData(loadedFormData);
          setTopicGuid(response.data.topicGuid);

          // If modus is not in URL (e.g. from magic link), set it from loaded data
          const loadedModus = loadedFormData.sak?.modus as Modus | undefined;
          if (!modus && loadedModus) {
            searchParams.set('modus', loadedModus);
            setSearchParams(searchParams, { replace: true });
          }

          // Set initial tab based on modus
          setActiveTab(getTabIndexFromModus(modus));

          showToast(setToastMessage, `Sak ${internalSakId} lastet fra server`);
        } else {
          setApiError(response.error || 'Kunne ikke laste sak');

          // Only use localStorage as fallback if we're not coming from a magic link
          if (loadedData && !isFromMagicLink) {
            setFormData(loadedData);
            showToast(setToastMessage, 'API ikke tilgjengelig - bruker lokal lagring');
          }
        }
      } catch (error) {
        if (isMounted) {
          logger.error('Failed to load from API:', error);
          setApiError('Nettverksfeil ved lasting av sak');

          // Only use localStorage as fallback if we're not coming from a magic link
          if (loadedData && !isFromMagicLink) {
            setFormData(loadedData);
          }
        }
      } finally {
        // CRITICAL FIX: Always turn off loading when done, regardless of success/fail
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (internalSakId && isApiConnected === true) {
      loadFromApi();
    } else if (!internalSakId && !isFromMagicLink && loadedData && isApiConnected !== null) {
      // No sakId and not using magic link - load from localStorage
      setFormData(loadedData);
    }

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalSakId, isApiConnected]);

  // Effect 3: Set role and tab when modus changes (fallback for when data isn't loaded from API)
  useEffect(() => {
    // Skip if loading, if we have a sakId (role is set during API load), or if we came from magic link
    if (isLoading || internalSakId || isFromMagicLink) {
      return;
    }

    if (modus) {
      const newRole = getRoleFromModus(modus);
      if (formData.rolle !== newRole) {
        setFormData(prev => ({ ...prev, rolle: newRole }));
      }

      // Set initial tab based on modus
      setActiveTab(getTabFromModus(modus));
    }
  }, [modus, formData.rolle, isLoading, internalSakId, isFromMagicLink]);

  return {
    formData,
    setFormData,
    internalSakId,
    topicGuid,
    isLoading,
    apiError,
    activeTab,
    setActiveTab,
  };
};
