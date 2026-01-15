/**
 * useFravikSubmit Hook
 *
 * React Query mutation hook for fravik-specific actions.
 * Handles API calls and cache invalidation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  opprettFravikSoknad,
  leggTilMaskin,
  sendInnSoknad,
  oppdaterFravikSoknad,
} from '../api/fravik';
import type {
  SoknadOpprettetData,
  SoknadOppdatertData,
  MaskinData,
} from '../types/fravik';

// ========== TYPES ==========

interface OpprettAction {
  type: 'opprett';
  data: SoknadOpprettetData;
  aktor: string;
}

interface OppdaterAction {
  type: 'oppdater';
  sakId: string;
  data: SoknadOppdatertData;
  aktor: string;
  expectedVersion?: number;
}

interface LeggTilMaskinAction {
  type: 'legg_til_maskin';
  sakId: string;
  data: MaskinData;
  aktor: string;
  expectedVersion?: number;
}

interface SendInnAction {
  type: 'send_inn';
  sakId: string;
  aktor: string;
}

type FravikAction = OpprettAction | OppdaterAction | LeggTilMaskinAction | SendInnAction;

interface OpprettResult {
  type: 'opprett';
  sakId: string;
}

interface OppdaterResult {
  type: 'oppdater';
}

interface LeggTilMaskinResult {
  type: 'legg_til_maskin';
  maskinId: string;
}

interface SendInnResult {
  type: 'send_inn';
}

type FravikResult = OpprettResult | OppdaterResult | LeggTilMaskinResult | SendInnResult;

interface UseFravikSubmitOptions {
  onSuccess?: (result: FravikResult) => void;
  onError?: (error: Error) => void;
}

// ========== HOOK ==========

/**
 * Hook for submitting fravik actions with automatic cache invalidation
 *
 * @example
 * ```tsx
 * const mutation = useFravikSubmit({
 *   onSuccess: (result) => {
 *     if (result.type === 'opprett') {
 *       navigate(`/fravik/${result.sakId}`);
 *     }
 *   },
 * });
 *
 * mutation.mutate({
 *   type: 'opprett',
 *   data: formData,
 *   aktor: 'bruker@example.com',
 * });
 * ```
 */
export function useFravikSubmit(options?: UseFravikSubmitOptions) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options ?? {};

  return useMutation<FravikResult, Error, FravikAction>({
    mutationFn: async (action): Promise<FravikResult> => {
      switch (action.type) {
        case 'opprett': {
          const sakId = await opprettFravikSoknad(action.data, action.aktor);
          return { type: 'opprett', sakId };
        }
        case 'oppdater': {
          await oppdaterFravikSoknad(action.sakId, action.data, action.aktor, action.expectedVersion);
          return { type: 'oppdater' };
        }
        case 'legg_til_maskin': {
          const maskinId = await leggTilMaskin(
            action.sakId,
            action.data,
            action.aktor,
            action.expectedVersion
          );
          return { type: 'legg_til_maskin', maskinId };
        }
        case 'send_inn': {
          await sendInnSoknad(action.sakId, action.aktor);
          return { type: 'send_inn' };
        }
      }
    },
    onSuccess: (result, variables) => {
      // Invalidate fravik list
      queryClient.invalidateQueries({ queryKey: ['fravik-liste'] });

      // Invalidate specific søknad state if applicable
      if (variables.type !== 'opprett') {
        const sakId = 'sakId' in variables ? variables.sakId : undefined;
        if (sakId) {
          queryClient.invalidateQueries({ queryKey: ['fravik', sakId, 'state'] });
          queryClient.invalidateQueries({ queryKey: ['fravik', sakId, 'events'] });
        }
      }

      onSuccess?.(result);
    },
    onError,
  });
}
