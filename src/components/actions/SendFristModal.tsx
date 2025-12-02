/**
 * SendFristModal Component
 *
 * Action modal for submitting a new frist (deadline extension) claim.
 * Uses React Hook Form + Zod for validation.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';

const fristSchema = z.object({
  antall_dager: z.number().min(1, 'Antall dager må være minst 1'),
  frist_type: z.enum(['kalenderdager', 'arbeidsdager'], {
    errorMap: () => ({ message: 'Fristtype er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  pavirker_kritisk_linje: z.boolean().optional(),
});

type FristFormData = z.infer<typeof fristSchema>;

interface SendFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

export function SendFristModal({
  open,
  onOpenChange,
  sakId,
}: SendFristModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FristFormData>({
    resolver: zodResolver(fristSchema),
    defaultValues: {
      frist_type: 'kalenderdager',
    },
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: FristFormData) => {
    mutation.mutate({
      eventType: 'frist_krav_sendt',
      data,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send fristkrav"
      description="Fyll ut informasjon om fristforlengelsen."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-05">
        {/* Number of Days */}
        <div>
          <label htmlFor="antall_dager" className="block text-sm font-medium text-gray-700">
            Antall dager <span className="text-error">*</span>
          </label>
          <input
            id="antall_dager"
            type="number"
            {...register('antall_dager', { valueAsNumber: true })}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            placeholder="0"
            min="1"
            aria-required="true"
            aria-invalid={!!errors.antall_dager}
            aria-describedby={errors.antall_dager ? 'antall_dager-error' : undefined}
          />
          {errors.antall_dager && (
            <p id="antall_dager-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.antall_dager.message}
            </p>
          )}
        </div>

        {/* Deadline Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-pkt-02">
            Fristtype <span className="text-error">*</span>
          </label>
          <div className="space-y-pkt-02">
            <div className="flex items-center">
              <input
                id="frist_type_kalender"
                type="radio"
                value="kalenderdager"
                {...register('frist_type')}
                className="h-4 w-4 border-gray-300 text-oslo-blue focus:ring-oslo-blue"
              />
              <label htmlFor="frist_type_kalender" className="ml-pkt-02 text-sm text-gray-700">
                Kalenderdager
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="frist_type_arbeid"
                type="radio"
                value="arbeidsdager"
                {...register('frist_type')}
                className="h-4 w-4 border-gray-300 text-oslo-blue focus:ring-oslo-blue"
              />
              <label htmlFor="frist_type_arbeid" className="ml-pkt-02 text-sm text-gray-700">
                Arbeidsdager
              </label>
            </div>
          </div>
          {errors.frist_type && (
            <p className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.frist_type.message}
            </p>
          )}
        </div>

        {/* Justification */}
        <div>
          <label htmlFor="begrunnelse" className="block text-sm font-medium text-gray-700">
            Begrunnelse <span className="text-error">*</span>
          </label>
          <textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={4}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            placeholder="Beskriv hvorfor fristforlengelse er nødvendig..."
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

        {/* Critical Path Checkbox */}
        <div className="flex items-center">
          <input
            id="pavirker_kritisk_linje"
            type="checkbox"
            {...register('pavirker_kritisk_linje')}
            className="h-4 w-4 rounded border-gray-300 text-oslo-blue focus:ring-oslo-blue"
          />
          <label htmlFor="pavirker_kritisk_linje" className="ml-pkt-02 text-sm text-gray-700">
            Påvirker kritisk linje
          </label>
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
            {isSubmitting ? 'Sender...' : 'Send fristkrav'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
