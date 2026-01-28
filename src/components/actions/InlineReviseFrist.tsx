/**
 * InlineReviseFrist Component
 *
 * Kompakt inline-skjema for å revidere/spesifisere fristkrav direkte i FristCard.
 * Viser antall dager med endring-beregning.
 *
 * Håndterer automatisk event-type:
 * - Hvis original var kun varsel (uten dager) → sender frist_krav_spesifisert
 * - Hvis original hadde spesifiserte dager → sender frist_krav_oppdatert
 *
 * For avanserte endringer (ny_sluttdato, vedlegg) eller forespørsel-situasjoner
 * åpnes full ReviseFristModal via gear-ikon.
 */

import { useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GearIcon } from '@radix-ui/react-icons';
import { Button, Input, Textarea, Alert, useToast } from '../primitives';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { formatDays } from '../../utils/formatters';
import type { FristVarselType } from '../../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

interface LastFristEventInfo {
  event_id: string;
  antall_dager: number;
  begrunnelse?: string;
}

interface InlineReviseFristProps {
  sakId: string;
  lastFristEvent: LastFristEventInfo;
  /** Original varsel type - determines if this is specification or revision */
  originalVarselType?: FristVarselType;
  /** Callback to open full modal for advanced options */
  onOpenFullModal: () => void;
  /** Callback when inline form is closed */
  onClose: () => void;
  /** Callback when submission succeeds */
  onSuccess?: () => void;
}

// ============================================================================
// SCHEMA
// ============================================================================

const inlineReviseSchema = z.object({
  antall_dager: z.number().min(0, 'Antall dager må være minst 0'),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
});

type InlineReviseFormData = z.infer<typeof inlineReviseSchema>;

// ============================================================================
// COMPONENT
// ============================================================================

export function InlineReviseFrist({
  sakId,
  lastFristEvent,
  originalVarselType,
  onOpenFullModal,
  onClose,
  onSuccess,
}: InlineReviseFristProps) {
  const toast = useToast();
  const pendingToastId = useRef<string | null>(null);

  // Determine if this is specification (upgrade from neutral varsel) or revision
  const erSpesifisering = useMemo(() => {
    return originalVarselType === 'varsel' &&
      (lastFristEvent.antall_dager === 0 || lastFristEvent.antall_dager === undefined);
  }, [originalVarselType, lastFristEvent.antall_dager]);

  const currentDager = lastFristEvent.antall_dager ?? 0;

  const {
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InlineReviseFormData>({
    resolver: zodResolver(inlineReviseSchema),
    defaultValues: {
      antall_dager: erSpesifisering ? 0 : currentDager,
      begrunnelse: '',
    },
  });

  const antallDager = watch('antall_dager');

  // Calculate change
  const endring = (antallDager ?? 0) - currentDager;

  // Check if anything changed (for revision mode)
  // For specification mode, we require > 0 days
  const harEndringer = useMemo(() => {
    if (erSpesifisering) {
      return antallDager !== undefined && antallDager > 0;
    }
    return antallDager !== currentDager;
  }, [antallDager, currentDager, erSpesifisering]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      toast.success(
        erSpesifisering ? 'Fristkrav spesifisert' : 'Fristkrav revidert',
        erSpesifisering ? 'Kravet er nå spesifisert.' : 'Antall dager er oppdatert.'
      );
      onSuccess?.();
      onClose();
    },
    onError: () => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
    },
  });

  const onSubmit = (data: InlineReviseFormData) => {
    pendingToastId.current = toast.pending('Sender...', 'Oppdaterer fristkrav.');

    if (erSpesifisering) {
      // Specification event (upgrade from neutral varsel)
      mutation.mutate({
        eventType: 'frist_krav_spesifisert',
        data: {
          original_event_id: lastFristEvent.event_id,
          antall_dager: data.antall_dager,
          begrunnelse: data.begrunnelse,
          er_svar_pa_foresporsel: false, // Inline is not used for foresporsel
          dato_spesifisert: new Date().toISOString().split('T')[0],
        },
      });
    } else {
      // Standard revision event
      mutation.mutate({
        eventType: 'frist_krav_oppdatert',
        data: {
          original_event_id: lastFristEvent.event_id,
          antall_dager: data.antall_dager,
          begrunnelse: data.begrunnelse,
          dato_revidert: new Date().toISOString().split('T')[0],
        },
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-3 p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded">
      {/* Info for specification mode */}
      {erSpesifisering && (
        <p className="text-xs text-pkt-text-subtle mb-3">
          Du oppgraderer fra nøytralt varsel til spesifisert krav (§33.6.1)
        </p>
      )}

      {/* Antall dager */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-sm text-pkt-text-subtle sm:w-28 shrink-0">Antall dager</span>
          <Controller
            name="antall_dager"
            control={control}
            render={({ field }) => (
              <Input
                type="number"
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                width="xs"
                min={0}
                error={!!errors.antall_dager}
                className="sm:max-w-[120px]"
              />
            )}
          />
        </div>
        {errors.antall_dager && (
          <p className="text-xs text-pkt-text-error">{errors.antall_dager.message}</p>
        )}

        {/* Total og endring */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-pkt-border-subtle">
          <span className="text-sm font-medium">= Krevd</span>
          <span className="text-sm font-semibold">{formatDays(antallDager ?? 0)}</span>
          {endring !== 0 && (
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
                endring > 0
                  ? 'bg-badge-danger-bg text-badge-danger-text border-badge-danger-border'
                  : 'bg-badge-success-bg text-badge-success-text border-badge-success-border'
              }`}
            >
              {endring > 0 ? '+' : ''}{endring} {Math.abs(endring) === 1 ? 'dag' : 'dager'}
            </span>
          )}
        </div>
      </div>

      {/* Begrunnelse */}
      <div className="mt-3">
        <Controller
          name="begrunnelse"
          control={control}
          render={({ field }) => (
            <Textarea
              value={field.value}
              onChange={field.onChange}
              placeholder={erSpesifisering
                ? 'Begrunnelse for spesifisering...'
                : 'Begrunnelse for endring...'}
              rows={2}
              fullWidth
              error={!!errors.begrunnelse}
            />
          )}
        />
        {errors.begrunnelse && (
          <p className="text-xs text-pkt-text-error mt-1">{errors.begrunnelse.message}</p>
        )}
      </div>

      {/* Error */}
      {mutation.isError && (
        <Alert variant="danger" className="mt-2">
          {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
        </Alert>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-pkt-border-subtle">
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting || !harEndringer}
          >
            {isSubmitting ? 'Sender...' : 'Lagre'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
        </div>

        {/* Gear icon for full modal */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenFullModal}
          title="Flere valg (ny sluttdato, vedlegg)"
          aria-label="Åpne fullstendig redigeringsvindu"
        >
          <GearIcon className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}
