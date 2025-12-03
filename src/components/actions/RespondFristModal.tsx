/**
 * RespondFristModal Component
 *
 * Action modal for BH (client) to respond to a frist (deadline extension) claim.
 * Includes fields for approved number of days and result.
 * Now includes legacy NS 8407 response options.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { DatePicker } from '../primitives/DatePicker';
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
  BH_FRISTSVAR_OPTIONS,
  getBhFristsvarValues,
  BH_FRISTSVAR_DESCRIPTIONS,
} from '../../constants';

const respondFristSchema = z.object({
  resultat: z.enum(getBhFristsvarValues(), {
    errorMap: () => ({ message: 'Resultat er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  godkjent_dager: z.number().min(0, 'Antall dager kan ikke være negativt').optional(),
  frist_for_spesifisering: z.string().optional(),
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
    control,
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
    selectedResultat === 'delvis_godkjent';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Svar på fristkrav"
      description="Vurder tid-beregning (ren utmåling). Ansvarsvurdering håndteres i Grunnlag-sporet."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Show claimed days if available */}
        {krevdDager !== undefined && (
          <div className="p-pkt-04 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <p className="text-sm font-medium text-pkt-text-body-default">
              Krevd forlengelse: {krevdDager} {fristType || 'dager'}
            </p>
          </div>
        )}

        {/* Resultat - Using NS 8407 response options */}
        <FormField
          label="Resultat (fristberegning)"
          required
          error={errors.resultat?.message}
          labelTooltip="Vurder BARE dagberegningen. Ansvarsvurdering håndteres i Grunnlag-sporet. Subsidiær vurdering tillatt."
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
                  {BH_FRISTSVAR_OPTIONS.filter(opt => opt.value !== '').map((option) => (
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
        {selectedResultat && BH_FRISTSVAR_DESCRIPTIONS[selectedResultat] && (
          <div className="p-pkt-04 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
            <p className="text-sm text-pkt-text-body-subtle">
              {BH_FRISTSVAR_DESCRIPTIONS[selectedResultat]}
            </p>
          </div>
        )}

        {/* Godkjent dager - only show if godkjent or delvis_godkjent */}
        {showDaysField && (
          <FormField
            label="Godkjent antall dager"
            required={selectedResultat === 'godkjent_fullt'}
            error={errors.godkjent_dager?.message}
            helpText={
              krevdDager !== undefined && godkjentDager !== undefined
                ? `Differanse: ${krevdDager - godkjentDager} dager (${((godkjentDager / krevdDager) * 100).toFixed(1)}% godkjent)`
                : selectedResultat === 'delvis_godkjent'
                ? 'BH mener forsinkelsen er kortere enn TE krever'
                : undefined
            }
          >
            <Input
              id="godkjent_dager"
              type="number"
              {...register('godkjent_dager', { valueAsNumber: true })}
              fullWidth
              placeholder="0"
              error={!!errors.godkjent_dager}
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
            placeholder="Begrunn din vurdering av fristkravet..."
            error={!!errors.begrunnelse}
          />
        </FormField>

        {/* Frist for spesifisering - only show when avventer_spesifikasjon */}
        {selectedResultat === 'avventer_spesifikasjon' && (
          <FormField
            label="Frist for spesifisering"
            error={errors.frist_for_spesifisering?.message}
            helpText="Angi fristen innen hvilken entreprenøren må levere ytterligere spesifikasjon av kravet."
          >
            <Controller
              name="frist_for_spesifisering"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="frist_for_spesifisering"
                  value={field.value}
                  onChange={field.onChange}
                  fullWidth
                  error={!!errors.frist_for_spesifisering}
                  placeholder="Velg dato"
                />
              )}
            />
          </FormField>
        )}

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
