/**
 * SendFristModal Component
 *
 * Action modal for submitting a new frist (deadline extension) claim.
 * Uses React Hook Form + Zod for validation.
 * Now uses Radix UI primitives with Punkt design system styling.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Checkbox } from '../primitives/Checkbox';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { FormField } from '../primitives/FormField';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';

const fristSchema = z.object({
  antall_dager: z.number().min(1, 'Antall dager må være minst 1'),
  frist_type: z.enum(['uspesifisert_krav', 'spesifisert_krav'], {
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
    control,
  } = useForm<FristFormData>({
    resolver: zodResolver(fristSchema),
    defaultValues: {
      frist_type: 'uspesifisert_krav',
      pavirker_kritisk_linje: false,
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Number of Days */}
        <FormField
          label="Antall dager"
          required
          error={errors.antall_dager?.message}
        >
          <Input
            id="antall_dager"
            type="number"
            {...register('antall_dager', { valueAsNumber: true })}
            fullWidth
            placeholder="0"
            min={1}
            error={!!errors.antall_dager}
          />
        </FormField>

        {/* Deadline Type - NS 8407 Compliant */}
        <FormField
          label="Type fristkrav (NS 8407)"
          required
          error={errors.frist_type?.message}
          helpText="Uspesifisert: Krav fremsettes uten fullstendig spesifikasjon. Spesifisert: Detaljert dokumentert krav."
        >
          <Controller
            name="frist_type"
            control={control}
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange}>
                <RadioItem
                  id="frist_type_uspesifisert"
                  value="uspesifisert_krav"
                  label="Uspesifisert krav (§33.6.2)"
                />
                <RadioItem
                  id="frist_type_spesifisert"
                  value="spesifisert_krav"
                  label="Spesifisert krav (§33.6.1)"
                />
              </RadioGroup>
            )}
          />
        </FormField>

        {/* Justification */}
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
            placeholder="Beskriv hvorfor fristforlengelse er nødvendig..."
            error={!!errors.begrunnelse}
          />
        </FormField>

        {/* Critical Path Checkbox */}
        <Checkbox
          id="pavirker_kritisk_linje"
          label="Påvirker kritisk linje"
          {...register('pavirker_kritisk_linje')}
        />

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
            {isSubmitting ? 'Sender...' : 'Send fristkrav'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
