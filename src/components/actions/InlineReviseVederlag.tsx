/**
 * InlineReviseVederlag Component
 *
 * Kompakt inline-skjema for å revidere vederlagsbeløp direkte i VederlagCard.
 * Viser tre beløpsfelt (hovedkrav, rigg, produktivitet) med total-beregning.
 *
 * For avanserte endringer (metode, datoer, vedlegg) åpnes full ReviseVederlagModal.
 */

import { useState, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GearIcon } from '@radix-ui/react-icons';
import { Button, CurrencyInput, Textarea, Alert, useToast } from '../primitives';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { formatCurrency } from '../../utils/formatters';
import type { VederlagsMetode } from './shared';

// ============================================================================
// TYPES
// ============================================================================

interface SaerskiltKravItem {
  belop?: number;
  dato_klar_over?: string;
}

interface LastVederlagEventInfo {
  event_id: string;
  metode: VederlagsMetode;
  belop_direkte?: number;
  kostnads_overslag?: number;
  begrunnelse?: string;
  krever_justert_ep?: boolean;
  varslet_for_oppstart?: boolean;
  saerskilt_krav?: {
    rigg_drift?: SaerskiltKravItem;
    produktivitet?: SaerskiltKravItem;
  } | null;
}

interface InlineReviseVederlagProps {
  sakId: string;
  lastVederlagEvent: LastVederlagEventInfo;
  currentVersion?: number;
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
  hovedbelop: z.number().optional(),
  belop_rigg: z.number().optional(),
  belop_produktivitet: z.number().optional(),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
});

type InlineReviseFormData = z.infer<typeof inlineReviseSchema>;

// ============================================================================
// COMPONENT
// ============================================================================

export function InlineReviseVederlag({
  sakId,
  lastVederlagEvent,
  currentVersion = 0,
  onOpenFullModal,
  onClose,
  onSuccess,
}: InlineReviseVederlagProps) {
  const toast = useToast();
  const pendingToastId = useRef<string | null>(null);

  const erRegningsarbeid = lastVederlagEvent.metode === 'REGNINGSARBEID';

  // Get current values
  const currentHovedbelop = erRegningsarbeid
    ? lastVederlagEvent.kostnads_overslag
    : lastVederlagEvent.belop_direkte;
  const currentRigg = lastVederlagEvent.saerskilt_krav?.rigg_drift?.belop;
  const currentProduktivitet = lastVederlagEvent.saerskilt_krav?.produktivitet?.belop;

  // Track if særskilte krav existed before
  const hadRiggKrav = !!lastVederlagEvent.saerskilt_krav?.rigg_drift;
  const hadProduktivitetKrav = !!lastVederlagEvent.saerskilt_krav?.produktivitet;

  const {
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InlineReviseFormData>({
    resolver: zodResolver(inlineReviseSchema),
    defaultValues: {
      hovedbelop: currentHovedbelop,
      belop_rigg: currentRigg ?? 0,
      belop_produktivitet: currentProduktivitet ?? 0,
      begrunnelse: '',
    },
  });

  const hovedbelop = watch('hovedbelop');
  const belopRigg = watch('belop_rigg');
  const belopProduktivitet = watch('belop_produktivitet');

  // Calculate totals
  const nyTotal = (hovedbelop ?? 0) + (belopRigg ?? 0) + (belopProduktivitet ?? 0);
  const gammelTotal = (currentHovedbelop ?? 0) + (currentRigg ?? 0) + (currentProduktivitet ?? 0);
  const endring = nyTotal - gammelTotal;
  const endringProsent = gammelTotal > 0 ? (endring / gammelTotal) * 100 : 0;

  // Check if anything changed
  const harEndringer = useMemo(() => {
    return (
      hovedbelop !== currentHovedbelop ||
      belopRigg !== (currentRigg ?? 0) ||
      belopProduktivitet !== (currentProduktivitet ?? 0)
    );
  }, [hovedbelop, belopRigg, belopProduktivitet, currentHovedbelop, currentRigg, currentProduktivitet]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      toast.success('Vederlagskrav revidert', 'Beløpene er oppdatert.');
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
    pendingToastId.current = toast.pending('Sender...', 'Oppdaterer vederlagskrav.');

    // Build særskilt krav - preserve dates from original
    const saerskiltKrav = {
      rigg_drift: (hadRiggKrav || (data.belop_rigg && data.belop_rigg > 0))
        ? {
            belop: data.belop_rigg,
            dato_klar_over: lastVederlagEvent.saerskilt_krav?.rigg_drift?.dato_klar_over,
          }
        : undefined,
      produktivitet: (hadProduktivitetKrav || (data.belop_produktivitet && data.belop_produktivitet > 0))
        ? {
            belop: data.belop_produktivitet,
            dato_klar_over: lastVederlagEvent.saerskilt_krav?.produktivitet?.dato_klar_over,
          }
        : undefined,
    };

    const hasSaerskilt = saerskiltKrav.rigg_drift || saerskiltKrav.produktivitet;

    mutation.mutate({
      eventType: 'vederlag_krav_oppdatert',
      data: {
        original_event_id: lastVederlagEvent.event_id,
        metode: lastVederlagEvent.metode,
        belop_direkte: erRegningsarbeid ? undefined : data.hovedbelop,
        kostnads_overslag: erRegningsarbeid ? data.hovedbelop : undefined,
        krever_justert_ep: lastVederlagEvent.krever_justert_ep,
        varslet_for_oppstart: lastVederlagEvent.varslet_for_oppstart,
        saerskilt_krav: hasSaerskilt ? saerskiltKrav : null,
        begrunnelse: data.begrunnelse,
        dato_revidert: new Date().toISOString().split('T')[0],
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-3 p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded">
      {/* Beløpsfelt */}
      <div className="space-y-2">
        {/* Hovedkrav */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-pkt-text-subtle w-24 shrink-0">Hovedkrav</span>
          <Controller
            name="hovedbelop"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                value={field.value ?? null}
                onChange={field.onChange}
                width="sm"
                allowNegative={!erRegningsarbeid}
              />
            )}
          />
        </div>

        {/* Rigg/drift - vis hvis hadde før eller har verdi */}
        {(hadRiggKrav || (belopRigg && belopRigg > 0)) && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-pkt-text-subtle w-24 shrink-0">+ Rigg/drift</span>
            <Controller
              name="belop_rigg"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  value={field.value ?? null}
                  onChange={field.onChange}
                  width="sm"
                />
              )}
            />
          </div>
        )}

        {/* Produktivitet - vis hvis hadde før eller har verdi */}
        {(hadProduktivitetKrav || (belopProduktivitet && belopProduktivitet > 0)) && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-pkt-text-subtle w-24 shrink-0">+ Produktivitet</span>
            <Controller
              name="belop_produktivitet"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  value={field.value ?? null}
                  onChange={field.onChange}
                  width="sm"
                />
              )}
            />
          </div>
        )}

        {/* Total og endring */}
        <div className="flex items-center gap-2 pt-2 border-t border-pkt-border-subtle">
          <span className="text-sm font-medium w-24 shrink-0">= Total</span>
          <span className="text-sm font-semibold">{formatCurrency(nyTotal)}</span>
          {endring !== 0 && (
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                endring > 0
                  ? 'bg-pkt-surface-faded-red text-pkt-brand-red-1000'
                  : 'bg-pkt-surface-faded-green text-pkt-brand-dark-green-1000'
              }`}
            >
              {endring > 0 ? '+' : ''}{formatCurrency(endring)} ({endringProsent.toFixed(1)}%)
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
              placeholder="Begrunnelse for endring..."
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
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-pkt-border-subtle">
        <div className="flex gap-2">
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
          title="Flere valg (metode, vedlegg, datoer)"
          aria-label="Åpne fullstendig redigeringsvindu"
        >
          <GearIcon className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}
