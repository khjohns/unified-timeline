/**
 * AcceptResponseForm Component
 *
 * Reusable form for TE to accept BH's response on a track.
 * Extracted from AcceptResponseModal for use in both Modal and TrackFormView contexts.
 *
 * Once accepted, the parties are in agreement on that track.
 * This action cannot be undone.
 */

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useCatendaStatusHandler } from '../../../hooks/useCatendaStatusHandler';
import { useSubmitEvent } from '../../../hooks/useSubmitEvent';
import { TokenExpiredAlert } from '../../alerts/TokenExpiredAlert';
import {
  Alert,
  Button,
  FormField,
  Textarea,
  useToast,
} from '../../primitives';
import type { SakState, EventType } from '../../../types/timeline';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type TrackType = 'grunnlag' | 'vederlag' | 'frist';

interface AcceptFormData {
  kommentar: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRACK_CONFIG: Record<
  TrackType,
  {
    labelNorwegian: string;
    successMessage: string;
  }
> = {
  grunnlag: {
    labelNorwegian: 'ansvarsgrunnlaget',
    successMessage: 'Svaret er godtatt',
  },
  vederlag: {
    labelNorwegian: 'vederlagskravet',
    successMessage: 'Svaret er godtatt',
  },
  frist: {
    labelNorwegian: 'fristkravet',
    successMessage: 'Svaret er godtatt',
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/** Get a human-readable summary of BH's position on a track */
function getBhPositionSummary(track: TrackType, sakState?: SakState): string | null {
  if (!sakState) return null;

  if (track === 'grunnlag') {
    const r = sakState.grunnlag.bh_resultat;
    if (r === 'godkjent') return 'Godkjent';
    if (r === 'avslatt') return 'Avslatt';
    if (r === 'frafalt') return 'Frafalt';
    return null;
  }

  if (track === 'vederlag') {
    const r = sakState.vederlag.bh_resultat;
    if (!r) return null;
    const belop = sakState.vederlag.godkjent_belop;
    if (r === 'godkjent') return `Godkjent${belop != null ? ` — ${belop.toLocaleString('nb-NO')} kr` : ''}`;
    if (r === 'avslatt') return 'Avslatt';
    if (r === 'delvis_godkjent') return `Delvis godkjent${belop != null ? ` — ${belop.toLocaleString('nb-NO')} kr` : ''}`;
    return null;
  }

  if (track === 'frist') {
    const r = sakState.frist.bh_resultat;
    if (!r) return null;
    const dager = sakState.frist.godkjent_dager;
    if (r === 'godkjent') return `Godkjent${dager != null ? ` — ${dager} dager` : ''}`;
    if (r === 'avslatt') return 'Avslatt';
    if (r === 'delvis_godkjent') return `Delvis godkjent${dager != null ? ` — ${dager} dager` : ''}`;
    return null;
  }

  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface AcceptResponseFormProps {
  sakId: string;
  track: TrackType;
  sakState?: SakState;
  /** Called after successful submission */
  onSuccess: () => void;
  /** Called when user clicks Avbryt */
  onCancel: () => void;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

export function AcceptResponseForm({
  sakId,
  track,
  sakState,
  onSuccess,
  onCancel,
  onCatendaWarning,
}: AcceptResponseFormProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });
  const config = TRACK_CONFIG[track];

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<AcceptFormData>({
    defaultValues: {
      kommentar: '',
    },
  });

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    generatePdf: false,
    onSuccess: (response) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }

      reset();
      onSuccess();
      toast.success(config.successMessage, 'Partene er nå enige.');

      if (response.catenda_synced !== undefined) {
        handleCatendaStatus(response);
      }
    },
    onError: (error) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }

      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved godtak', error.message);
      }
    },
  });

  const bhPosition = getBhPositionSummary(track, sakState);

  const onSubmit = (data: AcceptFormData) => {
    pendingToastId.current = toast.pending('Godtar svaret...', 'Vennligst vent.');

    mutation.mutate({
      eventType: 'te_aksepterer_respons' as EventType,
      data: {
        spor: track,
        kommentar: data.kommentar || null,
      },
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Warning */}
        <Alert variant="warning" title="Er du sikker?">
          Du er i ferd med å godta BH sin respons på {config.labelNorwegian}.
          Denne handlingen kan ikke angres.
        </Alert>

        {/* BH position summary */}
        {bhPosition && (
          <div className="rounded-sm bg-pkt-bg-subtle px-3 py-2 text-sm">
            <span className="text-pkt-text-body-subtle">BH sin posisjon: </span>
            <span className="font-medium text-pkt-text-body-default">{bhPosition}</span>
          </div>
        )}

        {/* eslint-disable-next-line react-hooks/refs -- False positive: onSubmit is an event handler, not render. Fix merged in facebook/react#35062 */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Optional comment */}
          <FormField
            label="Kommentar"
            optional
            helpText="Valgfri kommentar ved aksept"
          >
            <Textarea
              {...register('kommentar')}
              rows={3}
              fullWidth
              placeholder="Valgfri kommentar..."
            />
          </FormField>

          {/* Error message */}
          {mutation.isError && (
            <Alert variant="danger" title="Feil">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </Alert>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={mutation.isPending}
              className="w-full sm:w-auto"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
              className="w-full sm:w-auto"
            >
              {mutation.isPending ? 'Godtar...' : 'Godta svaret'}
            </Button>
          </div>
        </form>

        <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
      </div>
    </>
  );
}
