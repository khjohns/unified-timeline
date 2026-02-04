/**
 * WithdrawModal Component
 *
 * Confirmation modal for TE (contractor) to withdraw claims.
 *
 * Business logic:
 * - Withdrawing grunnlag -> Cascades to withdraw vederlag and frist
 * - Withdrawing vederlag -> Only withdraws vederlag track
 * - Withdrawing frist -> Only withdraws frist track
 */

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useCatendaStatusHandler } from '../../hooks/useCatendaStatusHandler';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  Alert,
  Button,
  FormField,
  Modal,
  Textarea,
  useToast,
} from '../primitives';
import type { SakState, EventType } from '../../types/timeline';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type TrackType = 'grunnlag' | 'vederlag' | 'frist';

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  track: TrackType;
  sakState?: SakState;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

interface WithdrawFormData {
  begrunnelse: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRACK_CONFIG: Record<
  TrackType,
  {
    title: string;
    eventType: EventType;
    labelNorwegian: string;
    successMessage: string;
  }
> = {
  grunnlag: {
    title: 'Trekk tilbake ansvarsgrunnlag',
    eventType: 'grunnlag_trukket',
    labelNorwegian: 'ansvarsgrunnlaget',
    successMessage: 'Ansvarsgrunnlag trukket tilbake',
  },
  vederlag: {
    title: 'Trekk tilbake vederlagskrav',
    eventType: 'vederlag_krav_trukket',
    labelNorwegian: 'vederlagskravet',
    successMessage: 'Vederlagskrav trukket tilbake',
  },
  frist: {
    title: 'Trekk tilbake fristkrav',
    eventType: 'frist_krav_trukket',
    labelNorwegian: 'fristkravet',
    successMessage: 'Fristkrav trukket tilbake',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function WithdrawModal({
  open,
  onOpenChange,
  sakId,
  track,
  sakState,
  onCatendaWarning,
}: WithdrawModalProps) {
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
      onOpenChange(false);
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

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  // Determine if cascade warning should be shown
  const showCascadeWarning =
    track === 'grunnlag' &&
    sakState &&
    (sakState.vederlag.status !== 'ikke_relevant' && sakState.vederlag.status !== 'utkast' && sakState.vederlag.status !== 'trukket' ||
     sakState.frist.status !== 'ikke_relevant' && sakState.frist.status !== 'utkast' && sakState.frist.status !== 'trukket');

  // Build list of tracks that will be cascaded
  const cascadedTracks: string[] = [];
  if (showCascadeWarning && sakState) {
    if (sakState.vederlag.status !== 'ikke_relevant' && sakState.vederlag.status !== 'utkast' && sakState.vederlag.status !== 'trukket') {
      cascadedTracks.push('vederlagskravet');
    }
    if (sakState.frist.status !== 'ikke_relevant' && sakState.frist.status !== 'utkast' && sakState.frist.status !== 'trukket') {
      cascadedTracks.push('fristkravet');
    }
  }

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
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={config.title}
      size="md"
    >
      <div className="space-y-4">
        {/* Warning about what will happen */}
        <Alert
          variant={showCascadeWarning ? 'danger' : 'warning'}
          title={showCascadeWarning ? 'Dette vil trekke hele saken' : 'Er du sikker?'}
        >
          {showCascadeWarning ? (
            <>
              Ved å trekke tilbake ansvarsgrunnlaget vil også{' '}
              <strong>{cascadedTracks.join(' og ')}</strong> bli trukket tilbake automatisk.
              Denne handlingen kan ikke angres.
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
            label="Begrunnelse (valgfritt)"
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
              onClick={() => onOpenChange(false)}
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
    </Modal>
  );
}
