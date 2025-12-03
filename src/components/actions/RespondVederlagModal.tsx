/**
 * RespondVederlagModal Component
 *
 * Action modal for BH (client) to respond to a vederlag (compensation) claim.
 * Includes fields for approved amount and result.
 * Now includes legacy NS 8407 response options.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
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
import {
  BH_VEDERLAGSSVAR_OPTIONS,
  VEDERLAGSMETODER_OPTIONS,
  getBhVederlagssvarValues,
  BH_VEDERLAGSSVAR_DESCRIPTIONS,
} from '../../constants';

const respondVederlagSchema = z.object({
  resultat: z.enum(getBhVederlagssvarValues(), {
    errorMap: () => ({ message: 'Resultat er påkrevd' }),
  }),
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
    control,
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
      description="Vurder beregning og beløp (ren utmåling). Ansvarsvurdering håndteres i Grunnlag-sporet."
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

        {/* Resultat - Using NS 8407 response options */}
        <FormField
          label="Resultat (vederlagsberegning)"
          required
          error={errors.resultat?.message}
          labelTooltip="Vurder BARE beregningen/beløpet. Ansvarsvurdering håndteres i Grunnlag-sporet. Subsidiær vurdering tillatt."
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
                  {BH_VEDERLAGSSVAR_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {/* Show description of selected resultat */}
        {selectedResultat && BH_VEDERLAGSSVAR_DESCRIPTIONS[selectedResultat] && (
          <div className="p-pkt-04 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
            <p className="text-sm text-pkt-text-body-subtle">
              {BH_VEDERLAGSSVAR_DESCRIPTIONS[selectedResultat]}
            </p>
          </div>
        )}

        {/* Godkjent beløp - show if godkjent, delvis_godkjent, or godkjent_annen_metode */}
        {showAmountField && (
          <FormField
            label="Godkjent beløp (NOK)"
            required={selectedResultat === 'godkjent_fullt'}
            error={errors.godkjent_belop?.message}
            helpText={
              krevdBelop !== undefined && godkjentBelop !== undefined
                ? `Differanse: ${(krevdBelop - godkjentBelop).toLocaleString('nb-NO')} NOK (${((godkjentBelop / krevdBelop) * 100).toFixed(1)}% godkjent)`
                : undefined
            }
          >
            <Input
              id="godkjent_belop"
              type="number"
              step="0.01"
              {...register('godkjent_belop', { valueAsNumber: true })}
              fullWidth
              placeholder="0.00"
              error={!!errors.godkjent_belop}
            />
          </FormField>
        )}

        {/* Godkjent metode - only show if godkjent_annen_metode */}
        {showMethodField && (
          <FormField
            label="Godkjent vederlagsmetode"
            required
            error={errors.godkjent_metode?.message}
            helpText="BH endrer beregningsmetode (f.eks. fra 'Regningsarbeid' til 'Fastpris'). Krever ofte aksept fra TE."
          >
            <Controller
              name="godkjent_metode"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger error={!!errors.godkjent_metode}>
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
            placeholder="Begrunn din vurdering av vederlagskravet..."
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
