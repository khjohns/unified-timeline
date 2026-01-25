/**
 * SendVederlagModal Component
 *
 * Action modal for submitting a new vederlag (compensation) claim.
 * Uses React Hook Form + Zod for validation.
 *
 * UPDATED (2025-12-05):
 * - Added subsidiary treatment alert when grunnlag is rejected
 * - Restructured to match NS 8407 spec:
 *   - belopDirekte with support for negative values (fradrag)
 *   - RadioGroup for method selection (vertical)
 *   - kreverJustertEP as checkbox under ENHETSPRISER method
 *   - Bevisbyrde warning for regningsarbeid without prior notice
 *
 * UPDATED (2025-12-06):
 * - Fixed §34.1.3: Separate date fields for rigg/drift and produktivitet
 *   Per standarden: "etter at han blir eller burde ha blitt klar over at utgifter ville påløpe"
 *   TE kan bli klar over disse kostnadene på ulike tidspunkt, så separate frister er korrekt
 * - Separate amount fields for each særskilt krav type
 */

import {
  Alert,
  AttachmentUpload,
  Button,
  Checkbox,
  CurrencyInput,
  DatePicker,
  FormField,
  Modal,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import type { AttachmentFile } from '../../types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useMemo, useState, useEffect, useRef } from 'react';
import { sjekkRiggDriftFrist, sjekkVederlagspreklusjon, beregnDagerSiden } from '../../utils/preklusjonssjekk';
import { VederlagMethodSelector, type VederlagsMetode } from './shared';

const vederlagSchema = z.object({
  // Direkte kostnader - tillater negative for fradrag (§34.4)
  belop_direkte: z.number().optional(),
  metode: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD'], {
    errorMap: () => ({ message: 'Beregningsmetode er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),

  // Kostnadsoverslag for regningsarbeid (§30.2)
  kostnads_overslag: z.number().optional(),

  // Justerte enhetspriser (§34.3.3) - kun for ENHETSPRISER metode
  krever_justert_ep: z.boolean().optional(),

  // Regningsarbeid (§34.4)
  varslet_for_oppstart: z.boolean().optional(),

  // Særskilte krav (§34.1.3) - Rigg/Drift og Produktivitet
  // Per §34.1.3: Separate datoer fordi TE kan bli klar over ulike kostnader på ulike tidspunkt
  har_rigg_krav: z.boolean().optional(),
  har_produktivitet_krav: z.boolean().optional(),
  belop_rigg: z.number().optional(),
  belop_produktivitet: z.number().optional(),
  dato_klar_over_rigg: z.string().optional(),
  dato_klar_over_produktivitet: z.string().optional(),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
}).refine(
  (data) => {
    // belop_direkte is required for ENHETSPRISER and FASTPRIS_TILBUD
    if (data.metode === 'ENHETSPRISER' || data.metode === 'FASTPRIS_TILBUD') {
      return data.belop_direkte !== undefined;
    }
    return true;
  },
  {
    message: 'Beløp er påkrevd',
    path: ['belop_direkte'],
  }
);

type VederlagFormData = z.infer<typeof vederlagSchema>;

// Grunnlag event info for context display
interface GrunnlagEventInfo {
  tittel?: string;
  status?: 'godkjent' | 'avslatt' | 'delvis_godkjent';
  dato_varslet?: string;
  dato_oppdaget?: string;
  /** Hovedkategori for preklusjonssjekk (§34.1.1 vs §34.1.2) */
  hovedkategori?: 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE';
}

interface SendVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the grunnlag event this vederlag claim is linked to (required for event sourcing) */
  grunnlagEventId: string;
  /** Optional grunnlag event data for context display and subsidiary logic */
  grunnlagEvent?: GrunnlagEventInfo;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

export function SendVederlagModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  onCatendaWarning,
}: SendVederlagModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
    watch,
  } = useForm<VederlagFormData>({
    resolver: zodResolver(vederlagSchema),
    defaultValues: {
      metode: undefined,
      krever_justert_ep: false,
      varslet_for_oppstart: true,
      har_rigg_krav: false,
      har_produktivitet_krav: false,
      attachments: [],
    },
  });

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'vederlag_krav_sendt',
    formData,
    isDirty
  );

  // Auto-restore backup on mount (silent restoration with toast notification)
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      const backup = getBackup();
      if (backup) {
        reset(backup);
        toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
      }
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast]);

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
      toast.success('Vederlagskrav sendt', 'Kravet ditt er registrert og sendt til byggherre.');
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

  // Watch form values for conditional rendering
  const selectedMetode = watch('metode');
  const harRiggKrav = watch('har_rigg_krav');
  const harProduktivitetKrav = watch('har_produktivitet_krav');
  const datoKlarOverRigg = watch('dato_klar_over_rigg');
  const datoKlarOverProduktivitet = watch('dato_klar_over_produktivitet');

  // Determine if this is a subsidiary claim (grunnlag was rejected)
  const erSubsidiaer = grunnlagEvent?.status === 'avslatt';

  // Check preclusion for rigg/drift (§34.1.3 første ledd) - 7 days threshold
  const riggPreklusjon = useMemo(() => {
    if (!harRiggKrav || !datoKlarOverRigg) return null;
    return sjekkRiggDriftFrist(datoKlarOverRigg);
  }, [harRiggKrav, datoKlarOverRigg]);

  // Check preclusion for produktivitet (§34.1.3 annet ledd) - 7 days threshold
  const produktivitetPreklusjon = useMemo(() => {
    if (!harProduktivitetKrav || !datoKlarOverProduktivitet) return null;
    return sjekkRiggDriftFrist(datoKlarOverProduktivitet);
  }, [harProduktivitetKrav, datoKlarOverProduktivitet]);

  // Check vederlagspreklusjon based on hovedkategori (§34.1.1 vs §34.1.2)
  const vederlagsPreklusjon = useMemo(() => {
    if (!grunnlagEvent?.hovedkategori) return null;
    const dager = grunnlagEvent.dato_oppdaget
      ? beregnDagerSiden(grunnlagEvent.dato_oppdaget)
      : undefined;
    return sjekkVederlagspreklusjon(grunnlagEvent.hovedkategori, dager);
  }, [grunnlagEvent?.hovedkategori, grunnlagEvent?.dato_oppdaget]);

  const onSubmit = (data: VederlagFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending('Sender krav...', 'Vennligst vent mens kravet behandles.');

    // Build særskilt krav structure with separate dates per §34.1.3
    // TE kan bli klar over rigg/drift og produktivitetstap på ulike tidspunkt
    const saerskiltKrav =
      data.har_rigg_krav || data.har_produktivitet_krav
        ? {
            rigg_drift: data.har_rigg_krav
              ? {
                  belop: data.belop_rigg,
                  dato_klar_over: data.dato_klar_over_rigg,
                }
              : undefined,
            produktivitet: data.har_produktivitet_krav
              ? {
                  belop: data.belop_produktivitet,
                  dato_klar_over: data.dato_klar_over_produktivitet,
                }
              : undefined,
          }
        : null;

    // Build justert_ep_varsel if krever_justert_ep is true (§34.3.3)
    // Uses dato_oppdaget from grunnlag as the date the condition arose
    const justertEpVarsel = data.krever_justert_ep && grunnlagEvent?.dato_oppdaget
      ? { dato_sendt: grunnlagEvent.dato_oppdaget }
      : undefined;

    mutation.mutate({
      eventType: 'vederlag_krav_sendt',
      data: {
        grunnlag_event_id: grunnlagEventId,
        // Backend VederlagData model expects belop_direkte (updated 2025-12-06)
        belop_direkte: data.metode === 'REGNINGSARBEID' ? undefined : data.belop_direkte,
        kostnads_overslag: data.metode === 'REGNINGSARBEID' ? data.kostnads_overslag : undefined,
        metode: data.metode,
        begrunnelse: data.begrunnelse,
        krever_justert_ep: data.metode === 'ENHETSPRISER' ? data.krever_justert_ep : undefined,
        justert_ep_varsel: data.metode === 'ENHETSPRISER' ? justertEpVarsel : undefined,
        varslet_for_oppstart: data.metode === 'REGNINGSARBEID' ? data.varslet_for_oppstart : undefined,
        saerskilt_krav: saerskiltKrav,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Krev vederlagsjustering"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Subsidiary treatment info */}
        {erSubsidiaer && (
          <Alert variant="info" title="Subsidiær behandling">
            Grunnlaget er avvist – kravet behandles subsidiært for å sikre fristene i NS 8407.
          </Alert>
        )}

        {/* Vederlagspreklusjon varsel (§34.1.1 vs §34.1.2) */}
        {vederlagsPreklusjon?.alert && (
          <Alert variant={vederlagsPreklusjon.alert.variant} title={vederlagsPreklusjon.alert.title}>
            {vederlagsPreklusjon.alert.message}
          </Alert>
        )}

        {/* 1. Beregningsmetode */}
        <SectionContainer
          title="Beregningsmetode"
          description="Velg hvordan vederlaget skal beregnes (§34.2–§34.4)"
        >
          <Controller
            name="metode"
            control={control}
            render={({ field }) => (
              <Controller
                name="krever_justert_ep"
                control={control}
                render={({ field: epField }) => (
                  <Controller
                    name="varslet_for_oppstart"
                    control={control}
                    render={({ field: varsletField }) => (
                      <VederlagMethodSelector
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.metode?.message}
                        kreverJustertEp={epField.value}
                        onKreverJustertEpChange={epField.onChange}
                        varsletForOppstart={varsletField.value}
                        onVarsletForOppstartChange={varsletField.onChange}
                        testId="vederlag-metode"
                      />
                    )}
                  />
                )}
              />
            )}
          />
        </SectionContainer>

        {/* 2. Kravets omfang - Metodespesifikk */}
        <SectionContainer title="Kravets omfang">
          {selectedMetode === 'ENHETSPRISER' && (
            <FormField
              label="Sum direkte kostnader"
              required
              error={errors.belop_direkte?.message}
              helpText="Negativt beløp angir fradrag. Ved fradrag brukes enhetsprisene tilsvarende (§34.3)."
            >
              <Controller
                name="belop_direkte"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value ?? null}
                    onChange={field.onChange}
                    allowNegative
                  />
                )}
              />
            </FormField>
          )}

          {selectedMetode === 'REGNINGSARBEID' && (
            <>
              <Alert variant="info" className="mb-3">
                Ved regningsarbeid faktureres kostnadene løpende. Ved fradrag reduseres vederlaget
                med besparelsen, inkludert tilsvarende reduksjon av fortjenesten (§34.4).
              </Alert>

              <FormField
                label="Kostnadsoverslag"
                error={errors.kostnads_overslag?.message}
                helpText="Estimert totalkostnad. Byggherren kan holde tilbake betaling inntil overslag mottas (§30.2)."
              >
                <Controller
                  name="kostnads_overslag"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>
            </>
          )}

          {selectedMetode === 'FASTPRIS_TILBUD' && (
            <FormField
              label="Tilbudt fastpris (eks. mva)"
              required
              error={errors.belop_direkte?.message}
              helpText="Spesifisert tilbud (§34.2.1). Ved avslag faller oppgjøret tilbake på enhetspriser (§34.3) eller regningsarbeid (§34.4)."
            >
              <Controller
                name="belop_direkte"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value ?? null}
                    onChange={field.onChange}
                    allowNegative={false}
                  />
                )}
              />
            </FormField>
          )}
        </SectionContainer>

        {/* 3. Særskilte krav (§34.1.3) - Rigg, Drift, Produktivitet */}
        <SectionContainer
          title="Særskilte krav (§34.1.3)"
          description="Krav om økte rigg-/driftskostnader og produktivitetstap krever særskilt varsel"
          optional
        >

          {/* Rigg/Drift section (§34.1.3 første ledd) */}
          <div className="mb-4">
            <Controller
              name="har_rigg_krav"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="har_rigg_krav"
                  label="Økte rigg- og driftsutgifter"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {harRiggKrav && (
              <div className="mt-3 ml-6 space-y-4 border-l-2 border-pkt-border-subtle pl-4">
                <FormField
                  label="Estimert beløp for rigg/drift"
                  error={errors.belop_rigg?.message}
                >
                  <Controller
                    name="belop_rigg"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value ?? null}
                        onChange={field.onChange}
                        
                      />
                    )}
                  />
                </FormField>

                <FormField
                  label="Dato utgiftene ble erkjent"
                  helpText="Varslingsfristen løper fra dette tidspunktet"
                >
                  <Controller
                    name="dato_klar_over_rigg"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="dato_klar_over_rigg"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </FormField>

                {/* 7-day preclusion warning for rigg/drift */}
                {riggPreklusjon?.alert && (
                  <Alert
                    variant={riggPreklusjon.alert.variant}
                    title={riggPreklusjon.alert.title}
                  >
                    {riggPreklusjon.alert.message}
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Produktivitet section (§34.1.3 annet ledd) */}
          <div>
            <Controller
              name="har_produktivitet_krav"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="har_produktivitet_krav"
                  label="Nedsatt produktivitet"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {harProduktivitetKrav && (
              <div className="mt-3 ml-6 space-y-4 border-l-2 border-pkt-border-subtle pl-4">
                <FormField
                  label="Estimert beløp for produktivitetstap"
                  error={errors.belop_produktivitet?.message}
                >
                  <Controller
                    name="belop_produktivitet"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value ?? null}
                        onChange={field.onChange}
                        
                      />
                    )}
                  />
                </FormField>

                <FormField
                  label="Dato produktivitetstapet ble erkjent"
                  helpText="Varslingsfristen løper fra dette tidspunktet"
                >
                  <Controller
                    name="dato_klar_over_produktivitet"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="dato_klar_over_produktivitet"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </FormField>

                {/* 7-day preclusion warning for produktivitet */}
                {produktivitetPreklusjon?.alert && (
                  <Alert
                    variant={produktivitetPreklusjon.alert.variant}
                    title={produktivitetPreklusjon.alert.title}
                  >
                    {produktivitetPreklusjon.alert.message}
                  </Alert>
                )}
              </div>
            )}
          </div>
        </SectionContainer>

        {/* 4. Beregningsgrunnlag */}
        <SectionContainer
          title="Beregningsgrunnlag"
          description="Beskriv grunnlaget for beregningen og henvis til vedlegg"
        >
          <FormField
            required
            error={errors.begrunnelse?.message}
          >
            <Textarea
              id="begrunnelse"
              {...register('begrunnelse')}
              rows={3}
              fullWidth
              error={!!errors.begrunnelse}
              data-testid="vederlag-begrunnelse"
            />
          </FormField>
        </SectionContainer>

        {/* 5. Vedlegg */}
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
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="w-full sm:w-auto order-1 sm:order-2" data-testid="vederlag-submit">
            Send krav
          </Button>
        </div>
      </form>

      {/* Token expired alert */}
      <TokenExpiredAlert
        open={showTokenExpired}
        onClose={() => setShowTokenExpired(false)}
      />
    </Modal>
  );
}
