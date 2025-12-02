/**
 * RespondGrunnlagModal Component
 *
 * Action modal for BH (client) to respond to a grunnlag claim.
 * Uses React Hook Form + Zod for validation.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { ResponsResultat } from '../../types/timeline';

const respondGrunnlagSchema = z.object({
  resultat: z.enum(
    ['godkjent', 'delvis_godkjent', 'avvist_uenig', 'avvist_for_sent', 'krever_avklaring'],
    {
      errorMap: () => ({ message: 'Resultat er påkrevd' }),
    }
  ),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
});

type RespondGrunnlagFormData = z.infer<typeof respondGrunnlagSchema>;

interface RespondGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

const RESULTAT_OPTIONS: Array<{ value: ResponsResultat; label: string }> = [
  { value: 'godkjent', label: 'Godkjent' },
  { value: 'delvis_godkjent', label: 'Delvis godkjent' },
  { value: 'avvist_uenig', label: 'Avvist - uenig i grunnlaget' },
  { value: 'avvist_for_sent', label: 'Avvist - for sent varsel' },
  { value: 'krever_avklaring', label: 'Krever ytterligere avklaring' },
];

export function RespondGrunnlagModal({
  open,
  onOpenChange,
  sakId,
}: RespondGrunnlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<RespondGrunnlagFormData>({
    resolver: zodResolver(respondGrunnlagSchema),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const selectedResultat = watch('resultat');

  const onSubmit = (data: RespondGrunnlagFormData) => {
    mutation.mutate({
      eventType: 'respons_grunnlag',
      data,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Svar på grunnlag"
      description="Gi din vurdering av grunnlaget for endringsmeldingen."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-05">
        {/* Resultat */}
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
            <option value="">Velg resultat</option>
            {RESULTAT_OPTIONS.map((option) => (
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

        {/* Status indicator based on selection */}
        {selectedResultat && (
          <div
            className={`p-pkt-04 rounded-pkt-md ${
              selectedResultat === 'godkjent'
                ? 'bg-success-100 border border-success-500'
                : selectedResultat === 'delvis_godkjent'
                ? 'bg-warning-100 border border-warning-500'
                : 'bg-error-100 border border-error-500'
            }`}
          >
            <p className="text-sm font-medium">
              {selectedResultat === 'godkjent'
                ? '✓ Grunnlaget vil bli godkjent'
                : selectedResultat === 'delvis_godkjent'
                ? '◐ Grunnlaget vil bli delvis godkjent'
                : '✗ Grunnlaget vil bli avvist eller krever avklaring'}
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
            placeholder="Begrunn din vurdering av grunnlaget..."
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
