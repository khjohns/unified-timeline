/**
 * WithdrawForm Component
 *
 * Reusable form for withdrawing claims (grunnlag, vederlag, or frist).
 * Extracted from WithdrawModal for use in both Modal and TrackFormView contexts.
 *
 * Business logic:
 * - Withdrawing grunnlag -> Cascades to withdraw vederlag and frist
 * - Withdrawing vederlag -> Only withdraws vederlag track
 * - Withdrawing frist -> Only withdraws frist track
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

interface WithdrawFormData {
  begrunnelse: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRACK_CONFIG: Record<
  TrackType,
  {
    eventType: EventType;
    labelNorwegian: string;
    successMessage: string;
  }
> = {
  grunnlag: {
    eventType: 'grunnlag_trukket',
    labelNorwegian: 'ansvarsgrunnlaget',
    successMessage: 'Ansvarsgrunnlag trukket tilbake',
  },
  vederlag: {
    eventType: 'vederlag_krav_trukket',
    labelNorwegian: 'vederlagskravet',
    successMessage: 'Vederlagskrav trukket tilbake',
  },
  frist: {
    eventType: 'frist_krav_trukket',
    labelNorwegian: 'fristkravet',
    successMessage: 'Fristkrav trukket tilbake',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export interface WithdrawFormProps {
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

export function WithdrawForm({
  sakId,
  track,
  sakState,
  onSuccess,
  onCancel,
  onCatendaWarning,
}: WithdrawFormProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });
  const config = TRACK_CONFIG[track];

  // Form setup - begrunnelse is optional
  const {
    register,
    handleSubmit,
    reset,
  } = useForm<WithdrawFormData>({
    defaultValues: {
      begrunnelse: '',
    },
  });

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

  // Mutation for submitting withdrawal event
  const mutation = useSubmitEvent(sakId, {
    generatePdf: false, // No PDF needed for withdrawal
    onSuccess: (response) => {
      // Dismiss pending toast
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }

      reset();
      onSuccess();
      toast.success(config.successMessage, 'Kravet er nå trukket tilbake.');

      // Handle Catenda sync status
      if (response.catenda_synced !== undefined) {
        handleCatendaStatus(response);
      }
    },
    onError: (error) => {
      // Dismiss pending toast
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }

      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved tilbaketrekking', error.message);
      }
    },
  });

  // Helper to check if a track is inactive (not actively claiming)
  const isInactive = (status: string | undefined) =>
    status === 'ikke_relevant' || status === 'utkast' || status === 'trukket';

  // Determine if cascade warning should be shown (grunnlag -> vederlag/frist)
  const showCascadeWarning =
    track === 'grunnlag' &&
    sakState &&
    (!isInactive(sakState.vederlag.status) || !isInactive(sakState.frist.status));

  // Build list of tracks that will be cascaded (grunnlag -> vederlag/frist)
  const cascadedTracks: string[] = [];
  if (showCascadeWarning && sakState) {
    if (!isInactive(sakState.vederlag.status)) {
      cascadedTracks.push('vederlagskravet');
    }
    if (!isInactive(sakState.frist.status)) {
      cascadedTracks.push('fristkravet');
    }
  }

  // REVERSE CASCADE: Check if withdrawing this claim will also withdraw grunnlag
  // This happens when withdrawing vederlag/frist and the OTHER claim is already inactive
  const showReverseCascadeWarning =
    sakState &&
    !isInactive(sakState.grunnlag.status) && // grunnlag must be active
    ((track === 'vederlag' && isInactive(sakState.frist.status)) ||
     (track === 'frist' && isInactive(sakState.vederlag.status)));

  // Submit handler
  const onSubmit = (data: WithdrawFormData) => {
    // Show pending toast
    pendingToastId.current = toast.pending('Trekker tilbake...', 'Vennligst vent.');

    // Submit the withdrawal event
    // Tilbaketrekking er en enkel event - kun begrunnelse trengs
    mutation.mutate({
      eventType: config.eventType,
      data: {
        begrunnelse: data.begrunnelse || null,
      },
      catendaTopicId: undefined,
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Warning about what will happen */}
        <Alert
          variant={showCascadeWarning || showReverseCascadeWarning ? 'danger' : 'warning'}
          title={
            showCascadeWarning
              ? 'Dette vil trekke hele saken'
              : showReverseCascadeWarning
              ? 'Dette vil også trekke ansvarsgrunnlaget'
              : 'Er du sikker?'
          }
        >
          {showCascadeWarning ? (
            <>
              Ved å trekke tilbake ansvarsgrunnlaget vil også{' '}
              <strong>{cascadedTracks.join(' og ')}</strong> bli trukket tilbake automatisk.
              Denne handlingen kan ikke angres.
            </>
          ) : showReverseCascadeWarning ? (
            <>
              Dette er det siste aktive kravet. Ved å trekke {config.labelNorwegian} vil også{' '}
              <strong>ansvarsgrunnlaget</strong> bli trukket tilbake automatisk, siden det ikke
              lenger finnes aktive krav. Denne handlingen kan ikke angres.
            </>
          ) : (
            <>
              Du er i ferd med å trekke tilbake {config.labelNorwegian}.
              Denne handlingen kan ikke angres.
            </>
          )}
        </Alert>

        {/* eslint-disable-next-line react-hooks/refs -- False positive: onSubmit is an event handler, not render. Fix merged in facebook/react#35062 */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Optional begrunnelse */}
          <FormField
            label="Begrunnelse"
            optional
            helpText="Oppgi hvorfor du ønsker å trekke tilbake kravet"
          >
            <Textarea
              {...register('begrunnelse')}
              rows={3}
              fullWidth
              placeholder="Valgfri begrunnelse for tilbaketrekking..."
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
              variant="danger"
              disabled={mutation.isPending}
              className="w-full sm:w-auto"
            >
              {mutation.isPending ? 'Trekker tilbake...' : 'Trekk tilbake'}
            </Button>
          </div>
        </form>

        <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
      </div>
    </>
  );
}
