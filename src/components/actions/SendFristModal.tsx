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
import { DatePicker } from '../primitives/DatePicker';
import { FormField } from '../primitives/FormField';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import {
  FRIST_VARSELTYPE_OPTIONS,
  getFristVarseltypeValues,
  FRIST_VARSELTYPE_DESCRIPTIONS,
  VARSEL_METODER_OPTIONS,
} from '../../constants';

const fristSchema = z.object({
  varsel_type: z.enum(getFristVarseltypeValues(), {
    errorMap: () => ({ message: 'Varseltype er påkrevd' }),
  }),

  // VarselInfo for nøytralt varsel (§33.4)
  noytralt_varsel_sendes_na: z.boolean().optional(),
  noytralt_varsel_dato: z.string().optional(),
  noytralt_varsel_metoder: z.array(z.string()).optional(),

  // VarselInfo for spesifisert krav (§33.6)
  spesifisert_varsel_sendes_na: z.boolean().optional(),
  spesifisert_varsel_dato: z.string().optional(),
  spesifisert_varsel_metoder: z.array(z.string()).optional(),

  antall_dager: z.number().min(0, 'Antall dager kan ikke være negativt').optional(),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  ny_sluttdato: z.string().optional(),
  vedlegg_ids: z.array(z.string()).optional(),
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
    watch,
  } = useForm<FristFormData>({
    resolver: zodResolver(fristSchema),
    defaultValues: {
      varsel_type: '',
      noytralt_varsel_sendes_na: false,
      noytralt_varsel_metoder: [],
      spesifisert_varsel_sendes_na: false,
      spesifisert_varsel_metoder: [],
      vedlegg_ids: [],
    },
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  // Watch for conditional rendering
  const selectedVarselType = watch('varsel_type');
  const noytraltVarselSendesNa = watch('noytralt_varsel_sendes_na');
  const spesifisertVarselSendesNa = watch('spesifisert_varsel_sendes_na');

  const onSubmit = (data: FristFormData) => {
    // Build VarselInfo structures
    // For nøytralt varsel: use today's date and 'system' method if "sendes nå" is checked
    const noytraltDato = data.noytralt_varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.noytralt_varsel_dato;

    const noytraltMetode = data.noytralt_varsel_sendes_na
      ? ['system']
      : (data.noytralt_varsel_metoder || []);

    const noytraltVarsel = noytraltDato
      ? {
          dato_sendt: noytraltDato,
          metode: noytraltMetode,
        }
      : undefined;

    // For spesifisert varsel: use today's date and 'system' method if "sendes nå" is checked
    const spesifisertDato = data.spesifisert_varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.spesifisert_varsel_dato;

    const spesifisertMetode = data.spesifisert_varsel_sendes_na
      ? ['system']
      : (data.spesifisert_varsel_metoder || []);

    const spesifisertVarsel = spesifisertDato
      ? {
          dato_sendt: spesifisertDato,
          metode: spesifisertMetode,
        }
      : undefined;

    mutation.mutate({
      eventType: 'frist_krav_sendt',
      data: {
        varsel_type: data.varsel_type,
        noytralt_varsel: noytraltVarsel,
        spesifisert_varsel: spesifisertVarsel,
        antall_dager: data.antall_dager,
        begrunnelse: data.begrunnelse,
        ny_sluttdato: data.ny_sluttdato,
        vedlegg_ids: data.vedlegg_ids,
      },
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
        {/* Varsel Type - NS 8407 §33 */}
        <FormField
          label="Type varsel/krav (NS 8407 §33)"
          required
          error={errors.varsel_type?.message}
          labelTooltip="Velg hvordan du varsler fristkrav iht. §33. Nøytralt varsel sendes først når omfang ikke er kjent."
          helpText={selectedVarselType && FRIST_VARSELTYPE_DESCRIPTIONS[selectedVarselType] ? FRIST_VARSELTYPE_DESCRIPTIONS[selectedVarselType] : undefined}
        >
          <Controller
            name="varsel_type"
            control={control}
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange}>
                {FRIST_VARSELTYPE_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                  <RadioItem
                    key={option.value}
                    id={`varsel_type_${option.value}`}
                    value={option.value}
                    label={option.label}
                  />
                ))}
              </RadioGroup>
            )}
          />
        </FormField>

        {/* VarselInfo fields based on selected type */}
        {(selectedVarselType === 'noytralt' || selectedVarselType === 'begge') && (
          <div className="p-pkt-05 bg-pkt-surface-subtle-light-blue rounded-none border-2 border-pkt-border-focus">
            <h4 className="text-base font-medium text-pkt-text-body-default mb-pkt-04">
              Nøytralt/Foreløpig varsel (§33.4)
            </h4>

            <div className="space-y-pkt-04">
              <Controller
                name="noytralt_varsel_sendes_na"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="noytralt_varsel_sendes_na"
                    label="Varsel sendes nå (sammen med dette skjemaet)"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />

              {!noytraltVarselSendesNa && (
                <FormField
                  label="Dato nøytralt varsel sendt tidligere"
                  error={errors.noytralt_varsel_dato?.message}
                  labelTooltip="§33.4: Sendes når omfang ikke er kjent. Bevarer rett til senere spesifisert krav."
                >
                  <Controller
                    name="noytralt_varsel_dato"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="noytralt_varsel_dato"
                        value={field.value}
                        onChange={field.onChange}
                        fullWidth
                        error={!!errors.noytralt_varsel_dato}
                        placeholder="Velg dato"
                      />
                    )}
                  />
                </FormField>
              )}

              {/* Varselmetoder - only show if NOT sending now */}
              {!noytraltVarselSendesNa && (
                <FormField
                  label="Varselmetoder (nøytralt)"
                  helpText="Velg alle metoder som ble brukt"
                >
                  <div className="space-y-pkt-03 border-2 border-pkt-border-gray rounded-none p-pkt-04 bg-pkt-bg-subtle">
                    {VARSEL_METODER_OPTIONS.map((option) => (
                      <Checkbox
                        key={option.value}
                        id={`noytralt_varsel-${option.value}`}
                        label={option.label}
                        value={option.value}
                        {...register('noytralt_varsel_metoder')}
                      />
                    ))}
                  </div>
                </FormField>
              )}
            </div>
          </div>
        )}

        {(selectedVarselType === 'spesifisert' || selectedVarselType === 'begge') && (
          <div className="p-pkt-05 bg-pkt-surface-subtle-light-blue rounded-none border-2 border-pkt-border-focus">
            <h4 className="text-base font-medium text-pkt-text-body-default mb-pkt-04">
              Spesifisert krav (§33.6)
            </h4>

            <div className="space-y-pkt-04">
              <Controller
                name="spesifisert_varsel_sendes_na"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="spesifisert_varsel_sendes_na"
                    label="Varsel sendes nå (sammen med dette skjemaet)"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />

              {!spesifisertVarselSendesNa && (
                <FormField
                  label="Dato spesifisert krav sendt tidligere"
                  error={errors.spesifisert_varsel_dato?.message}
                  labelTooltip="§33.6.1: Konkret krav med antall dager og begrunnelse. Må sendes innen rimelig tid etter at omfang er kjent."
                >
                  <Controller
                    name="spesifisert_varsel_dato"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="spesifisert_varsel_dato"
                        value={field.value}
                        onChange={field.onChange}
                        fullWidth
                        error={!!errors.spesifisert_varsel_dato}
                        placeholder="Velg dato"
                      />
                    )}
                  />
                </FormField>
              )}

              {/* Varselmetoder - only show if NOT sending now */}
              {!spesifisertVarselSendesNa && (
                <FormField
                  label="Varselmetoder (spesifisert)"
                  helpText="Velg alle metoder som ble brukt"
                >
                  <div className="space-y-pkt-03 border-2 border-pkt-border-gray rounded-none p-pkt-04 bg-pkt-bg-subtle">
                    {VARSEL_METODER_OPTIONS.map((option) => (
                      <Checkbox
                        key={option.value}
                        id={`spesifisert_varsel-${option.value}`}
                        label={option.label}
                        value={option.value}
                        {...register('spesifisert_varsel_metoder')}
                      />
                    ))}
                  </div>
                </FormField>
              )}
            </div>
          </div>
        )}

        {/* Number of Days - Required for spesifisert, optional for noytralt */}
        {(selectedVarselType === 'spesifisert' || selectedVarselType === 'begge' || selectedVarselType === 'force_majeure') && (
          <FormField
            label="Antall dager fristforlengelse"
            required={selectedVarselType === 'spesifisert' || selectedVarselType === 'force_majeure'}
            error={errors.antall_dager?.message}
            helpText={selectedVarselType === 'begge' ? 'Skal fylles ut sammen med spesifisert krav' : undefined}
          >
            <Input
              id="antall_dager"
              type="number"
              {...register('antall_dager', {
                setValueAs: (v) => (v === '' ? undefined : Number(v)),
              })}
              fullWidth
              placeholder="0"
              min={0}
              error={!!errors.antall_dager}
            />
          </FormField>
        )}

        {/* Ny sluttdato */}
        {selectedVarselType !== 'noytralt' && (
          <FormField
            label="Ny forventet sluttdato"
            error={errors.ny_sluttdato?.message}
            helpText="Forventet ny sluttdato etter fristforlengelsen"
          >
            <Controller
              name="ny_sluttdato"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="ny_sluttdato"
                  value={field.value}
                  onChange={field.onChange}
                  fullWidth
                  error={!!errors.ny_sluttdato}
                  placeholder="Velg dato"
                />
              )}
            />
          </FormField>
        )}

        {/* Begrunnelse for fristforlengelse */}
        <FormField
          label="Begrunnelse for fristforlengelse"
          required
          error={errors.begrunnelse?.message}
          helpText="Redegjør for hvorfor det aktuelle forholdet medfører at fremdriften hindres"
        >
          <Textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={5}
            fullWidth
            placeholder="Beskriv hvorfor fristforlengelse er nødvendig og hvordan det påvirker fremdriften..."
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
            {isSubmitting ? 'Sender...' : 'Send fristkrav'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
