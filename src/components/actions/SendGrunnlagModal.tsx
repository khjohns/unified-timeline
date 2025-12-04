/**
 * SendGrunnlagModal Component
 *
 * Action modal for submitting a new grunnlag (basis/foundation) claim.
 * Uses React Hook Form + Zod for validation.
 * Now uses Radix UI primitives with Punkt design system styling.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Checkbox } from '../primitives/Checkbox';
import { DatePicker } from '../primitives/DatePicker';
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
import { useState } from 'react';
import {
  HOVEDKATEGORI_OPTIONS,
  getUnderkategorier,
  VARSEL_METODER_OPTIONS,
} from '../../constants';

const grunnlagSchema = z.object({
  hovedkategori: z.string().min(1, 'Hovedkategori er påkrevd'),
  underkategori: z.array(z.string()).min(1, 'Minst én underkategori må velges'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato oppdaget er påkrevd'),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
  kontraktsreferanser: z.string().optional(),
});

type GrunnlagFormData = z.infer<typeof grunnlagSchema>;

interface SendGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

export function SendGrunnlagModal({
  open,
  onOpenChange,
  sakId,
}: SendGrunnlagModalProps) {
  const [selectedHovedkategori, setSelectedHovedkategori] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
    watch,
  } = useForm<GrunnlagFormData>({
    resolver: zodResolver(grunnlagSchema),
    defaultValues: {
      hovedkategori: '',
      underkategori: [],
      varsel_metode: [],
    },
  });

  const hovedkategoriValue = watch('hovedkategori');
  const varselSendesNa = watch('varsel_sendes_na');

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      setSelectedHovedkategori('');
      onOpenChange(false);
    },
  });

  // Reset underkategori when hovedkategori changes
  const handleHovedkategoriChange = (value: string) => {
    setSelectedHovedkategori(value);
    setValue('hovedkategori', value);
    setValue('underkategori', []); // Clear underkategorier when hovedkategori changes
  };

  const onSubmit = (data: GrunnlagFormData) => {
    // Convert comma-separated string to array
    const kontraktsreferanser = data.kontraktsreferanser
      ? data.kontraktsreferanser.split(',').map((ref) => ref.trim())
      : [];

    // Build VarselInfo structure if varsel data is provided
    // If "varsel sendes nå" is checked, use today's date
    const varselDato = data.varsel_sendes_na
      ? new Date().toISOString().split('T')[0]  // Today's date in YYYY-MM-DD format
      : data.dato_varsel_sendt;

    const grunnlagVarsel = varselDato
      ? {
          dato_sendt: varselDato,
          metode: data.varsel_metode || [],
        }
      : undefined;

    mutation.mutate({
      eventType: 'grunnlag_opprettet',
      data: {
        hovedkategori: data.hovedkategori,
        underkategori: data.underkategori,
        beskrivelse: data.beskrivelse,
        dato_oppdaget: data.dato_oppdaget,
        grunnlag_varsel: grunnlagVarsel,
        kontraktsreferanser,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send grunnlag"
      description="Fyll ut informasjon om grunnlaget for endringsmeldingen."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Hovedkategori */}
        <FormField
          label="Hovedkategori (NS 8407)"
          required
          error={errors.hovedkategori?.message}
          labelTooltip="Velg juridisk grunnlag iht. NS 8407. Dette bestemmer hvilke kontraktsbestemmelser som gjelder og hvilke krav som kan fremmes."
        >
          <Controller
            name="hovedkategori"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleHovedkategoriChange(value);
                }}
              >
                <SelectTrigger error={!!errors.hovedkategori}>
                  <SelectValue placeholder="Velg hovedkategori" />
                </SelectTrigger>
                <SelectContent>
                  {HOVEDKATEGORI_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {/* Underkategori - Dynamic based on hovedkategori */}
        {selectedHovedkategori && getUnderkategorier(selectedHovedkategori).length > 0 && (
          <FormField
            label="Underkategori"
            required
            error={errors.underkategori?.message}
          >
            <div className="space-y-pkt-03 max-h-60 overflow-y-auto border-2 border-pkt-border-gray rounded-none p-pkt-04 bg-pkt-bg-subtle">
              {getUnderkategorier(selectedHovedkategori).map((option) => (
                <Checkbox
                  key={option.value}
                  id={`underkategori-${option.value}`}
                  label={option.label}
                  value={option.value}
                  {...register('underkategori')}
                />
              ))}
            </div>
          </FormField>
        )}

        {/* Beskrivelse */}
        <FormField
          label="Beskrivelse"
          required
          error={errors.beskrivelse?.message}
        >
          <Textarea
            id="beskrivelse"
            {...register('beskrivelse')}
            rows={5}
            fullWidth
            placeholder="Beskriv grunnlaget for endringsmeldingen..."
            error={!!errors.beskrivelse}
          />
        </FormField>

        {/* Dato forhold oppdaget */}
        <FormField
          label="Dato forhold oppdaget"
          required
          error={errors.dato_oppdaget?.message}
        >
          <Controller
            name="dato_oppdaget"
            control={control}
            render={({ field }) => (
              <DatePicker
                id="dato_oppdaget"
                value={field.value}
                onChange={field.onChange}
                fullWidth
                error={!!errors.dato_oppdaget}
                placeholder="Velg dato"
              />
            )}
          />
        </FormField>

        {/* Varsel sendes nå checkbox */}
        <Controller
          name="varsel_sendes_na"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="varsel_sendes_na"
              label="Varsel sendes nå (sammen med dette skjemaet)"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />

        {/* Dato varsel sendt - only show if NOT sending now */}
        {!varselSendesNa && (
          <FormField
            label="Dato varsel sendt tidligere"
            labelTooltip="Dokumenter når BH ble varslet. Varselfrist er kritisk for om kravet kan tapes ved preklusjon."
            helpText="Kan være forskjellig fra oppdaget-dato. Både formelle og uformelle varsler (f.eks. byggemøte) teller."
          >
            <Controller
              name="dato_varsel_sendt"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="dato_varsel_sendt"
                  value={field.value}
                  onChange={field.onChange}
                  fullWidth
                  placeholder="Velg dato"
                />
              )}
            />
          </FormField>
        )}

        {/* Varsel metode */}
        <FormField
          label="Varselmetode"
          helpText="Hvordan ble BH varslet? (Kan velge flere)"
        >
          <div className="space-y-pkt-03 border-2 border-pkt-border-gray rounded-none p-pkt-04 bg-pkt-bg-subtle">
            {VARSEL_METODER_OPTIONS.map((option) => (
              <Checkbox
                key={option.value}
                id={`varsel-${option.value}`}
                label={option.label}
                value={option.value}
                {...register('varsel_metode')}
              />
            ))}
          </div>
        </FormField>

        {/* Kontraktsreferanser */}
        <FormField
          label="Kontraktsreferanser"
          helpText="Separer flere referanser med komma, f.eks. '§3.2, §4.1'"
        >
          <Input
            id="kontraktsreferanser"
            type="text"
            {...register('kontraktsreferanser')}
            fullWidth
            placeholder="F.eks. '§3.2, §4.1'"
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
            {isSubmitting ? 'Sender...' : 'Send grunnlag'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
