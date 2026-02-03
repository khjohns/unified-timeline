/**
 * useCatendaStatusHandler Hook
 *
 * Handles different Catenda sync statuses with appropriate user feedback.
 * Replaces the generic "not synced" warning with status-specific toasts.
 *
 * Status handling:
 * - `catenda_disabled`: Silent (expected behavior, no notification)
 * - `no_topic_id`: Info toast (case not connected to Catenda)
 * - `not_authenticated`: Warning toast (auth expired)
 * - `error`: Warning toast + onWarning callback (sync failed)
 */

import { useCallback } from 'react';
import { useToast } from '../components/primitives';

/**
 * Common shape for Catenda sync status in API responses.
 * Works with EventSubmitResponse, OpprettForseringResponse, etc.
 */
interface CatendaSyncResult {
  catenda_synced?: boolean;
  catenda_skipped_reason?: 'no_topic_id' | 'not_authenticated' | 'error' | 'catenda_disabled' | 'no_client' | 'sync_not_attempted';
}

type CatendaSkippedReason = NonNullable<CatendaSyncResult['catenda_skipped_reason']>;

interface UseCatendaStatusHandlerOptions {
  /**
   * Callback for backward compatibility with modals that show warnings.
   * Called for 'error' and 'not_authenticated' statuses.
   */
  onWarning?: () => void;
}

interface CatendaStatusHandler {
  /**
   * Handle the Catenda sync status from an API response.
   * Shows appropriate toast messages based on the status.
   * Works with any response that includes catenda_synced and catenda_skipped_reason fields.
   */
  handleCatendaStatus: (result: CatendaSyncResult) => void;
}

/**
 * Hook for handling Catenda sync status feedback.
 *
 * @example
 * ```tsx
 * const { handleCatendaStatus } = useCatendaStatusHandler({
 *   onWarning: onCatendaWarning,
 * });
 *
 * // In onSuccess:
 * handleCatendaStatus(result);
 * ```
 */
export function useCatendaStatusHandler(
  options: UseCatendaStatusHandlerOptions = {}
): CatendaStatusHandler {
  const { onWarning } = options;
  const toast = useToast();

  const handleCatendaStatus = useCallback(
    (result: CatendaSyncResult) => {
      // If synced successfully or no catenda_synced field, no action needed
      if (result.catenda_synced === true || result.catenda_synced === undefined) {
        return;
      }

      const reason: CatendaSkippedReason | undefined = result.catenda_skipped_reason;

      switch (reason) {
        case 'catenda_disabled':
          // Silent - this is expected behavior when Catenda integration is disabled
          break;

        case 'no_topic_id':
          // Case is not connected to Catenda - informational
          toast.info(
            'Ikke koblet til Catenda',
            'Saken mangler Catenda-kobling. Endringen er lagret lokalt.'
          );
          break;

        case 'not_authenticated':
          // Authentication expired - user needs to re-authenticate
          toast.warning(
            'Catenda-autentisering utløpt',
            'Endringen er lagret, men ble ikke synkronisert. Logg inn på nytt i Catenda.'
          );
          onWarning?.();
          break;

        case 'error':
          // Sync failed - unexpected error
          toast.warning(
            'Synkronisering feilet',
            'Endringen er lagret lokalt, men ble ikke synkronisert til Catenda.'
          );
          onWarning?.();
          break;

        case 'no_client':
        case 'sync_not_attempted':
          // Forsering-specific reasons - silent (similar to catenda_disabled)
          break;

        default:
          // Unknown reason or missing reason - show generic warning for backward compatibility
          if (result.catenda_synced === false) {
            toast.info(
              'Ikke synkronisert til Catenda',
              'Endringen er lagret lokalt.'
            );
            onWarning?.();
          }
      }
    },
    [toast, onWarning]
  );

  return { handleCatendaStatus };
}
