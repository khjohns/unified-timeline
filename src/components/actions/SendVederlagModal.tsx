/**
 * SendVederlagModal Component
 *
 * Action modal for submitting a new vederlag (compensation) claim.
 * Uses React Hook Form + Zod for validation.
 * Now uses Radix UI primitives with Punkt design system styling.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Checkbox } from '../primitives/Checkbox';
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
    control,
  } = useForm<VederlagFormData>({
    resolver: zodResolver(vederlagSchema),
    defaultValues: {
      metode: '',
    },
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Amount Field */}
        <FormField
          label="Krevd beløp (NOK)"
          required
          error={errors.krav_belop?.message}
        >
          <Input
            id="krav_belop"
            type="number"
            step="0.01"
            {...register('krav_belop', { valueAsNumber: true })}
            fullWidth
            placeholder="0.00"
            error={!!errors.krav_belop}
          />
        </FormField>

        {/* Method Field - Using NS 8407 options */}
        <FormField
          label="Vederlagsmetode (NS 8407)"
          required
          error={errors.metode?.message}
          helpText="Hvilken beregningsmetode brukes for vederlagskravet?"
        >
          <Controller
            name="metode"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger error={!!errors.metode}>
                  <SelectValue placeholder="Velg metode" />
                </SelectTrigger>
                <SelectContent>
                  {VEDERLAGSMETODER_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {/* Justification Field */}
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
            placeholder="Beskriv hvordan beløpet er beregnet..."
            error={!!errors.begrunnelse}
          />
        </FormField>

        {/* Checkboxes */}
        <div className="space-y-pkt-03">
          <Checkbox
            id="inkluderer_produktivitetstap"
            label="Inkluderer produktivitetstap"
            {...register('inkluderer_produktivitetstap')}
          />
          <Checkbox
            id="inkluderer_rigg_drift"
            label="Inkluderer rigg/drift"
            {...register('inkluderer_rigg_drift')}
          />
          <Checkbox
            id="saerskilt_varsel_rigg_drift"
            label="Særskilt varsel for rigg/drift sendt"
            {...register('saerskilt_varsel_rigg_drift')}
          />
        </div>

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
            {isSubmitting ? 'Sender...' : 'Send krav'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
