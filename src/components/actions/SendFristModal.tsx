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
 */

import {
  Alert,
  AlertDialog,
  AttachmentUpload,
  Button,
  Checkbox,
  DatePicker,
  FormField,
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import type { AttachmentFile } from '../../types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useState, useEffect, useRef } from 'react';
import {
  FRIST_VARSELTYPE_OPTIONS,
  getFristVarseltypeValues,
  FRIST_VARSELTYPE_DESCRIPTIONS,
  getHovedkategoriLabel,
} from '../../constants';
import { VarselSeksjon } from './shared/VarselSeksjon';
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
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
}).refine(
  (data) => {
    // antall_dager is required for spesifisert krav
    if (data.varsel_type === 'spesifisert') {
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
  status?: 'godkjent' | 'avslatt' | 'delvis_godkjent' | 'ubesvart';
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
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

export function SendFristModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  harMottattEtterlysning,
  onCatendaWarning,
}: SendFristModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const toast = useToast();

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
      attachments: [],
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'frist_krav_sendt',
    formData,
    isDirty
  );

  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      setShowRestorePrompt(true);
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty]);

  const handleRestoreBackup = () => {
    const backup = getBackup();
    if (backup) reset(backup);
    setShowRestorePrompt(false);
  };

  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      // Dismiss pending toast and show success
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      reset();
      onOpenChange(false);
      toast.success('Fristkrav sendt', 'Kravet ditt er registrert og sendt til byggherre.');
      if (!result.catenda_synced) {
        onCatendaWarning?.();
      }
    },
    onError: (error) => {
      // Dismiss pending toast
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
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

  // Determine if this is a subsidiary claim (grunnlag was rejected)
  const erSubsidiaer = grunnlagEvent?.status === 'avslatt';


  const onSubmit = (data: FristFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending('Sender fristkrav...', 'Vennligst vent mens kravet behandles.');

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
        // Metadata for tracking if this was forced by BH etterlysning
        er_svar_pa_etterlysning: harMottattEtterlysning,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Krav om fristforlengelse"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* BH Etterlysning warning (§33.6.2) - CRITICAL */}
        {harMottattEtterlysning && (
          <Alert variant="danger" title="Svar på byggherrens etterlysning (§33.6.2)">
            Byggherren har etterlyst dette kravet. Du må svare «uten ugrunnet opphold».
            Hvis du ikke sender kravet nå, <strong>tapes hele retten til fristforlengelse</strong> i denne saken.
          </Alert>
        )}

        {/* Subsidiary treatment info */}
        {erSubsidiaer && (
          <Alert variant="info" title="Subsidiær behandling">
            Grunnlaget er avvist – kravet behandles subsidiært for å sikre fristene i NS 8407.
          </Alert>
        )}

        {/* §33.6.1 Reduction warning - late specification without etterlysning */}
        {erSentUtenEtterlysning && (
          <Alert variant="warning" title="Risiko for avkortning (§33.6.1)">
            Det er gått <strong>{dagerSidenGrunnlag} dager</strong> siden du varslet om hendelsen.
            Når du venter med å spesifisere, har du kun krav på den fristforlengelsen byggherren
            «måtte forstå» at du trengte. Begrunn behovet ekstra godt.
          </Alert>
        )}

        {/* Kravtype */}
        <SectionContainer
          title="Kravtype"
          description={selectedVarselType && FRIST_VARSELTYPE_DESCRIPTIONS[selectedVarselType] ? FRIST_VARSELTYPE_DESCRIPTIONS[selectedVarselType] : undefined}
        >
          <FormField
            error={errors.varsel_type?.message}
          >
            <Controller
              name="varsel_type"
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} data-testid="frist-varsel-type">
                  {FRIST_VARSELTYPE_OPTIONS
                    .filter(opt => opt.value !== '')
                    .map((option) => (
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
        </SectionContainer>

        {/* Varseldetaljer for foreløpig varsel */}
        {selectedVarselType === 'noytralt' && (
          <SectionContainer
            title="Foreløpig varsel (§33.4)"
            description="Dokumenter når og hvordan varselet ble sendt"
          >
            <div className="space-y-4">
              {/* §33.4 Preklusjonsvarsel for nøytralt varsel */}
              {erNoytraltVarselSent && noytraltVarselSendesNa && (
                <Alert
                  variant={erNoytraltVarselKritisk ? 'danger' : 'warning'}
                  title={erNoytraltVarselKritisk ? 'Preklusjonsrisiko (§33.4)' : 'Sen varsling (§33.4)'}
                >
                  Det er gått <strong>{dagerSidenGrunnlag} dager</strong> siden hendelsen.
                  {erNoytraltVarselKritisk
                    ? ' Foreløpig varsel skal sendes «uten ugrunnet opphold». Du risikerer at kravet anses tapt.'
                    : ' Foreløpig varsel bør sendes snarest for å bevare retten til fristforlengelse.'}
                </Alert>
              )}

              <Controller
                name="noytralt_varsel_sendes_na"
                control={control}
                render={({ field: sendesNaField }) => (
                  <Controller
                    name="noytralt_varsel_dato"
                    control={control}
                    render={({ field: datoField }) => (
                      <VarselSeksjon
                        label="Når ble byggherren varslet?"
                        sendesNa={sendesNaField.value ?? false}
                        onSendesNaChange={sendesNaField.onChange}
                        datoSendt={datoField.value}
                        onDatoSendtChange={datoField.onChange}
                        datoError={errors.noytralt_varsel_dato?.message}
                        registerMetoder={register('noytralt_varsel_metoder')}
                        idPrefix="noytralt_varsel"
                        testId="noytralt-varsel-valg"
                      />
                    )}
                  />
                )}
              />
            </div>
          </SectionContainer>
        )}

        {/* Varseldetaljer for spesifisert krav */}
        {selectedVarselType === 'spesifisert' && (
          <SectionContainer
            title="Spesifisert krav (§33.6)"
            description="Dokumenter når og hvordan kravet ble sendt"
          >
            <Controller
              name="spesifisert_varsel_sendes_na"
              control={control}
              render={({ field: sendesNaField }) => (
                <Controller
                  name="spesifisert_varsel_dato"
                  control={control}
                  render={({ field: datoField }) => (
                    <VarselSeksjon
                      label="Når ble kravet sendt?"
                      sendesNa={sendesNaField.value ?? false}
                      onSendesNaChange={sendesNaField.onChange}
                      datoSendt={datoField.value}
                      onDatoSendtChange={datoField.onChange}
                      datoError={errors.spesifisert_varsel_dato?.message}
                      registerMetoder={register('spesifisert_varsel_metoder')}
                      idPrefix="spesifisert_varsel"
                      testId="spesifisert-varsel-valg"
                    />
                  )}
                />
              )}
            />
          </SectionContainer>
        )}

        {/* Beregning av fristforlengelse (for spesifisert/FM) */}
        {selectedVarselType === 'spesifisert' && (
          <SectionContainer
            title="Beregning av fristforlengelse"
            description="Angi omfanget av kravet basert på virkningen på fremdriften (§33.5)"
          >
            <div className="space-y-4">
              <FormField
                label="Antall kalenderdager"
                required
                error={errors.antall_dager?.message}
              >
                <Input
                  id="antall_dager"
                  type="number"
                  {...register('antall_dager', {
                    setValueAs: (v) => (v === '' ? undefined : Number(v)),
                  })}
                  width="xs"
                  min={0}
                  error={!!errors.antall_dager}
                />
              </FormField>

              <FormField
                label="Beregnet ny sluttdato"
                error={errors.ny_sluttdato?.message}
                helpText="Ny sluttdato etter fristforlengelsen"
              >
                <Controller
                  name="ny_sluttdato"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="ny_sluttdato"
                      value={field.value}
                      onChange={field.onChange}
                      error={!!errors.ny_sluttdato}
                    />
                  )}
                />
              </FormField>
            </div>
          </SectionContainer>
        )}

        {/* Årsakssammenheng */}
        <SectionContainer
          title="Årsakssammenheng"
          description="Beskriv hvordan forholdet har forårsaket forsinkelse (§33.5)"
        >
          <div className="space-y-4">
            <Alert variant="info" title="Vilkår for fristforlengelse (§33.1, §33.5)">
              For å ha krav på fristforlengelse må du vise at: (1) fremdriften har vært hindret, og
              (2) hindringen skyldes det påberopte forholdet. Forklar konkret hvordan forholdet
              har påvirket fremdriften i prosjektet.
            </Alert>

            <FormField
              required
              error={errors.begrunnelse?.message}
            >
              <Textarea
                id="begrunnelse"
                {...register('begrunnelse')}
                rows={5}
                fullWidth
                error={!!errors.begrunnelse}
                data-testid="frist-begrunnelse"
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Vedlegg */}
        <SectionContainer
          title="Vedlegg"
          description="Last opp dokumentasjon"
          optional
        >
          <Controller
            name="attachments"
            control={control}
            render={({ field }) => (
              <AttachmentUpload
                value={field.value ?? []}
                onChange={field.onChange}
                multiple
                acceptedFormatsText="PDF, Word, Excel, bilder (maks 10 MB)"
              />
            )}
          />
        </SectionContainer>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-4 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="w-full sm:w-auto order-1 sm:order-2" data-testid="frist-submit">
            Send fristkrav
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

      {/* Restore backup dialog */}
      <AlertDialog
        open={showRestorePrompt}
        onOpenChange={(open) => { if (!open) handleDiscardBackup(); }}
        title="Gjenopprette lagrede data?"
        description="Det finnes data fra en tidligere økt som ikke ble sendt inn. Vil du fortsette der du slapp?"
        confirmLabel="Gjenopprett"
        cancelLabel="Start på nytt"
        onConfirm={handleRestoreBackup}
        variant="info"
      />

      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
