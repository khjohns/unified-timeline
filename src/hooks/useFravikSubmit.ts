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
  soknadId: string;
  data: SoknadOppdatertData;
  aktor: string;
}

interface LeggTilMaskinAction {
  type: 'legg_til_maskin';
  soknadId: string;
  data: MaskinData;
  aktor: string;
}

interface SendInnAction {
  type: 'send_inn';
  soknadId: string;
  aktor: string;
}

type FravikAction = OpprettAction | OppdaterAction | LeggTilMaskinAction | SendInnAction;

interface OpprettResult {
  type: 'opprett';
  soknadId: string;
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
 *       navigate(`/fravik/${result.soknadId}`);
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
          const soknadId = await opprettFravikSoknad(action.data, action.aktor);
          return { type: 'opprett', soknadId };
        }
        case 'oppdater': {
          await oppdaterFravikSoknad(action.soknadId, action.data, action.aktor);
          return { type: 'oppdater' };
        }
        case 'legg_til_maskin': {
          const maskinId = await leggTilMaskin(action.soknadId, action.data, action.aktor);
          return { type: 'legg_til_maskin', maskinId };
        }
        case 'send_inn': {
          await sendInnSoknad(action.soknadId, action.aktor);
          return { type: 'send_inn' };
        }
      }
    },
    onSuccess: (result, variables) => {
      // Invalidate fravik list
      queryClient.invalidateQueries({ queryKey: ['fravik-liste'] });

      // Invalidate specific søknad state if applicable
      if (variables.type !== 'opprett') {
        const soknadId = 'soknadId' in variables ? variables.soknadId : undefined;
        if (soknadId) {
          queryClient.invalidateQueries({ queryKey: ['fravik', soknadId, 'state'] });
          queryClient.invalidateQueries({ queryKey: ['fravik', soknadId, 'events'] });
        }
      }

      onSuccess?.(result);
    },
    onError,
  });
}
