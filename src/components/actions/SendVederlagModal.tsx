/**
 * SendVederlagModal Component
 *
 * Action modal for submitting a new vederlag (compensation) claim.
 * Uses React Hook Form + Zod for validation.
 * Now includes legacy NS 8407 payment methods.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { VEDERLAGSMETODER_OPTIONS } from '../../constants';

const vederlagSchema = z.object({
  krav_belop: z.number().min(1, 'Beløp må være større enn 0'),
  metode: z.string().min(1, 'Metode er påkrevd'),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  inkluderer_produktivitetstap: z.boolean().optional(),
  inkluderer_rigg_drift: z.boolean().optional(),
  saerskilt_varsel_rigg_drift: z.boolean().optional(),
});

type VederlagFormData = z.infer<typeof vederlagSchema>;

interface SendVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

export function SendVederlagModal({
  open,
  onOpenChange,
  sakId,
}: SendVederlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<VederlagFormData>({
    resolver: zodResolver(vederlagSchema),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: VederlagFormData) => {
    mutation.mutate({
      eventType: 'vederlag_krav_sendt',
      data,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send vederlagskrav"
      description="Fyll ut detaljer for det nye vederlagskravet."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-05">
        {/* Amount Field */}
        <div>
          <label htmlFor="krav_belop" className="block text-sm font-medium text-gray-700">
            Krevd beløp (NOK) <span className="text-error">*</span>
          </label>
          <input
            id="krav_belop"
            type="number"
            step="0.01"
            {...register('krav_belop', { valueAsNumber: true })}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            placeholder="0.00"
            aria-required="true"
            aria-invalid={!!errors.krav_belop}
            aria-describedby={errors.krav_belop ? 'krav_belop-error' : undefined}
          />
          {errors.krav_belop && (
            <p id="krav_belop-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.krav_belop.message}
            </p>
          )}
        </div>

        {/* Method Field - Using NS 8407 options */}
        <div>
          <label htmlFor="metode" className="block text-sm font-medium text-gray-700">
            Vederlagsmetode (NS 8407) <span className="text-error">*</span>
          </label>
          <select
            id="metode"
            {...register('metode')}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            aria-required="true"
            aria-invalid={!!errors.metode}
            aria-describedby={errors.metode ? 'metode-error' : undefined}
          >
            {VEDERLAGSMETODER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.metode && (
            <p id="metode-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.metode.message}
            </p>
          )}
          <p className="mt-pkt-02 text-xs text-gray-500">
            Hvilken beregningsmetode brukes for vederlagskravet?
          </p>
        </div>

        {/* Justification Field */}
        <div>
          <label htmlFor="begrunnelse" className="block text-sm font-medium text-gray-700">
            Begrunnelse <span className="text-error">*</span>
          </label>
          <textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={4}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            placeholder="Beskriv hvordan beløpet er beregnet..."
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

        {/* Checkboxes */}
        <div className="space-y-pkt-03">
          <div className="flex items-center">
            <input
              id="inkluderer_produktivitetstap"
              type="checkbox"
              {...register('inkluderer_produktivitetstap')}
              className="h-4 w-4 rounded border-gray-300 text-oslo-blue focus:ring-oslo-blue"
            />
            <label
              htmlFor="inkluderer_produktivitetstap"
              className="ml-pkt-02 text-sm text-gray-700"
            >
              Inkluderer produktivitetstap
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="inkluderer_rigg_drift"
              type="checkbox"
              {...register('inkluderer_rigg_drift')}
              className="h-4 w-4 rounded border-gray-300 text-oslo-blue focus:ring-oslo-blue"
            />
            <label htmlFor="inkluderer_rigg_drift" className="ml-pkt-02 text-sm text-gray-700">
              Inkluderer rigg/drift
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="saerskilt_varsel_rigg_drift"
              type="checkbox"
              {...register('saerskilt_varsel_rigg_drift')}
              className="h-4 w-4 rounded border-gray-300 text-oslo-blue focus:ring-oslo-blue"
            />
            <label
              htmlFor="saerskilt_varsel_rigg_drift"
              className="ml-pkt-02 text-sm text-gray-700"
            >
              Særskilt varsel for rigg/drift sendt
            </label>
          </div>
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
            {isSubmitting ? 'Sender...' : 'Send krav'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
