/**
 * RespondGrunnlagModal Component
 *
 * Action modal for BH (client) to respond to a grunnlag claim.
 * Uses React Hook Form + Zod for validation.
 * Now uses Radix UI primitives with Punkt design system styling.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/Select';
import { useForm, Controller } from 'react-hook-form';
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
    control,
  } = useForm<RespondGrunnlagFormData>({
    resolver: zodResolver(respondGrunnlagSchema),
    defaultValues: {
      resultat: undefined,
    },
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Resultat */}
        <FormField
          label="Resultat"
          required
          error={errors.resultat?.message}
        >
          <Controller
            name="resultat"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger error={!!errors.resultat}>
                  <SelectValue placeholder="Velg resultat" />
                </SelectTrigger>
                <SelectContent>
                  {RESULTAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {/* Status indicator based on selection */}
        {selectedResultat && (
          <div
            className={`p-pkt-05 rounded-none border-2 ${
              selectedResultat === 'godkjent'
                ? 'bg-pkt-surface-faded-green border-pkt-border-green'
                : selectedResultat === 'delvis_godkjent'
                ? 'bg-pkt-surface-yellow border-pkt-border-yellow'
                : 'bg-pkt-surface-faded-red border-pkt-border-red'
            }`}
          >
            <p className="text-base font-medium text-pkt-text-body-dark">
              {selectedResultat === 'godkjent'
                ? '✓ Grunnlaget vil bli godkjent'
                : selectedResultat === 'delvis_godkjent'
                ? '◐ Grunnlaget vil bli delvis godkjent'
                : '✗ Grunnlaget vil bli avvist eller krever avklaring'}
            </p>
          </div>
        )}

        {/* Begrunnelse */}
        <FormField
          label="Begrunnelse"
          required
          error={errors.begrunnelse?.message}
        >
          <Textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={5}
            fullWidth
            placeholder="Begrunn din vurdering av grunnlaget..."
            error={!!errors.begrunnelse}
          />
        </FormField>

        {/* Error Message */}
        {mutation.isError && (
          <div
            className="p-pkt-05 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <p className="text-base text-pkt-border-red font-medium">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-pkt-04 pt-pkt-06 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            size="lg"
          >
            Avbryt
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} size="lg">
            {isSubmitting ? 'Sender...' : 'Send svar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
