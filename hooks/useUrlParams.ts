/**
 * Custom hook for URL parameter management
 *
 * Handles:
 * - Reading URL parameters (magicToken, sakId, modus, topicGuid)
 * - Tracking magic link usage via sessionStorage (HMR-safe)
 * - Clearing magic token after verification
 *
 * @returns URL parameters and helper functions
 */

import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modus } from '../services/api';

export interface UseUrlParamsReturn {
  magicToken: string | null;
  sakId: string | null;
  modus: Modus | null;
  topicGuid: string | null;
  isFromMagicLink: boolean;
  clearMagicToken: () => void;
}

/**
 * Custom hook for URL parameter management
 *
 * Extracts and manages URL parameters for the KOE application workflow.
 * Tracks magic link usage in sessionStorage to survive HMR (Hot Module Replacement) reloads.
 *
 * URL Parameters:
 * - magicToken: One-time token for authentication (from email)
 * - sakId: Direct case ID access (for older links)
 * - modus: Workflow mode (varsel, koe, svar, revidering)
 * - topicGuid: Catenda topic GUID (from webhook)
 *
 * @returns URL parameters and helper functions
 */
export const useUrlParams = (): UseUrlParamsReturn => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract URL parameters
  const magicToken = searchParams.get('magicToken');
  const sakId = searchParams.get('sakId'); // For direct access or older links
  const modus = searchParams.get('modus') as Modus | null;
  const topicGuid = searchParams.get('topicGuid'); // From Catenda webhook

  // Track if user came from magic link using sessionStorage to persist across HMR reloads
  // Check sessionStorage first (both 'true' and 'consumed' count), then check if magicToken is in URL
  const sessionValue = sessionStorage.getItem('isFromMagicLink');
  const isFromMagicLinkRef = useRef(
    sessionValue === 'true' || sessionValue === 'consumed' || !!magicToken
  );

  // Store in sessionStorage if we have a magicToken
  if (magicToken && sessionValue !== 'true' && sessionValue !== 'consumed') {
    sessionStorage.setItem('isFromMagicLink', 'true');
    isFromMagicLinkRef.current = true;
  }

  /**
   * Clear magic token from URL
   *
   * Called after successful token verification to clean up the URL.
   * Marks token as 'consumed' in sessionStorage.
   */
  const clearMagicToken = () => {
    searchParams.delete('magicToken');
    setSearchParams(searchParams, { replace: true });
    sessionStorage.setItem('isFromMagicLink', 'consumed');
  };

  return {
    magicToken,
    sakId,
    modus,
    topicGuid,
    isFromMagicLink: isFromMagicLinkRef.current,
    clearMagicToken,
  };
};
