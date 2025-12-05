/**
 * SendVederlagModal Component
 *
 * Action modal for submitting a new vederlag (compensation) claim.
 * Uses React Hook Form + Zod for validation.
 * Now uses Radix UI primitives with Punkt design system styling.
 *
 * UPDATED (2025-12-05):
 * - Added subsidiary treatment alert when grunnlag is rejected
 * - Added display of grunnlag context (title, status)
 * - Added preklusjon warnings with date calculations
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Checkbox } from '../primitives/Checkbox';
import { FormField } from '../primitives/FormField';
import { DatePicker } from '../primitives/DatePicker';
import { Badge } from '../primitives/Badge';
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
  VEDERLAGSMETODER_OPTIONS,
  VARSEL_METODER_OPTIONS,
  VEDERLAGSMETODE_DESCRIPTIONS,
} from '../../constants';
import { differenceInDays } from 'date-fns';

const vederlagSchema = z.object({
  krav_belop: z.number().min(1, 'Beløp må være større enn 0'),
  metode: z.string().min(1, 'Metode er påkrevd'),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),

  // Rigg & Drift (§34.1.3)
  inkluderer_rigg_drift: z.boolean().optional(),
  rigg_drift_belop: z.number().optional(),
  rigg_drift_varsel_sendes_na: z.boolean().optional(),
  rigg_drift_varsel_dato: z.string().optional(),
  rigg_drift_varsel_metoder: z.array(z.string()).optional(),

  // Produktivitetstap (§34.1.3, 2. ledd)
  inkluderer_produktivitetstap: z.boolean().optional(),
  produktivitetstap_belop: z.number().optional(),
  produktivitetstap_varsel_sendes_na: z.boolean().optional(),
  produktivitetstap_varsel_dato: z.string().optional(),
  produktivitetstap_varsel_metoder: z.array(z.string()).optional(),

  // Regningsarbeid (§30.1)
  krever_regningsarbeid: z.boolean().optional(),
  regningsarbeid_varsel_sendes_na: z.boolean().optional(),
  regningsarbeid_varsel_dato: z.string().optional(),
  regningsarbeid_varsel_metoder: z.array(z.string()).optional(),

  // Justerte enhetspriser (§34.3.3) - kun relevant hvis metode='justert_ep'
  justert_ep_varsel_dato: z.string().optional(),
  justert_ep_varsel_metoder: z.array(z.string()).optional(),
});

type VederlagFormData = z.infer<typeof vederlagSchema>;

// Grunnlag event info for context display
interface GrunnlagEventInfo {
  tittel?: string;
  status?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent';
  dato_varslet?: string;
}

interface SendVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** Optional grunnlag event data for context display and subsidiary logic */
  grunnlagEvent?: GrunnlagEventInfo;
}

export function SendVederlagModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEvent,
}: SendVederlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    watch,
  } = useForm<VederlagFormData>({
    resolver: zodResolver(vederlagSchema),
    defaultValues: {
      metode: '',
      inkluderer_rigg_drift: false,
      rigg_drift_varsel_sendes_na: false,
      rigg_drift_varsel_metoder: [],
      inkluderer_produktivitetstap: false,
      produktivitetstap_varsel_sendes_na: false,
      produktivitetstap_varsel_metoder: [],
      krever_regningsarbeid: false,
      regningsarbeid_varsel_sendes_na: false,
      regningsarbeid_varsel_metoder: [],
      justert_ep_varsel_metoder: [],
    },
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  // Watch form values for conditional rendering
  const selectedMetode = watch('metode');
  const inkludererRiggDrift = watch('inkluderer_rigg_drift');
  const riggDriftVarselSendesNa = watch('rigg_drift_varsel_sendes_na');
  const inkludererProduktivitetstap = watch('inkluderer_produktivitetstap');
  const produktivitetstapVarselSendesNa = watch('produktivitetstap_varsel_sendes_na');
  const kreverRegningsarbeid = watch('krever_regningsarbeid');
  const regningsarbeidVarselSendesNa = watch('regningsarbeid_varsel_sendes_na');

  // Determine if this is a subsidiary claim (grunnlag was rejected)
  const erSubsidiaer = grunnlagEvent?.status === 'avvist_uenig';

  // Calculate days since grunnlag was submitted (for preclusion warnings)
  const dagerSidenGrunnlag = grunnlagEvent?.dato_varslet
    ? differenceInDays(new Date(), new Date(grunnlagEvent.dato_varslet))
    : 0;

  // Preclusion warning thresholds
  const erPreklusjonRisiko = dagerSidenGrunnlag > 3; // "uten ugrunnet opphold"
  const erPreklusjonKritisk = dagerSidenGrunnlag > 14;

  const onSubmit = (data: VederlagFormData) => {
    // Build VarselInfo structures
    // For rigg_drift: use today's date and 'system' method if "sendes nå" is checked
    const riggDriftDato = data.rigg_drift_varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.rigg_drift_varsel_dato;

    const riggDriftMetode = data.rigg_drift_varsel_sendes_na
      ? ['system']
      : (data.rigg_drift_varsel_metoder || []);

    const riggDriftVarsel = riggDriftDato
      ? {
          dato_sendt: riggDriftDato,
          metode: riggDriftMetode,
        }
      : undefined;

    // For produktivitetstap: use today's date and 'system' method if "sendes nå" is checked
    const produktivitetstapDato = data.produktivitetstap_varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.produktivitetstap_varsel_dato;

    const produktivitetstapMetode = data.produktivitetstap_varsel_sendes_na
      ? ['system']
      : (data.produktivitetstap_varsel_metoder || []);

    const produktivitetstapVarsel = produktivitetstapDato
      ? {
          dato_sendt: produktivitetstapDato,
          metode: produktivitetstapMetode,
        }
      : undefined;

    // For regningsarbeid: use today's date and 'system' method if "sendes nå" is checked
    const regningsarbeidDato = data.regningsarbeid_varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.regningsarbeid_varsel_dato;

    const regningsarbeidMetode = data.regningsarbeid_varsel_sendes_na
      ? ['system']
      : (data.regningsarbeid_varsel_metoder || []);

    const regningsarbeidVarsel = regningsarbeidDato
      ? {
          dato_sendt: regningsarbeidDato,
          metode: regningsarbeidMetode,
        }
      : undefined;

    const justertEpVarsel = data.justert_ep_varsel_dato
      ? {
          dato_sendt: data.justert_ep_varsel_dato,
          metode: data.justert_ep_varsel_metoder || [],
        }
      : undefined;

    mutation.mutate({
      eventType: 'vederlag_krav_sendt',
      data: {
        krav_belop: data.krav_belop,
        metode: data.metode,
        begrunnelse: data.begrunnelse,
        inkluderer_rigg_drift: data.inkluderer_rigg_drift,
        rigg_drift_belop: data.rigg_drift_belop,
        rigg_drift_varsel: riggDriftVarsel,
        inkluderer_produktivitetstap: data.inkluderer_produktivitetstap,
        produktivitetstap_belop: data.produktivitetstap_belop,
        produktivitetstap_varsel: produktivitetstapVarsel,
        krever_regningsarbeid: data.krever_regningsarbeid,
        regningsarbeid_varsel: regningsarbeidVarsel,
        justert_ep_varsel: justertEpVarsel,
      },
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
        {/* Grunnlag context display */}
        {grunnlagEvent && grunnlagEvent.tittel && (
          <div className="p-pkt-04 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <div className="flex items-center justify-between">
              <span className="text-sm text-pkt-text-body-subtle">
                Knyttet til grunnlag:
              </span>
              {erSubsidiaer && (
                <Badge variant="warning">Subsidiær behandling</Badge>
              )}
            </div>
            <p className="font-medium text-pkt-text-body-dark mt-1">
              {grunnlagEvent.tittel}
            </p>
            {grunnlagEvent.dato_varslet && dagerSidenGrunnlag > 0 && (
              <p className="text-xs text-pkt-text-body-subtle mt-1">
                Varslet for {dagerSidenGrunnlag} dager siden
              </p>
            )}
          </div>
        )}

        {/* Subsidiary treatment alert */}
        {erSubsidiaer && (
          <div className="p-pkt-04 bg-amber-50 border-2 border-amber-300 rounded-none">
            <p className="text-sm font-medium text-amber-900 mb-1">
              Subsidiær behandling
            </p>
            <p className="text-sm text-amber-800">
              Ansvarsgrunnlaget er avvist av Byggherre. Du sender nå inn dette
              kravet for <strong>subsidiær behandling</strong>. Dette sikrer at
              kravet ditt er registrert og beregnet iht. fristene i NS 8407,
              selv om ansvaret er omtvistet.
            </p>
          </div>
        )}

        {/* Preclusion warning */}
        {erPreklusjonKritisk && (
          <div
            className="p-pkt-05 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <p className="text-base text-pkt-border-red font-medium">
              Preklusjonsfare (§34.1)
            </p>
            <p className="text-sm text-pkt-border-red mt-1">
              Det er gått <strong>{dagerSidenGrunnlag} dager</strong> siden
              grunnlaget ble varslet. Kravet må sendes &ldquo;uten ugrunnet
              opphold&rdquo;. Du risikerer at retten til vederlagsjustering er
              tapt eller redusert.
            </p>
          </div>
        )}
        {erPreklusjonRisiko && !erPreklusjonKritisk && (
          <div className="p-pkt-04 bg-amber-50 border-2 border-amber-300 rounded-none">
            <p className="text-sm font-medium text-amber-900">
              Varsel om frist (§34.1)
            </p>
            <p className="text-sm text-amber-800 mt-1">
              Det er gått {dagerSidenGrunnlag} dager siden grunnlaget ble
              varslet. Kravet bør sendes snarest for å unngå preklusjonsrisiko.
            </p>
          </div>
        )}

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
          labelTooltip="Velg beregningsmetode iht. NS 8407 kapittel 34. Påvirker indeksregulering og varslingskrav."
          helpText={selectedMetode && VEDERLAGSMETODE_DESCRIPTIONS[selectedMetode] ? VEDERLAGSMETODE_DESCRIPTIONS[selectedMetode] : undefined}
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

        {/* === VARSLINGSKRAV (NS 8407) === */}
        <div className="space-y-pkt-06 p-pkt-05 bg-pkt-surface-subtle rounded-none border-2 border-pkt-border-subtle">
          <h3 className="text-lg font-medium text-pkt-text-body-default">
            Varslingskrav (kritisk for preklusjon)
          </h3>

          {/* Rigg & Drift (§34.1.3) */}
          <div className="space-y-pkt-04">
            <Controller
              name="inkluderer_rigg_drift"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="inkluderer_rigg_drift"
                  label="Inkluderer rigg/drift-kostnader (§34.1.3)"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {inkludererRiggDrift && (
              <div className="ml-pkt-07 space-y-pkt-04 p-pkt-05 bg-pkt-surface-subtle-light-blue rounded-none border-2 border-pkt-border-focus">
                <FormField
                  label="Rigg/drift beløp (NOK)"
                  error={errors.rigg_drift_belop?.message}
                  helpText="Separat beløp for rigg/drift hvis aktuelt"
                >
                  <Input
                    id="rigg_drift_belop"
                    type="number"
                    step="0.01"
                    {...register('rigg_drift_belop', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    fullWidth
                    placeholder="0.00"
                    error={!!errors.rigg_drift_belop}
                  />
                </FormField>

                <Controller
                  name="rigg_drift_varsel_sendes_na"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="rigg_drift_varsel_sendes_na"
                      label="Varsel sendes nå (sammen med dette skjemaet)"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />

                {!riggDriftVarselSendesNa && (
                  <FormField
                    label="Dato varsel sendt tidligere (rigg/drift)"
                    error={errors.rigg_drift_varsel_dato?.message}
                    labelTooltip="§34.1.3: Særskilt varsel må sendes uten ugrunnet opphold. KRITISK for å unngå preklusjon."
                  >
                    <Controller
                      name="rigg_drift_varsel_dato"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          id="rigg_drift_varsel_dato"
                          value={field.value}
                          onChange={field.onChange}
                          fullWidth
                          error={!!errors.rigg_drift_varsel_dato}
                          placeholder="Velg dato"
                        />
                      )}
                    />
                  </FormField>
                )}

                {/* Varselmetoder - only show if NOT sending now */}
                {!riggDriftVarselSendesNa && (
                  <FormField
                    label="Varselmetoder (rigg/drift)"
                    helpText="Velg alle metoder som ble brukt"
                  >
                    <div className="space-y-pkt-03 border-2 border-pkt-border-gray rounded-none p-pkt-04 bg-pkt-bg-subtle">
                      {VARSEL_METODER_OPTIONS.map((option) => (
                        <Checkbox
                          key={option.value}
                          id={`rigg_drift_varsel-${option.value}`}
                          label={option.label}
                          value={option.value}
                          {...register('rigg_drift_varsel_metoder')}
                        />
                      ))}
                    </div>
                  </FormField>
                )}
              </div>
            )}
          </div>

          {/* Produktivitetstap (§34.1.3, 2. ledd) */}
          <div className="space-y-pkt-04">
            <Controller
              name="inkluderer_produktivitetstap"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="inkluderer_produktivitetstap"
                  label="Inkluderer produktivitetstap (§34.1.3, 2. ledd)"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {inkludererProduktivitetstap && (
              <div className="ml-pkt-07 space-y-pkt-04 p-pkt-05 bg-pkt-surface-subtle-light-blue rounded-none border-2 border-pkt-border-focus">
                <FormField
                  label="Produktivitetstap beløp (NOK)"
                  error={errors.produktivitetstap_belop?.message}
                  helpText="Separat beløp for produktivitetstap/nedsatt produktivitet"
                >
                  <Input
                    id="produktivitetstap_belop"
                    type="number"
                    step="0.01"
                    {...register('produktivitetstap_belop', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    fullWidth
                    placeholder="0.00"
                    error={!!errors.produktivitetstap_belop}
                  />
                </FormField>

                <Controller
                  name="produktivitetstap_varsel_sendes_na"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="produktivitetstap_varsel_sendes_na"
                      label="Varsel sendes nå (sammen med dette skjemaet)"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />

                {!produktivitetstapVarselSendesNa && (
                  <FormField
                    label="Dato varsel sendt tidligere (produktivitetstap)"
                    error={errors.produktivitetstap_varsel_dato?.message}
                    labelTooltip="§34.1.3, 2. ledd: Særskilt varsel må sendes for produktivitetstap. KRITISK for å unngå preklusjon."
                  >
                    <Controller
                      name="produktivitetstap_varsel_dato"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          id="produktivitetstap_varsel_dato"
                          value={field.value}
                          onChange={field.onChange}
                          fullWidth
                          error={!!errors.produktivitetstap_varsel_dato}
                          placeholder="Velg dato"
                        />
                      )}
                    />
                  </FormField>
                )}

                {/* Varselmetoder - only show if NOT sending now */}
                {!produktivitetstapVarselSendesNa && (
                  <FormField
                    label="Varselmetoder (produktivitetstap)"
                    helpText="Velg alle metoder som ble brukt"
                  >
                    <div className="space-y-pkt-03 border-2 border-pkt-border-gray rounded-none p-pkt-04 bg-pkt-bg-subtle">
                      {VARSEL_METODER_OPTIONS.map((option) => (
                        <Checkbox
                          key={option.value}
                          id={`produktivitetstap_varsel-${option.value}`}
                          label={option.label}
                          value={option.value}
                          {...register('produktivitetstap_varsel_metoder')}
                        />
                      ))}
                    </div>
                  </FormField>
                )}
              </div>
            )}
          </div>

          {/* Regningsarbeid (§30.1) */}
          <div className="space-y-pkt-04">
            <Controller
              name="krever_regningsarbeid"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="krever_regningsarbeid"
                  label="Krever varsel før oppstart av regningsarbeid (§30.1)"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {kreverRegningsarbeid && (
              <div className="ml-pkt-07 space-y-pkt-04 p-pkt-05 bg-pkt-surface-subtle-light-blue rounded-none border-2 border-pkt-border-focus">
                <Controller
                  name="regningsarbeid_varsel_sendes_na"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="regningsarbeid_varsel_sendes_na"
                      label="Varsel sendes nå (sammen med dette skjemaet)"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />

                {!regningsarbeidVarselSendesNa && (
                  <FormField
                    label="Dato varsel sendt tidligere FØR oppstart (regningsarbeid)"
                    error={errors.regningsarbeid_varsel_dato?.message}
                    labelTooltip="§30.1: BH må varsles FØR regningsarbeid starter. Manglende varsel kan føre til tap av krav."
                  >
                    <Controller
                      name="regningsarbeid_varsel_dato"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          id="regningsarbeid_varsel_dato"
                          value={field.value}
                          onChange={field.onChange}
                          fullWidth
                          error={!!errors.regningsarbeid_varsel_dato}
                          placeholder="Velg dato"
                        />
                      )}
                    />
                  </FormField>
                )}

                {/* Varselmetoder - only show if NOT sending now */}
                {!regningsarbeidVarselSendesNa && (
                  <FormField
                    label="Varselmetoder (regningsarbeid)"
                    helpText="Velg alle metoder som ble brukt"
                  >
                    <div className="space-y-pkt-03 border-2 border-pkt-border-gray rounded-none p-pkt-04 bg-pkt-bg-subtle">
                      {VARSEL_METODER_OPTIONS.map((option) => (
                        <Checkbox
                          key={option.value}
                          id={`regningsarbeid_varsel-${option.value}`}
                          label={option.label}
                          value={option.value}
                          {...register('regningsarbeid_varsel_metoder')}
                        />
                      ))}
                    </div>
                  </FormField>
                )}
              </div>
            )}
          </div>

          {/* Justerte enhetspriser (§34.3.3) - kun hvis metode='justert_ep' */}
          {selectedMetode === 'justert_ep' && (
            <div className="space-y-pkt-04 p-pkt-04 bg-pkt-surface-subtle-light-blue rounded-none border-2 border-pkt-border-focus">
              <p className="text-base font-medium text-pkt-text-body-default">
                Justerte enhetspriser (§34.3.3) - Særskilt varsel påkrevd
              </p>

              <FormField
                label="Dato varsel sendt (justerte EP)"
                error={errors.justert_ep_varsel_dato?.message}
                labelTooltip="§34.3.3: Særskilt varsel må sendes for justerte enhetspriser. KRITISK for å unngå preklusjon."
              >
                <Controller
                  name="justert_ep_varsel_dato"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="justert_ep_varsel_dato"
                      value={field.value}
                      onChange={field.onChange}
                      fullWidth
                      error={!!errors.justert_ep_varsel_dato}
                      placeholder="Velg dato"
                    />
                  )}
                />
              </FormField>

              <FormField
                label="Varselmetoder (justerte EP)"
                helpText="Velg alle metoder som ble brukt"
              >
                <div className="space-y-pkt-03 border-2 border-pkt-border-gray rounded-none p-pkt-04 bg-pkt-bg-subtle">
                  {VARSEL_METODER_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.value}
                      id={`justert_ep_varsel-${option.value}`}
                      label={option.label}
                      value={option.value}
                      {...register('justert_ep_varsel_metoder')}
                    />
                  ))}
                </div>
              </FormField>
            </div>
          )}
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
