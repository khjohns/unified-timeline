/**
 * SendFristModal Component
 *
 * Action modal for submitting a new frist (deadline extension) claim.
 * Uses React Hook Form + Zod for validation.
 * Now uses Radix UI primitives with Punkt design system styling.
 *
 * UPDATED (2025-12-05):
 * - Added BH etterlysning warning (§33.6.2) - critical
 * - Added §33.6.1 reduction warning when late
 * - Added grunnlag context display
 * - Added berørte aktiviteter field
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Checkbox } from '../primitives/Checkbox';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { DatePicker } from '../primitives/DatePicker';
import { FormField } from '../primitives/FormField';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import {
  FRIST_VARSELTYPE_OPTIONS,
  getFristVarseltypeValues,
  FRIST_VARSELTYPE_DESCRIPTIONS,
  VARSEL_METODER_OPTIONS,
  getHovedkategoriLabel,
} from '../../constants';
import { differenceInDays } from 'date-fns';

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
  berorte_aktiviteter: z.string().optional(),
}).refine(
  (data) => {
    // antall_dager is required for spesifisert, begge, and force_majeure
    if (['spesifisert', 'begge', 'force_majeure'].includes(data.varsel_type)) {
      return data.antall_dager !== undefined && data.antall_dager >= 0;
    }
    return true;
  },
  {
    message: 'Antall dager er påkrevd for spesifisert krav',
    path: ['antall_dager'],
  }
);

type FristFormData = z.infer<typeof fristSchema>;

// Grunnlag event info for context display
interface GrunnlagEventInfo {
  tittel?: string;
  hovedkategori?: string;
  dato_varslet?: string;
}

interface SendFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the grunnlag event this frist claim is linked to (required for event sourcing) */
  grunnlagEventId: string;
  /** Optional grunnlag event data for context display */
  grunnlagEvent?: GrunnlagEventInfo;
  /** Whether BH has sent an etterlysning (§33.6.2) - triggers critical warning */
  harMottattEtterlysning?: boolean;
}

export function SendFristModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  harMottattEtterlysning,
}: SendFristModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
    watch,
  } = useForm<FristFormData>({
    resolver: zodResolver(fristSchema),
    defaultValues: {
      noytralt_varsel_sendes_na: false,
      noytralt_varsel_metoder: [],
      spesifisert_varsel_sendes_na: false,
      spesifisert_varsel_metoder: [],
      vedlegg_ids: [],
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
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

  // Calculate days since grunnlag was submitted (for §33.6.1 reduction warning)
  const dagerSidenGrunnlag = grunnlagEvent?.dato_varslet
    ? differenceInDays(new Date(), new Date(grunnlagEvent.dato_varslet))
    : 0;

  // §33.6.1: Late specification without BH etterlysning triggers reduction warning
  const erSentUtenEtterlysning = !harMottattEtterlysning && dagerSidenGrunnlag > 21;

  // §33.4: Nøytralt varsel skal sendes "uten ugrunnet opphold" - typisk 7-14 dager
  // Over 7 dager: advarsel. Over 14 dager: kritisk.
  const erNoytraltVarselSent = dagerSidenGrunnlag > 7;
  const erNoytraltVarselKritisk = dagerSidenGrunnlag > 14;

  // Get category label for display
  const kategoriLabel = grunnlagEvent?.hovedkategori
    ? getHovedkategoriLabel(grunnlagEvent.hovedkategori)
    : undefined;

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
        grunnlag_event_id: grunnlagEventId,
        varsel_type: data.varsel_type,
        noytralt_varsel: noytraltVarsel,
        spesifisert_varsel: spesifisertVarsel,
        antall_dager: data.antall_dager,
        begrunnelse: data.begrunnelse,
        ny_sluttdato: data.ny_sluttdato,
        vedlegg_ids: data.vedlegg_ids,
        berorte_aktiviteter: data.berorte_aktiviteter,
        // Metadata for tracking if this was forced by BH etterlysning
        er_svar_pa_etterlysning: harMottattEtterlysning,
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* BH Etterlysning warning (§33.6.2) - CRITICAL */}
        {harMottattEtterlysning && (
          <div
            className="p-5 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="danger">Svar på BHs etterlysning (§33.6.2)</Badge>
            </div>
            <p className="text-base text-pkt-border-red font-medium">
              KRITISK: Byggherren har etterlyst dette kravet.
            </p>
            <p className="text-sm text-pkt-border-red mt-1">
              Du må svare &ldquo;uten ugrunnet opphold&rdquo;. Hvis du ikke
              sender kravet nå, <strong>tapes hele retten til fristforlengelse</strong>{' '}
              i denne saken (§33.6.2).
            </p>
          </div>
        )}

        {/* Grunnlag context display */}
        {grunnlagEvent && grunnlagEvent.tittel && (
          <div className="p-4 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <span className="text-sm text-pkt-text-body-subtle">
              Knyttet til grunnlag:
            </span>
            <p className="font-medium text-pkt-text-body-dark mt-1">
              {grunnlagEvent.tittel}
              {kategoriLabel && (
                <span className="text-pkt-text-body-subtle font-normal">
                  {' '}
                  ({kategoriLabel})
                </span>
              )}
            </p>
            {grunnlagEvent.dato_varslet && dagerSidenGrunnlag > 0 && (
              <p className="text-xs text-pkt-text-body-subtle mt-1">
                Varslet for {dagerSidenGrunnlag} dager siden
              </p>
            )}
          </div>
        )}

        {/* §33.6.1 Reduction warning - late specification without etterlysning */}
        {erSentUtenEtterlysning && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
            <p className="text-sm font-medium text-amber-900">
              Risiko for avkortning (§33.6.1)
            </p>
            <p className="text-sm text-amber-800 mt-1">
              Det er gått <strong>{dagerSidenGrunnlag} dager</strong> siden du
              varslet om hendelsen. Når du venter med å spesifisere, har du kun
              krav på den fristforlengelsen Byggherren &ldquo;måtte forstå&rdquo;
              at du trengte. Begrunn behovet ekstra godt.
            </p>
          </div>
        )}

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
              <RadioGroup value={field.value} onValueChange={field.onChange} data-testid="frist-varsel-type">
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
          <div className="p-5 bg-pkt-surface-subtle-light-blue rounded-none border-2 border-pkt-border-focus">
            <h4 className="text-base font-medium text-pkt-text-body-default mb-4">
              Nøytralt/Foreløpig varsel (§33.4)
            </h4>

            {/* §33.4 Preklusjonsvarsel for nøytralt varsel */}
            {erNoytraltVarselSent && noytraltVarselSendesNa && (
              <div
                className={`p-4 mb-4 rounded-none border-2 ${
                  erNoytraltVarselKritisk
                    ? 'bg-pkt-surface-subtle-light-red border-pkt-border-red'
                    : 'bg-amber-50 border-amber-300'
                }`}
                role="alert"
              >
                <p className={`text-sm font-medium ${erNoytraltVarselKritisk ? 'text-pkt-border-red' : 'text-amber-900'}`}>
                  {erNoytraltVarselKritisk ? 'Preklusjonsrisiko (§33.4)' : 'Advarsel: Sen varsling (§33.4)'}
                </p>
                <p className={`text-sm mt-1 ${erNoytraltVarselKritisk ? 'text-pkt-border-red' : 'text-amber-800'}`}>
                  Det er gått <strong>{dagerSidenGrunnlag} dager</strong> siden hendelsen.
                  {erNoytraltVarselKritisk
                    ? ' Nøytralt varsel skal sendes "uten ugrunnet opphold". Du risikerer at kravet anses tapt (§33.4 annet ledd).'
                    : ' Nøytralt varsel bør sendes snarest for å bevare retten til fristforlengelse.'}
                </p>
              </div>
            )}

            <div className="space-y-4">
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
                  <div className="space-y-3 border-2 border-pkt-border-gray rounded-none p-4 bg-pkt-bg-subtle">
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
          <div className="p-5 bg-pkt-surface-subtle-light-blue rounded-none border-2 border-pkt-border-focus">
            <h4 className="text-base font-medium text-pkt-text-body-default mb-4">
              Spesifisert krav (§33.6)
            </h4>

            <div className="space-y-4">
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
                  <div className="space-y-3 border-2 border-pkt-border-gray rounded-none p-4 bg-pkt-bg-subtle">
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
            data-testid="frist-begrunnelse"
          />
        </FormField>

        {/* Berørte aktiviteter (Fremdriftsplan) */}
        <FormField
          label="Berørte aktiviteter (Fremdriftsplan)"
          error={errors.berorte_aktiviteter?.message}
          helpText="Dokumentasjon av påvirkning på kritisk linje er avgjørende for å vinne frem med kravet"
        >
          <Input
            id="berorte_aktiviteter"
            {...register('berorte_aktiviteter')}
            fullWidth
            placeholder="F.eks. ID 402 Tett Hus, ID 505 Innregulering"
            error={!!errors.berorte_aktiviteter}
          />
        </FormField>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            size="lg"
          >
            Avbryt
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} size="lg" data-testid="frist-submit">
            {isSubmitting ? 'Sender...' : 'Send fristkrav'}
          </Button>
        </div>
      </form>

      {/* Confirm close dialog */}
      <AlertDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Forkast endringer?"
        description="Du har ulagrede endringer som vil gå tapt hvis du lukker skjemaet."
        confirmLabel="Forkast"
        cancelLabel="Fortsett redigering"
        onConfirm={confirmClose}
        variant="warning"
      />
    </Modal>
  );
}
