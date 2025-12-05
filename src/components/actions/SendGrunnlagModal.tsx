/**
 * SendGrunnlagModal Component
 *
 * Action modal for submitting a new grunnlag (basis/foundation) claim.
 * Uses React Hook Form + Zod for validation.
 * Enhanced with preclusion checks and legal warnings based on NS 8407.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Checkbox } from '../primitives/Checkbox';
import { DatePicker } from '../primitives/DatePicker';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { Collapsible } from '../primitives/Collapsible';
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
import { useState, useMemo } from 'react';
import {
  HOVEDKATEGORI_OPTIONS,
  getUnderkategorier,
  VARSEL_METODER_OPTIONS,
  getHovedkategori,
  getUnderkategoriObj,
  erLovendring,
} from '../../constants';
import { getPreklusjonsvarsel, beregnDagerSiden } from '../../utils/preklusjonssjekk';

const grunnlagSchema = z.object({
  hovedkategori: z.string().min(1, 'Hovedkategori er påkrevd'),
  underkategori: z.array(z.string()).min(1, 'Minst én underkategori må velges'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato oppdaget er påkrevd'),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
  kontraktsreferanser: z.string().optional(),
  er_etter_tilbud: z.boolean().optional(), // For law changes (§14.4)
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
      varsel_sendes_na: false,
      varsel_metode: [],
      er_etter_tilbud: false,
    },
  });

  const hovedkategoriValue = watch('hovedkategori');
  const varselSendesNa = watch('varsel_sendes_na');
  const datoOppdaget = watch('dato_oppdaget');
  const selectedUnderkategorier = watch('underkategori');
  const erEtterTilbud = watch('er_etter_tilbud');

  // Get selected category info
  const valgtHovedkategori = useMemo(
    () => getHovedkategori(selectedHovedkategori),
    [selectedHovedkategori]
  );

  const valgtUnderkategori = useMemo(() => {
    if (selectedUnderkategorier?.length > 0) {
      return getUnderkategoriObj(selectedUnderkategorier[0]);
    }
    return undefined;
  }, [selectedUnderkategorier]);

  // Check if any selected underkategori is a law change (§14.4)
  const harLovendring = useMemo(() => {
    return selectedUnderkategorier?.some((kode) => erLovendring(kode)) ?? false;
  }, [selectedUnderkategorier]);

  // Calculate preclusion risk
  const preklusjonsResultat = useMemo(() => {
    if (!datoOppdaget) return null;
    return getPreklusjonsvarsel(beregnDagerSiden(datoOppdaget));
  }, [datoOppdaget]);

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
    setValue('underkategori', []);
    setValue('er_etter_tilbud', false);
  };

  const onSubmit = (data: GrunnlagFormData) => {
    // Convert comma-separated string to array
    const kontraktsreferanser = data.kontraktsreferanser
      ? data.kontraktsreferanser.split(',').map((ref) => ref.trim())
      : [];

    // Build VarselInfo structure
    const varselDato = data.varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.dato_varsel_sendt;

    const varselMetode = data.varsel_sendes_na
      ? ['system']
      : (data.varsel_metode || []);

    const grunnlagVarsel = varselDato
      ? {
          dato_sendt: varselDato,
          metode: varselMetode,
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
        meta: harLovendring ? { er_etter_tilbud: data.er_etter_tilbud } : undefined,
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

        {/* Category info box */}
        {valgtHovedkategori && (
          <Alert variant="info" title={`Hjemmel: NS 8407 §${valgtHovedkategori.hjemmel_frist}`}>
            {valgtHovedkategori.beskrivelse}
            <div className="mt-2 text-xs">
              <strong>Type krav:</strong> {valgtHovedkategori.type_krav}
              {valgtHovedkategori.hjemmel_vederlag && (
                <> | <strong>Vederlag:</strong> §{valgtHovedkategori.hjemmel_vederlag}</>
              )}
            </div>
          </Alert>
        )}

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

        {/* Underkategori info */}
        {valgtUnderkategori && (
          <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm">
            <strong>{valgtUnderkategori.label}</strong>
            <p className="text-gray-700 mt-1">{valgtUnderkategori.beskrivelse}</p>
            <p className="text-xs mt-2">
              <strong>Varslingskrav:</strong> §{valgtUnderkategori.varselkrav_ref}
            </p>
          </div>
        )}

        {/* Law change check (§14.4) */}
        {harLovendring && (
          <div className="bg-blue-50 p-4 rounded border-2 border-blue-200">
            <Controller
              name="er_etter_tilbud"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="er_etter_tilbud"
                  label="Bekreft at endringen inntraff ETTER tilbudsfristens utløp (§14.4)"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {!erEtterTilbud && (
              <p className="text-xs text-red-600 mt-2">
                Hvis lovendringen var kjent ved tilbudsfrist, ligger risikoen normalt hos deg.
              </p>
            )}
          </div>
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
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <FormField
            label="Dato forhold oppdaget"
            required
            error={errors.dato_oppdaget?.message}
          >
            <div className="flex items-center gap-4">
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
              {datoOppdaget && (
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  {beregnDagerSiden(datoOppdaget)} dager siden
                </span>
              )}
            </div>
          </FormField>

          {/* Preclusion warnings */}
          {preklusjonsResultat?.alert && (
            <div className="mt-3">
              <Alert
                variant={preklusjonsResultat.alert.variant}
                title={preklusjonsResultat.alert.title}
              >
                {preklusjonsResultat.alert.message}
              </Alert>
            </div>
          )}
        </div>

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

        {/* Varsel metode - only show if NOT sending now */}
        {!varselSendesNa && (
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
        )}

        {/* Kontraktsreferanser */}
        <Collapsible title="Kontraktsreferanser (Valgfritt)">
          <Input
            id="kontraktsreferanser"
            type="text"
            {...register('kontraktsreferanser')}
            fullWidth
            placeholder="F.eks. '§3.2, §4.1'"
          />
          <p className="text-xs text-gray-500 mt-2">
            Separer flere referanser med komma
          </p>
        </Collapsible>

        {/* Guidance text */}
        <p className="text-xs text-gray-500">
          Dette er et nøytralt varsel om grunnlaget. Spesifiserte krav om penger (Vederlag)
          og tid (Frist) legger du til i egne steg etterpå.
        </p>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
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
