/**
 * RespondVederlagModal Component
 *
 * Action modal for BH (client) to respond to a vederlag (compensation) claim.
 * Includes fields for approved amount and result.
 * Now includes legacy NS 8407 response options.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { BH_VEDERLAGSSVAR_OPTIONS, VEDERLAGSMETODER_OPTIONS } from '../../constants';

const respondVederlagSchema = z.object({
  resultat: z.enum(
    [
      'godkjent_fullt',
      'delvis_godkjent',
      'avslatt_uenig_grunnlag',
      'avslatt_for_sent',
      'avventer_spesifikasjon',
      'godkjent_annen_metode',
    ],
    {
      errorMap: () => ({ message: 'Resultat er påkrevd' }),
    }
  ),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  godkjent_belop: z.number().min(0, 'Beløp kan ikke være negativt').optional(),
  godkjent_metode: z.string().optional(),
});

type RespondVederlagFormData = z.infer<typeof respondVederlagSchema>;

interface RespondVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  krevdBelop?: number;
}

export function RespondVederlagModal({
  open,
  onOpenChange,
  sakId,
  krevdBelop,
}: RespondVederlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<RespondVederlagFormData>({
    resolver: zodResolver(respondVederlagSchema),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const selectedResultat = watch('resultat');
  const godkjentBelop = watch('godkjent_belop');

  const onSubmit = (data: RespondVederlagFormData) => {
    mutation.mutate({
      eventType: 'respons_vederlag',
      data,
    });
  };

  // Determine if we should show amount field
  const showAmountField =
    selectedResultat === 'godkjent_fullt' ||
    selectedResultat === 'delvis_godkjent' ||
    selectedResultat === 'godkjent_annen_metode';

  // Determine if we should show method field
  const showMethodField = selectedResultat === 'godkjent_annen_metode';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Svar på vederlagskrav"
      description="Gi din vurdering av vederlagskravet."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-05">
        {/* Show claimed amount if available */}
        {krevdBelop !== undefined && (
          <div className="p-pkt-04 bg-info-100 rounded-pkt-md">
            <p className="text-sm font-medium text-info-700">
              Krevd beløp: {krevdBelop.toLocaleString('nb-NO')} NOK
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
            {BH_VEDERLAGSSVAR_OPTIONS.map((option) => (
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

        {/* Godkjent beløp - show if godkjent, delvis_godkjent, or godkjent_annen_metode */}
        {showAmountField && (
          <div>
            <label htmlFor="godkjent_belop" className="block text-sm font-medium text-gray-700">
              Godkjent beløp (NOK){' '}
              {selectedResultat === 'godkjent_fullt' ? <span className="text-error">*</span> : ''}
            </label>
            <input
              id="godkjent_belop"
              type="number"
              step="0.01"
              {...register('godkjent_belop', { valueAsNumber: true })}
              className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
              placeholder="0.00"
              aria-invalid={!!errors.godkjent_belop}
              aria-describedby={errors.godkjent_belop ? 'godkjent_belop-error' : undefined}
            />
            {errors.godkjent_belop && (
              <p id="godkjent_belop-error" className="mt-pkt-02 text-sm text-error" role="alert">
                {errors.godkjent_belop.message}
              </p>
            )}
            {krevdBelop !== undefined && godkjentBelop !== undefined && (
              <p className="mt-pkt-02 text-xs text-gray-600">
                Differanse: {(krevdBelop - godkjentBelop).toLocaleString('nb-NO')} NOK (
                {((godkjentBelop / krevdBelop) * 100).toFixed(1)}% godkjent)
              </p>
            )}
          </div>
        )}

        {/* Godkjent metode - only show if godkjent_annen_metode */}
        {showMethodField && (
          <div>
            <label htmlFor="godkjent_metode" className="block text-sm font-medium text-gray-700">
              Godkjent vederlagsmetode <span className="text-error">*</span>
            </label>
            <select
              id="godkjent_metode"
              {...register('godkjent_metode')}
              className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            >
              {VEDERLAGSMETODER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-pkt-02 text-xs text-gray-500">
              Hvis godkjent med annen metode, velg metoden her
            </p>
          </div>
        )}

        {/* Status indicator based on selection */}
        {selectedResultat && (
          <div
            className={`p-pkt-04 rounded-pkt-md ${
              selectedResultat === 'godkjent_fullt' || selectedResultat === 'godkjent_annen_metode'
                ? 'bg-success-100 border border-success-500'
                : selectedResultat === 'delvis_godkjent' ||
                  selectedResultat === 'avventer_spesifikasjon'
                ? 'bg-warning-100 border border-warning-500'
                : 'bg-error-100 border border-error-500'
            }`}
          >
            <p className="text-sm font-medium">
              {selectedResultat === 'godkjent_fullt'
                ? '✓ Kravet vil bli godkjent fullt ut'
                : selectedResultat === 'godkjent_annen_metode'
                ? '✓ Kravet vil bli godkjent med annen metode'
                : selectedResultat === 'delvis_godkjent'
                ? '◐ Kravet vil bli delvis godkjent'
                : selectedResultat === 'avventer_spesifikasjon'
                ? '⏸ Avventer nærmere spesifikasjon'
                : '✗ Kravet vil bli avslått'}
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
            placeholder="Begrunn din vurdering av vederlagskravet..."
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
