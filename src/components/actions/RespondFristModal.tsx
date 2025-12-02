/**
 * RespondFristModal Component
 *
 * Action modal for BH (client) to respond to a frist (deadline extension) claim.
 * Includes fields for approved number of days and result.
 * Now includes legacy NS 8407 response options.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { BH_FRISTSVAR_OPTIONS } from '../../constants';

const respondFristSchema = z.object({
  resultat: z.enum(
    [
      'godkjent_fullt',
      'delvis_godkjent_bestrider_beregning',
      'avslatt_uenig_grunnlag',
      'avslatt_for_sent',
      'avventer_spesifikasjon',
    ],
    {
      errorMap: () => ({ message: 'Resultat er påkrevd' }),
    }
  ),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  godkjent_dager: z.number().min(0, 'Antall dager kan ikke være negativt').optional(),
});

type RespondFristFormData = z.infer<typeof respondFristSchema>;

interface RespondFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  krevdDager?: number;
  fristType?: 'kalenderdager' | 'arbeidsdager';
}

export function RespondFristModal({
  open,
  onOpenChange,
  sakId,
  krevdDager,
  fristType,
}: RespondFristModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<RespondFristFormData>({
    resolver: zodResolver(respondFristSchema),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const selectedResultat = watch('resultat');
  const godkjentDager = watch('godkjent_dager');

  const onSubmit = (data: RespondFristFormData) => {
    mutation.mutate({
      eventType: 'respons_frist',
      data,
    });
  };

  // Show days field for full or partial approval
  const showDaysField =
    selectedResultat === 'godkjent_fullt' ||
    selectedResultat === 'delvis_godkjent_bestrider_beregning';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Svar på fristkrav"
      description="Gi din vurdering av fristforlengelsen."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-05">
        {/* Show claimed days if available */}
        {krevdDager !== undefined && (
          <div className="p-pkt-04 bg-info-100 rounded-pkt-md">
            <p className="text-sm font-medium text-info-700">
              Krevd forlengelse: {krevdDager} {fristType || 'dager'}
            </p>
          </div>
        )}

        {/* Resultat - Using legacy NS 8407 options */}
        <div>
          <label htmlFor="resultat" className="block text-sm font-medium text-gray-700">
            Resultat <span className="text-error">*</span>
          </label>
          <select
            id="resultat"
            {...register('resultat')}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            aria-required="true"
            aria-invalid={!!errors.resultat}
            aria-describedby={errors.resultat ? 'resultat-error' : undefined}
          >
            {BH_FRISTSVAR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.resultat && (
            <p id="resultat-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.resultat.message}
            </p>
          )}
        </div>

        {/* Godkjent dager - only show if godkjent or delvis_godkjent */}
        {showDaysField && (
          <div>
            <label htmlFor="godkjent_dager" className="block text-sm font-medium text-gray-700">
              Godkjent antall dager{' '}
              {selectedResultat === 'godkjent_fullt' ? <span className="text-error">*</span> : ''}
            </label>
            <input
              id="godkjent_dager"
              type="number"
              {...register('godkjent_dager', { valueAsNumber: true })}
              className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
              placeholder="0"
              min="0"
              aria-invalid={!!errors.godkjent_dager}
              aria-describedby={errors.godkjent_dager ? 'godkjent_dager-error' : undefined}
            />
            {errors.godkjent_dager && (
              <p id="godkjent_dager-error" className="mt-pkt-02 text-sm text-error" role="alert">
                {errors.godkjent_dager.message}
              </p>
            )}
            {krevdDager !== undefined && godkjentDager !== undefined && (
              <p className="mt-pkt-02 text-xs text-gray-600">
                Differanse: {krevdDager - godkjentDager} dager (
                {((godkjentDager / krevdDager) * 100).toFixed(1)}% godkjent)
              </p>
            )}
            {selectedResultat === 'delvis_godkjent_bestrider_beregning' && (
              <p className="mt-pkt-02 text-xs text-info-600">
                Enig i grunnlag, men bestrider beregning av antall dager
              </p>
            )}
          </div>
        )}

        {/* Status indicator */}
        {selectedResultat && (
          <div
            className={`p-pkt-04 rounded-pkt-md ${
              selectedResultat === 'godkjent_fullt'
                ? 'bg-success-100 border border-success-500'
                : selectedResultat === 'delvis_godkjent_bestrider_beregning' ||
                  selectedResultat === 'avventer_spesifikasjon'
                ? 'bg-warning-100 border border-warning-500'
                : 'bg-error-100 border border-error-500'
            }`}
          >
            <p className="text-sm font-medium">
              {selectedResultat === 'godkjent_fullt'
                ? '✓ Fristforlengelsen vil bli godkjent fullt ut'
                : selectedResultat === 'delvis_godkjent_bestrider_beregning'
                ? '◐ Delvis godkjent - enig i grunnlag, bestrider beregning'
                : selectedResultat === 'avventer_spesifikasjon'
                ? '⏸ Avventer nærmere spesifikasjon'
                : '✗ Fristforlengelsen vil bli avslått'}
            </p>
          </div>
        )}

        {/* Begrunnelse */}
        <div>
          <label htmlFor="begrunnelse" className="block text-sm font-medium text-gray-700">
            Begrunnelse <span className="text-error">*</span>
          </label>
          <textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={5}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            placeholder="Begrunn din vurdering av fristkravet..."
            aria-required="true"
            aria-invalid={!!errors.begrunnelse}
            aria-describedby={errors.begrunnelse ? 'begrunnelse-error' : undefined}
          />
          {errors.begrunnelse && (
            <p id="begrunnelse-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.begrunnelse.message}
            </p>
          )}
        </div>

        {/* Error Message */}
        {mutation.isError && (
          <div
            className="p-pkt-04 bg-error-100 border border-error-500 rounded-pkt-md"
            role="alert"
          >
            <p className="text-sm text-error-700">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-pkt-03 pt-pkt-04 border-t border-gray-200">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Sender...' : 'Send svar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
