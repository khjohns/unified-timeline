/**
 * ReviseVederlagModal Component
 *
 * Modal for TE to revise vederlag claim amount, method, or related fields.
 *
 * KEY FEATURES:
 * - Shows context from previous claim and BH response
 * - Allows method change (TE can change freely)
 * - Allows updating krever_justert_ep and varslet_for_oppstart
 * - Validates that something has actually changed
 * - Forces kostnadsoverslag when BH has hold_tilbake status
 *
 * §30.2: ANY increase in overslag triggers varslingsplikt
 *
 * UPDATED (2025-12-17):
 * - Added BH response context display
 * - Added method change support
 * - Added krever_justert_ep and varslet_for_oppstart fields
 * - Added validation that values have changed
 * - Added hold_tilbake handling (forces overslag)
 */

import {
  Alert,
  AttachmentUpload,
  Badge,
  Button,
  Checkbox,
  CurrencyInput,
  DatePicker,
  ExpandableText,
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
import { useMemo, useState, useEffect, useRef } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { sjekkRiggDriftFrist } from '../../utils/preklusjonssjekk';
import type { VederlagBeregningResultat } from '../../types/timeline';
import {
  VederlagMethodSelector,
  METODE_LABELS,
  RESULTAT_LABELS,
  RESULTAT_VARIANTS,
  type VederlagsMetode,
} from './shared';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// Særskilt krav item (§34.1.3)
interface SaerskiltKravItem {
  belop?: number;
  dato_klar_over?: string;
}

// Last vederlag event info - what TE previously submitted
interface LastVederlagEventInfo {
  event_id: string;
  metode: VederlagsMetode;
  belop_direkte?: number;
  kostnads_overslag?: number;
  begrunnelse?: string;
  krever_justert_ep?: boolean;
  varslet_for_oppstart?: boolean;
  // Særskilte krav (§34.1.3)
  saerskilt_krav?: {
    rigg_drift?: SaerskiltKravItem;
    produktivitet?: SaerskiltKravItem;
  } | null;
}

// BH response context - what BH answered (if any)
interface BhResponseInfo {
  resultat: VederlagBeregningResultat;
  godkjent_belop?: number;
  aksepterer_metode?: boolean;
  oensket_metode?: VederlagsMetode;
  ep_justering_akseptert?: boolean;
  begrunnelse?: string;
}

interface ReviseVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastVederlagEvent: LastVederlagEventInfo;
  /** Current version number (0 = original, 1+ = revisions). Next revision will be currentVersion + 1. */
  currentVersion?: number;
  /** BH's response to the claim (if any) */
  bhResponse?: BhResponseInfo;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const reviseVederlagSchema = z.object({
  // Method - all options shown, original pre-selected
  metode: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD']),

  // Amount fields
  nytt_belop_direkte: z.number().optional(),
  nytt_kostnads_overslag: z.number().optional(),

  // Method-related fields
  krever_justert_ep: z.boolean().optional(),
  varslet_for_oppstart: z.boolean().optional(),

  // Særskilte krav (§34.1.3) - Rigg/Drift og Produktivitet
  har_rigg_krav: z.boolean().optional(),
  har_produktivitet_krav: z.boolean().optional(),
  belop_rigg: z.number().optional(),
  belop_produktivitet: z.number().optional(),
  dato_klar_over_rigg: z.string().optional(),
  dato_klar_over_produktivitet: z.string().optional(),

  // Required
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
});

type ReviseVederlagFormData = z.infer<typeof reviseVederlagSchema>;

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviseVederlagModal({
  open,
  onOpenChange,
  sakId,
  lastVederlagEvent,
  currentVersion = 0,
  bhResponse,
  onCatendaWarning,
}: ReviseVederlagModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();
  // This revision will become the next version
  const nextVersion = currentVersion + 1;

  // Determine current effective metode
  const forrigeMetode = lastVederlagEvent.metode;
  const erRegningsarbeid = forrigeMetode === 'REGNINGSARBEID';
  const erEnhetspriser = forrigeMetode === 'ENHETSPRISER';

  // Get current values based on metode
  const forrigeBelop = erRegningsarbeid
    ? lastVederlagEvent.kostnads_overslag
    : lastVederlagEvent.belop_direkte;

  // BH context
  const harBhSvar = bhResponse !== undefined;
  const erHoldTilbake = bhResponse?.resultat === 'hold_tilbake';
  const bhAvvisteMetode = bhResponse?.aksepterer_metode === false;
  const bhAvvisteEpJustering =
    lastVederlagEvent.krever_justert_ep && bhResponse?.ep_justering_akseptert === false;

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
    setValue,
  } = useForm<ReviseVederlagFormData>({
    resolver: zodResolver(reviseVederlagSchema),
    defaultValues: {
      metode: lastVederlagEvent.metode,
      nytt_belop_direkte: erRegningsarbeid ? undefined : lastVederlagEvent.belop_direkte,
      nytt_kostnads_overslag: erRegningsarbeid ? lastVederlagEvent.kostnads_overslag : undefined,
      krever_justert_ep: lastVederlagEvent.krever_justert_ep ?? false,
      varslet_for_oppstart: lastVederlagEvent.varslet_for_oppstart ?? true,
      // Pre-fill særskilte krav from previous claim
      har_rigg_krav: !!lastVederlagEvent.saerskilt_krav?.rigg_drift,
      belop_rigg: lastVederlagEvent.saerskilt_krav?.rigg_drift?.belop,
      dato_klar_over_rigg: lastVederlagEvent.saerskilt_krav?.rigg_drift?.dato_klar_over,
      har_produktivitet_krav: !!lastVederlagEvent.saerskilt_krav?.produktivitet,
      belop_produktivitet: lastVederlagEvent.saerskilt_krav?.produktivitet?.belop,
      dato_klar_over_produktivitet: lastVederlagEvent.saerskilt_krav?.produktivitet?.dato_klar_over,
      begrunnelse: '',
      attachments: [],
    },
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'vederlag_krav_oppdatert', formData, isDirty);

  // Fresh values from lastVederlagEvent (for reset and Tilbakestill)
  const freshValues = useMemo((): ReviseVederlagFormData => ({
    metode: lastVederlagEvent.metode,
    nytt_belop_direkte: lastVederlagEvent.metode === 'REGNINGSARBEID' ? undefined : lastVederlagEvent.belop_direkte,
    nytt_kostnads_overslag: lastVederlagEvent.metode === 'REGNINGSARBEID' ? lastVederlagEvent.kostnads_overslag : undefined,
    krever_justert_ep: lastVederlagEvent.krever_justert_ep ?? false,
    varslet_for_oppstart: lastVederlagEvent.varslet_for_oppstart ?? true,
    har_rigg_krav: !!lastVederlagEvent.saerskilt_krav?.rigg_drift,
    belop_rigg: lastVederlagEvent.saerskilt_krav?.rigg_drift?.belop,
    dato_klar_over_rigg: lastVederlagEvent.saerskilt_krav?.rigg_drift?.dato_klar_over,
    har_produktivitet_krav: !!lastVederlagEvent.saerskilt_krav?.produktivitet,
    belop_produktivitet: lastVederlagEvent.saerskilt_krav?.produktivitet?.belop,
    dato_klar_over_produktivitet: lastVederlagEvent.saerskilt_krav?.produktivitet?.dato_klar_over,
    begrunnelse: '',
    attachments: [],
  }), [lastVederlagEvent]);

  // Reset form with latest values when modal opens
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;

      // Check for backup and merge with fresh values (backup takes precedence, but fills gaps)
      if (hasBackup && !isDirty) {
        const backup = getBackup();
        if (backup) {
          // Merge: backup overrides, but fresh values fill in missing fields
          reset({ ...freshValues, ...backup });
          toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
          return;
        }
      }

      // No backup - use fresh values
      reset(freshValues);
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast, freshValues]);

  // Handle reset to fresh values (Tilbakestill button)
  const handleReset = () => {
    clearBackup();
    reset(freshValues);
  };

  // Watch form values
  const selectedMetode = watch('metode');
  const nyttBelopDirekte = watch('nytt_belop_direkte');
  const nyttKostnadsOverslag = watch('nytt_kostnads_overslag');
  const kreverJustertEp = watch('krever_justert_ep');
  const varsletForOppstart = watch('varslet_for_oppstart');
  const harRiggKrav = watch('har_rigg_krav');
  const harProduktivitetKrav = watch('har_produktivitet_krav');
  const datoKlarOverRigg = watch('dato_klar_over_rigg');
  const datoKlarOverProduktivitet = watch('dato_klar_over_produktivitet');

  // Selected metode determines field display
  const nyErRegningsarbeid = selectedMetode === 'REGNINGSARBEID';
  const nyErEnhetspriser = selectedMetode === 'ENHETSPRISER';

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

  // Get the relevant amount based on effective metode
  const nyttBelop = nyErRegningsarbeid ? nyttKostnadsOverslag : nyttBelopDirekte;

  // §30.2 andre ledd: ANY increase in overslag triggers varslingsplikt
  const overslagsokningVarselpliktig = useMemo(() => {
    if (!nyErRegningsarbeid) return false;
    if (!nyttKostnadsOverslag) return false;

    // If changing TO regningsarbeid, any overslag is new
    if (selectedMetode === 'REGNINGSARBEID' && forrigeMetode !== 'REGNINGSARBEID') {
      return true;
    }

    // If already regningsarbeid, check for increase
    if (!lastVederlagEvent.kostnads_overslag) return true;
    return nyttKostnadsOverslag > lastVederlagEvent.kostnads_overslag;
  }, [
    nyErRegningsarbeid,
    nyttKostnadsOverslag,
    selectedMetode,
    forrigeMetode,
    lastVederlagEvent.kostnads_overslag,
  ]);

  // Calculate change amount (for display)
  const belopEndring = useMemo(() => {
    if (!nyttBelop || !forrigeBelop) return null;
    // Only show change if same metode type
    if (selectedMetode !== forrigeMetode) return null;
    return nyttBelop - forrigeBelop;
  }, [nyttBelop, forrigeBelop, selectedMetode, forrigeMetode]);

  // Allow revision with only begrunnelse update (no field changes required)
  const harEndringer = true;

  // Hold tilbake: Must provide overslag
  const manglerPaakrevdOverslag = useMemo(() => {
    if (!erHoldTilbake) return false;
    // If changing to regningsarbeid or staying regningsarbeid, must have overslag
    if (nyErRegningsarbeid) {
      return !nyttKostnadsOverslag || nyttKostnadsOverslag <= 0;
    }
    return false;
  }, [erHoldTilbake, nyErRegningsarbeid, nyttKostnadsOverslag]);

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
      toast.success('Vederlagskrav revidert', 'Det reviderte kravet er registrert og sendt til byggherre.');
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

  const onSubmit = (data: ReviseVederlagFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending('Sender revidert krav...', 'Vennligst vent mens kravet behandles.');

    const erRegning = data.metode === 'REGNINGSARBEID';
    const erEP = data.metode === 'ENHETSPRISER';

    // Build særskilt krav structure with separate dates per §34.1.3
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

    mutation.mutate({
      eventType: 'vederlag_krav_oppdatert',
      data: {
        original_event_id: lastVederlagEvent.event_id,

        // Use same field names as initial claim for consistency
        metode: data.metode,
        belop_direkte: erRegning ? undefined : data.nytt_belop_direkte,
        kostnads_overslag: erRegning ? data.nytt_kostnads_overslag : undefined,

        // Method-related fields
        krever_justert_ep: erEP ? data.krever_justert_ep : undefined,
        varslet_for_oppstart: erRegning ? data.varslet_for_oppstart : undefined,

        // Særskilte krav (§34.1.3)
        saerskilt_krav: saerskiltKrav,

        begrunnelse: data.begrunnelse,
        dato_revidert: new Date().toISOString().split('T')[0],
      },
    });
  };

  // Reset amount fields when method changes
  const handleMetodeChange = (newMetode: string) => {
    setValue('metode', newMetode as VederlagsMetode, { shouldDirty: true });
    // Clear amount fields when switching metode type
    setValue('nytt_belop_direkte', undefined, { shouldDirty: true });
    setValue('nytt_kostnads_overslag', undefined, { shouldDirty: true });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Oppdater vederlagskrav (${currentVersion === 0 ? 'original' : `v${currentVersion}`} → v${nextVersion})`}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">

        {/* Hold tilbake alert */}
        {erHoldTilbake && (
          <Alert variant="danger" title="Tilbakeholdelse (§30.2)">
            <p>
              Byggherren holder tilbake betaling fordi du ikke har levert kostnadsoverslag.
              Du <strong>må</strong> levere et kostnadsoverslag for å oppheve tilbakeholdelsen.
            </p>
          </Alert>
        )}

        {/* BH ønsker annen metode */}
        {bhAvvisteMetode && bhResponse?.oensket_metode && (
          <Alert variant="warning" title="Byggherren ønsker annen metode">
            <p>
              Byggherren har avvist din foreslåtte metode og ønsker{' '}
              <strong>{METODE_LABELS[bhResponse.oensket_metode]}</strong>.
              Vurder om du vil endre metode.
            </p>
          </Alert>
        )}

        {/* BH avviste EP-justering */}
        {bhAvvisteEpJustering && (
          <Alert variant="warning" title="EP-justering avvist (§34.3.3)">
            <p>
              Byggherren har avvist kravet om justerte enhetspriser.
              Du kan velge å opprettholde kravet eller droppe det.
            </p>
          </Alert>
        )}

        {/* Seksjon 2: Beregningsmetode */}
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
                        onChange={(metode) => handleMetodeChange(metode)}
                        error={errors.metode?.message}
                        kreverJustertEp={epField.value}
                        onKreverJustertEpChange={epField.onChange}
                        varsletForOppstart={varsletField.value}
                        onVarsletForOppstartChange={varsletField.onChange}
                        bhDesiredMethod={bhResponse?.oensket_metode}
                        bhAvvisteEpJustering={bhAvvisteEpJustering || false}
                      />
                    )}
                  />
                )}
              />
            )}
          />
        </SectionContainer>

        {/* Seksjon 3: Kravets omfang */}
        <SectionContainer title="Kravets omfang">
          {/* REGNINGSARBEID */}
            {nyErRegningsarbeid && (
              <>
                <Alert variant="info" className="mb-3">
                  Ved regningsarbeid faktureres kostnadene løpende. Ved fradrag reduseres vederlaget
                  med besparelsen, inkludert tilsvarende reduksjon av fortjenesten (§34.4).
                </Alert>
                <FormField
                  label="Kostnadsoverslag"
                  required={erHoldTilbake}
                  helpText="Estimert totalkostnad. Byggherren kan holde tilbake betaling inntil overslag mottas (§30.2)."
                  error={manglerPaakrevdOverslag ? 'Kostnadsoverslag er påkrevd for å oppheve tilbakeholdelse' : undefined}
                >
                  <Controller
                    name="nytt_kostnads_overslag"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value ?? null}
                        onChange={field.onChange}
                        error={manglerPaakrevdOverslag}
                      />
                    )}
                  />
                </FormField>
              </>
            )}

            {/* ENHETSPRISER */}
            {nyErEnhetspriser && (
              <FormField
                label="Sum direkte kostnader"
                helpText="Negativt beløp angir fradrag. Ved fradrag brukes enhetsprisene tilsvarende (§34.3)."
              >
                <Controller
                  name="nytt_belop_direkte"
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

            {/* FASTPRIS_TILBUD */}
            {selectedMetode === 'FASTPRIS_TILBUD' && (
              <FormField
                label="Tilbudt fastpris"
                helpText="Spesifisert tilbud (§34.2.1). Ved avslag faller oppgjøret tilbake på enhetspriser (§34.3) eller regningsarbeid (§34.4)."
              >
                <Controller
                  name="nytt_belop_direkte"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>
            )}

            {/* Change display */}
            {belopEndring !== null && belopEndring !== 0 && forrigeBelop && (
              <div
                className={`p-3 rounded-none border ${
                  belopEndring > 0
                    ? 'bg-pkt-surface-faded-red border-pkt-border-red'
                    : 'bg-pkt-surface-faded-green border-pkt-border-green'
                }`}
              >
                <p className="text-sm">
                  Endring:{' '}
                  <strong
                    className={
                      belopEndring > 0 ? 'text-pkt-brand-red-1000' : 'text-pkt-brand-dark-green-1000'
                    }
                  >
                    {belopEndring > 0 ? '+' : ''}
                    {belopEndring.toLocaleString('nb-NO')} kr
                  </strong>{' '}
                  ({((belopEndring / forrigeBelop) * 100).toFixed(1)}%)
                </p>
              </div>
            )}

            {/* Overslag increase warning (§30.2) */}
            {overslagsokningVarselpliktig && (
              <Alert variant="danger" title="Varslingsplikt (§30.2 andre ledd)">
                <p>
                  Du øker kostnadsoverslaget. I henhold til §30.2 andre ledd <strong>må</strong> du
                  varsle BH &ldquo;uten ugrunnet opphold&rdquo; når det er grunn til å anta at
                  overslaget vil bli overskredet.
                </p>
                <p className="mt-2 text-sm">
                  Ved å sende denne revisjonen dokumenterer du varselet. Begrunn hvorfor kostnadene
                  øker.
                </p>
              </Alert>
            )}
        </SectionContainer>

        {/* Seksjon 4: Særskilte krav (§34.1.3) - Rigg, Drift, Produktivitet */}
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
              <div className="mt-3 ml-6 space-y-3 sm:space-y-4 border-l-2 border-pkt-border-subtle pl-4">
                <p className="text-sm text-pkt-text-body-subtle">
                  <ExpandableText preview="Kravet må varsles «uten ugrunnet opphold».">
                    Krav på særskilt justering for rigg/drift må varsles «uten ugrunnet opphold» etter at entreprenøren ble klar over at utgifter ville påløpe som en nødvendig følge av endring, forsinkelse/svikt ved byggherrens ytelser, eller andre forhold byggherren har risikoen for.
                  </ExpandableText>
                </p>

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
              <div className="mt-3 ml-6 space-y-3 sm:space-y-4 border-l-2 border-pkt-border-subtle pl-4">
                <p className="text-sm text-pkt-text-body-subtle">
                  <ExpandableText preview="Kravet må varsles «uten ugrunnet opphold».">
                    Krav på produktivitetstap må varsles «uten ugrunnet opphold» etter at entreprenøren ble klar over at utgifter ville påløpe som følge av endring, forsinkelse/svikt ved byggherrens ytelser, eller andre forhold byggherren har risikoen for.
                  </ExpandableText>
                </p>

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

        {/* Seksjon 5: Begrunnelse */}
        <SectionContainer title="Begrunnelse">
          <FormField label="Begrunnelse for revisjon" required error={errors.begrunnelse?.message}>
            <Controller
              name="begrunnelse"
              control={control}
              render={({ field }) => (
                <Textarea
                  id="begrunnelse"
                  value={field.value}
                  onChange={field.onChange}
                  rows={4}
                  fullWidth
                  error={!!errors.begrunnelse}
                  placeholder={
                    overslagsokningVarselpliktig
                      ? 'Begrunn hvorfor kostnadene øker utover opprinnelig overslag...'
                      : undefined
                  }
                />
              )}
            />
          </FormField>
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
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          {/* Venstre: Tilbakestill (kun synlig når isDirty) */}
          <div>
            {isDirty && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                Tilbakestill
              </Button>
            )}
          </div>

          {/* Høyre: Avbryt + Hovedhandling */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              variant={overslagsokningVarselpliktig ? 'danger' : 'primary'}
              disabled={isSubmitting || manglerPaakrevdOverslag}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isSubmitting
                ? 'Sender...'
                : overslagsokningVarselpliktig
                  ? 'Send Varsel om Overslagsoverskridelse'
                  : 'Send Revisjon'}
            </Button>
          </div>
        </div>
      </form>

      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
