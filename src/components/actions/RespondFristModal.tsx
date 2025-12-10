/**
 * RespondFristModal Component
 *
 * Action modal for BH (client) to respond to a frist (deadline extension) claim.
 * Uses a 4-port wizard model based on NS 8407 requirements.
 *
 * WIZARD STRUCTURE:
 * - Port 1: Preklusjon (§33.4, §33.6) - Evaluate if TE notified in time
 * - Port 2: Vilkår (§33.5) - Evaluate if there was actual hindrance (subsidiært if prekludert)
 * - Port 3: Beregning - Calculate days (subsidiært if prekludert or no hindrance)
 * - Port 4: Oppsummering - Summary with principal AND subsidiary results
 *
 * IMPORTANT: BH must ALWAYS be able to take subsidiary position on all conditions.
 * Even if precluded, BH evaluates hindrance and days subsidiarily.
 *
 * KEY RULES (from Datasett_varslingsregler_8407.py):
 * - §33.4: TE must notify "uten ugrunnet opphold" when hindrance occurs - PRECLUSION if late
 * - §33.6.1: TE must specify days "uten ugrunnet opphold" when basis exists - REDUCTION if late
 * - §33.6.2: BH can demand specification - PRECLUSION if TE doesn't respond
 * - §33.7: BH must respond "uten ugrunnet opphold" - PASSIVE ACCEPTANCE if silent
 * - §33.8: Rejection may be treated as forsering order (with 30% cost limit)
 *
 * UPDATED (2025-12-09):
 * - Complete rewrite with 4-port wizard
 * - Subsidiary evaluation always available for all ports
 * - Principal AND subsidiary results shown in summary
 */

import { useState, useMemo, useCallback } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { DatePicker } from '../primitives/DatePicker';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { StepIndicator } from '../primitives/StepIndicator';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { BH_FRISTSVAR_DESCRIPTIONS } from '../../constants';
import { differenceInDays } from 'date-fns';
import type { SubsidiaerTrigger } from '../../types/timeline';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// Frist event info for context display
interface FristEventInfo {
  antall_dager?: number;
  ny_sluttfrist?: string;
  begrunnelse?: string;
  /** Date when the specified claim was received (for §33.7 preclusion calculation) */
  dato_krav_mottatt?: string;
}

interface RespondFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the frist claim event being responded to */
  fristKravId: string;
  krevdDager?: number;
  /** Optional frist event data for context display */
  fristEvent?: FristEventInfo;
  /** Status of the grunnlag response (for subsidiary treatment) */
  grunnlagStatus?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent';
  /** Type of varsel TE sent (nøytralt or spesifisert) - determines which checks to show */
  varselType?: 'noytralt' | 'spesifisert' | 'force_majeure';
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const respondFristSchema = z.object({
  // Port 1: Preklusjon
  noytralt_varsel_ok: z.boolean().optional(),
  spesifisert_krav_ok: z.boolean().optional(),
  send_etterlysning: z.boolean().optional(),
  frist_for_spesifisering: z.string().optional(),
  begrunnelse_preklusjon: z.string().optional(),

  // Port 2: Vilkår (alltid vurderes, evt. subsidiært)
  vilkar_oppfylt: z.boolean(),
  begrunnelse_vilkar: z.string().optional(),

  // Port 3: Beregning (alltid vurderes, evt. subsidiært)
  godkjent_dager: z.number().min(0, 'Antall dager kan ikke være negativt'),
  ny_sluttdato: z.string().optional(),
  begrunnelse_beregning: z.string().optional(),

  // Port 4: Oppsummering
  begrunnelse_samlet: z.string().min(10, 'Samlet begrunnelse må være minst 10 tegn'),
});

type RespondFristFormData = z.infer<typeof respondFristSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate principal result based on wizard inputs
 */
function beregnPrinsipaltResultat(data: {
  erPrekludert: boolean;
  sendEtterlysning: boolean;
  harHindring: boolean;
  krevdDager: number;
  godkjentDager: number;
}): string {
  // 1. Etterlysning sendes - avventer
  if (data.sendEtterlysning) {
    return 'avventer';
  }

  // 2. Preklusjon (Port 1) - avslått
  if (data.erPrekludert) {
    return 'avslatt';
  }

  // 3. Ingen hindring (Port 2) - avslått
  if (!data.harHindring) {
    return 'avslatt';
  }

  // 4. Beregning (Port 3)
  if (data.krevdDager === 0) {
    return 'godkjent';
  }

  const godkjentProsent = data.godkjentDager / data.krevdDager;

  if (godkjentProsent >= 0.99) {
    return 'godkjent';
  }

  return 'delvis_godkjent';
}

/**
 * Calculate subsidiary result (ignoring preclusion)
 */
function beregnSubsidiaertResultat(data: {
  harHindring: boolean;
  krevdDager: number;
  godkjentDager: number;
}): string {
  // Ingen hindring - avslått
  if (!data.harHindring) {
    return 'avslatt';
  }

  // Beregning
  if (data.krevdDager === 0) {
    return 'godkjent';
  }

  const godkjentProsent = data.godkjentDager / data.krevdDager;

  if (godkjentProsent >= 0.99) {
    return 'godkjent';
  }

  return 'delvis_godkjent';
}

/**
 * Get result label for display
 */
function getResultatLabel(resultat: string): string {
  const labels: Record<string, string> = {
    godkjent: 'Godkjent',
    delvis_godkjent: 'Delvis godkjent',
    avslatt: 'Avslått',
    avventer: 'Avventer dokumentasjon',
  };
  return labels[resultat] || resultat;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RespondFristModal({
  open,
  onOpenChange,
  sakId,
  fristKravId,
  krevdDager,
  fristEvent,
  grunnlagStatus,
  varselType,
}: RespondFristModalProps) {
  const [currentPort, setCurrentPort] = useState(1);

  // Effective days to compare (from fristEvent or krevdDager prop)
  const effektivKrevdDager = fristEvent?.antall_dager ?? krevdDager ?? 0;

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
    trigger,
    setValue,
  } = useForm<RespondFristFormData>({
    resolver: zodResolver(respondFristSchema),
    defaultValues: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      vilkar_oppfylt: true,
      send_etterlysning: false,
      godkjent_dager: effektivKrevdDager,
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: () => {
      reset();
      setCurrentPort(1);
    },
    onClose: () => onOpenChange(false),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      setCurrentPort(1);
      onOpenChange(false);
    },
  });

  // Watch all form values
  const formValues = watch();

  // Derived state from grunnlag
  const erGrunnlagSubsidiaer = grunnlagStatus === 'avvist_uenig';

  // §33.7: Calculate BH response time for preclusion warning
  const dagerSidenKrav = fristEvent?.dato_krav_mottatt
    ? differenceInDays(new Date(), new Date(fristEvent.dato_krav_mottatt))
    : 0;
  const bhPreklusjonsrisiko = dagerSidenKrav > 10;

  // Calculate preclusion status from Port 1
  const erPrekludert = useMemo(() => {
    if (varselType === 'noytralt') {
      return formValues.noytralt_varsel_ok === false;
    }
    return formValues.spesifisert_krav_ok === false;
  }, [formValues.noytralt_varsel_ok, formValues.spesifisert_krav_ok, varselType]);

  // Check if sending etterlysning (blocks further evaluation)
  const sendEtterlysning = formValues.send_etterlysning === true;

  // Check hindrance status from Port 2
  const harHindring = formValues.vilkar_oppfylt === true;

  // Determine subsidiary treatment levels
  const port2ErSubsidiaer = erPrekludert && !sendEtterlysning;
  const port3ErSubsidiaer = (erPrekludert || !harHindring) && !sendEtterlysning;

  // Get godkjent dager (respecting subsidiary logic)
  const godkjentDager = formValues.godkjent_dager ?? 0;

  // Calculate principal result
  const prinsipaltResultat = useMemo(
    () =>
      beregnPrinsipaltResultat({
        erPrekludert,
        sendEtterlysning,
        harHindring,
        krevdDager: effektivKrevdDager,
        godkjentDager,
      }),
    [erPrekludert, sendEtterlysning, harHindring, effektivKrevdDager, godkjentDager]
  );

  // Calculate subsidiary result (only relevant if prinsipalt is avvist)
  const subsidiaertResultat = useMemo(
    () =>
      beregnSubsidiaertResultat({
        harHindring,
        krevdDager: effektivKrevdDager,
        godkjentDager,
      }),
    [harHindring, effektivKrevdDager, godkjentDager]
  );

  // Determine if we need to show subsidiary result
  // Show when principal is rejected (due to preclusion or no hindring)
  const visSubsidiaertResultat = prinsipaltResultat === 'avslatt';

  // §33.8: Show forsering warning when rejecting or partial approval
  const visForsering = useMemo(() => {
    // For principal result - rejected
    if (prinsipaltResultat === 'avslatt') return true;
    if (prinsipaltResultat === 'delvis_godkjent' && godkjentDager < effektivKrevdDager) {
      return true;
    }
    // For subsidiary result when principal is avslatt
    if (
      prinsipaltResultat === 'avslatt' &&
      subsidiaertResultat === 'delvis_godkjent' &&
      godkjentDager < effektivKrevdDager
    ) {
      return true;
    }
    return false;
  }, [prinsipaltResultat, subsidiaertResultat, godkjentDager, effektivKrevdDager]);

  // Avslåtte dager for forsering warning
  const avslatteDager = effektivKrevdDager - godkjentDager;

  // Steps configuration
  const steps = [
    { label: 'Port 1', description: 'Preklusjon' },
    { label: 'Port 2', description: 'Vilkår' },
    { label: 'Port 3', description: 'Beregning' },
    { label: 'Port 4', description: 'Oppsummering' },
  ];

  // Navigation
  const goToNextPort = useCallback(async () => {
    let isValid = true;

    // Validate current port
    if (currentPort === 1) {
      isValid = await trigger([
        'noytralt_varsel_ok',
        'spesifisert_krav_ok',
        'send_etterlysning',
        'begrunnelse_preklusjon',
      ]);
    } else if (currentPort === 2) {
      isValid = await trigger(['vilkar_oppfylt', 'begrunnelse_vilkar']);
    } else if (currentPort === 3) {
      isValid = await trigger(['godkjent_dager', 'begrunnelse_beregning']);
    }

    if (isValid && currentPort < 4) {
      setCurrentPort(currentPort + 1);
    }
  }, [currentPort, trigger]);

  const goToPrevPort = useCallback(() => {
    if (currentPort > 1) {
      setCurrentPort(currentPort - 1);
    }
  }, [currentPort]);

  // Submit handler
  const onSubmit = (data: RespondFristFormData) => {
    // Beregn subsidiære triggere basert på Port 1 og Port 2 beslutninger
    const triggers: SubsidiaerTrigger[] = [];

    // Port 1: Preklusjon-triggere
    if (erPrekludert) {
      if (varselType === 'noytralt') {
        triggers.push('preklusjon_noytralt');
      } else {
        // spesifisert eller force_majeure
        triggers.push('preklusjon_spesifisert');
      }
    }

    // Port 2: Ingen hindring trigger
    if (!harHindring) {
      triggers.push('ingen_hindring');
    }

    mutation.mutate({
      eventType: 'respons_frist',
      data: {
        frist_krav_id: fristKravId,

        // Port 1: Preklusjon
        noytralt_varsel_ok: data.noytralt_varsel_ok,
        spesifisert_krav_ok: data.spesifisert_krav_ok,
        send_etterlysning: data.send_etterlysning,
        frist_for_spesifisering: data.frist_for_spesifisering,
        begrunnelse_preklusjon: data.begrunnelse_preklusjon,

        // Port 2: Vilkår
        vilkar_oppfylt: data.vilkar_oppfylt,
        begrunnelse_vilkar: data.begrunnelse_vilkar,

        // Port 3: Beregning
        godkjent_dager: godkjentDager,
        ny_sluttdato: data.ny_sluttdato,
        begrunnelse_beregning: data.begrunnelse_beregning,

        // Port 4: Oppsummering
        begrunnelse: data.begrunnelse_samlet,

        // Automatisk beregnet - prinsipalt
        beregnings_resultat: prinsipaltResultat,
        krevd_dager: effektivKrevdDager,

        // Subsidiært standpunkt (nye felt)
        subsidiaer_triggers: triggers.length > 0 ? triggers : undefined,
        subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
        subsidiaer_godkjent_dager: visSubsidiaertResultat ? godkjentDager : undefined,
        subsidiaer_begrunnelse: visSubsidiaertResultat ? data.begrunnelse_samlet : undefined,
      },
    });
  };

  // Reset to port 1 when opening
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setCurrentPort(1);
      setValue('godkjent_dager', effektivKrevdDager);
    }
    onOpenChange(newOpen);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Svar på fristkrav"
      size="lg"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentPort} steps={steps} />

        {/* §33.7 BH preclusion warning */}
        {bhPreklusjonsrisiko && (
          <Alert variant="danger" title="Svarplikt (§33.7)">
            Du har brukt <strong>{dagerSidenKrav} dager</strong> på å svare. Du skal svare
            &ldquo;uten ugrunnet opphold&rdquo;. Passivitet medfører at du taper innsigelser mot
            kravet!
          </Alert>
        )}

        {/* Grunnlag subsidiary treatment info */}
        {erGrunnlagSubsidiaer && (
          <Alert variant="info" title="Subsidiær behandling">
            Du har avvist ansvarsgrunnlaget. Dine svar på frist gjelder derfor kun subsidiært.
          </Alert>
        )}


        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ================================================================
              PORT 1: PREKLUSJON (§33.4, §33.6)
              ================================================================ */}
          {currentPort === 1 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <Badge variant="info">Port 1</Badge>
                <h3 className="font-bold text-lg">Preklusjon (§33.4, §33.6)</h3>
              </div>

              <p className="text-sm text-pkt-text-body-subtle mb-4">
                Vurder om entreprenøren har varslet i tide. Hvis ikke, kan kravet avvises pga
                preklusjon.
              </p>

              {/* Show what type of varsel TE sent */}
              {varselType && (
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle mb-4">
                  <span className="text-sm text-pkt-text-body-subtle">
                    Entreprenøren har sendt:{' '}
                  </span>
                  <Badge variant="default">
                    {varselType === 'noytralt' && 'Nøytralt varsel (§33.4)'}
                    {varselType === 'spesifisert' && 'Spesifisert krav (§33.6)'}
                    {varselType === 'force_majeure' && 'Force majeure (§33.3)'}
                  </Badge>
                </div>
              )}

              {/* Nøytralt varsel */}
              {varselType === 'noytralt' && (
                <>
                  <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                    <FormField
                      label="Nøytralt varsel sendt i tide? (§33.4)"
                      required
                      helpText="Entreprenøren skal varsle 'uten ugrunnet opphold' når han blir klar over at det kan oppstå forsinkelse."
                    >
                      <Controller
                        name="noytralt_varsel_ok"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup
                            value={
                              field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                            }
                            onValueChange={(val: string) => field.onChange(val === 'ja')}
                          >
                            <RadioItem value="ja" label="Ja - varslet i tide" />
                            <RadioItem
                              value="nei"
                              label="Nei - varslet for sent (prinsipalt prekludert)"
                            />
                          </RadioGroup>
                        )}
                      />
                    </FormField>
                  </div>

                  {/* Etterlysning option - only if varsel was OK */}
                  {formValues.noytralt_varsel_ok && (
                    <div className="space-y-3">
                      <Alert variant="warning" title="Etterlysning (§33.6.2)">
                        Entreprenøren har kun sendt nøytralt varsel uten antall dager. Du kan
                        etterspørre et spesifisert krav. Hvis entreprenøren ikke svarer «uten ugrunnet
                        opphold», tapes kravet.
                      </Alert>
                      <FormField label="Vil du sende etterlysning?">
                        <Controller
                          name="send_etterlysning"
                          control={control}
                          render={({ field }) => (
                            <RadioGroup
                              value={
                                field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                              }
                              onValueChange={(val: string) => field.onChange(val === 'ja')}
                            >
                              <RadioItem value="ja" label="Ja - send etterlysning nå" />
                              <RadioItem value="nei" label="Nei - fortsett behandling" />
                            </RadioGroup>
                          )}
                        />
                      </FormField>

                      {formValues.send_etterlysning && (
                        <FormField
                          label="Frist for svar"
                          helpText="Angi fristen innen hvilken entreprenøren må levere spesifisert krav"
                        >
                          <Controller
                            name="frist_for_spesifisering"
                            control={control}
                            render={({ field }) => (
                              <DatePicker
                                id="frist_for_spesifisering"
                                value={field.value}
                                onChange={field.onChange}
                              />
                            )}
                          />
                        </FormField>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Spesifisert krav */}
              {varselType === 'spesifisert' && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <FormField
                    label="Spesifisert krav sendt i tide? (§33.6)"
                    required
                    helpText="Entreprenøren skal 'uten ugrunnet opphold' angi og begrunne antall dager når han har grunnlag."
                  >
                    <Controller
                      name="spesifisert_krav_ok"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={
                            field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                          }
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - kravet kom i tide" />
                          <RadioItem
                            value="nei"
                            label="Nei - kravet kom for sent (prinsipalt prekludert)"
                          />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}

              {/* Force majeure */}
              {varselType === 'force_majeure' && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <FormField
                    label="Force majeure varslet i tide? (§33.3)"
                    required
                    helpText="Force majeure skal varsles 'uten ugrunnet opphold' etter at forholdet inntrådte."
                  >
                    <Controller
                      name="spesifisert_krav_ok"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={
                            field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                          }
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - varslet i tide" />
                          <RadioItem
                            value="nei"
                            label="Nei - varslet for sent (prinsipalt prekludert)"
                          />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}

              {/* Fallback if varselType not set */}
              {!varselType && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <FormField
                    label="Varsel/krav sendt i tide?"
                    required
                    helpText="Vurder om entreprenøren har varslet innen fristen."
                  >
                    <Controller
                      name="spesifisert_krav_ok"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={
                            field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                          }
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - varslet i tide" />
                          <RadioItem
                            value="nei"
                            label="Nei - varslet for sent (prinsipalt prekludert)"
                          />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}

              {/* Begrunnelse for preklusjon */}
              {erPrekludert && (
                <FormField
                  label="Begrunnelse for preklusjon"
                  helpText="Begrunn hvorfor varselet kom for sent"
                >
                  <Textarea
                    {...register('begrunnelse_preklusjon')}
                    rows={3}
                    fullWidth
                  />
                </FormField>
              )}

              {/* Preview of consequence */}
              {erPrekludert && !sendEtterlysning && (
                <Alert variant="info" title="Subsidiær vurdering">
                  Selv om kravet prinsipalt avvises pga. preklusjon, må du{' '}
                  <strong>subsidiært</strong> ta stilling til om fremdriften ble hindret og antall
                  dager.
                </Alert>
              )}

              {sendEtterlysning && (
                <Alert variant="info" title="Avventer svar">
                  Du sender etterlysning til TE. Svaret blir{' '}
                  <strong>&ldquo;Avventer spesifikasjon&rdquo;</strong>. TE må svare med spesifisert
                  krav.
                </Alert>
              )}
            </div>
          )}

          {/* ================================================================
              PORT 2: VILKÅR (§33.5) - Alltid vurderes, evt. subsidiært
              ================================================================ */}
          {currentPort === 2 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <Badge variant="info">Port 2</Badge>
                <h3 className="font-bold text-lg">Vilkår (§33.5)</h3>
                {port2ErSubsidiaer && <Badge variant="warning">Subsidiært</Badge>}
              </div>

              {/* Subsidiary banner */}
              {port2ErSubsidiaer && (
                <Alert variant="warning" title="Subsidiær vurdering">
                  Du har prinsipalt avvist kravet pga. preklusjon. Ta nå{' '}
                  <strong>subsidiært</strong> stilling til om forholdet medførte
                  fremdriftshindring.
                </Alert>
              )}

              {/* Etterlysning blocks further evaluation */}
              {sendEtterlysning ? (
                <Alert variant="info" title="Avventer svar">
                  Du avventer spesifisert krav fra entreprenøren. Vilkårsvurdering gjøres når svaret kommer.
                </Alert>
              ) : (
                <>
                  <Alert variant="info" title="Vilkår for fristforlengelse (§33.1, §33.5)">
                    For at entreprenøren skal ha krav på fristforlengelse må to kumulative vilkår
                    være oppfylt: (1) fremdriften må ha vært <strong>hindret</strong>, og (2) hindringen
                    må <strong>skyldes</strong> det påberopte forholdet (årsakssammenheng).
                  </Alert>

                  <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                    <FormField
                      label={
                        port2ErSubsidiaer
                          ? 'Subsidiært: Har forholdet hindret fremdriften?'
                          : 'Har forholdet hindret fremdriften?'
                      }
                      required
                      helpText="Vurder om det påberopte forholdet faktisk har forårsaket forsinkelse i prosjektet"
                    >
                      <Controller
                        name="vilkar_oppfylt"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup
                            value={field.value ? 'ja' : 'nei'}
                            onValueChange={(val: string) => field.onChange(val === 'ja')}
                          >
                            <RadioItem
                              value="ja"
                              label="Ja - forholdet har forårsaket faktisk forsinkelse"
                            />
                            <RadioItem
                              value="nei"
                              label="Nei - ingen reell forsinkelse (f.eks. slakk i planen, eller forsinkelsen skyldes andre forhold)"
                            />
                          </RadioGroup>
                        )}
                      />
                    </FormField>
                  </div>

                  {/* Begrunnelse vilkår */}
                  <FormField
                    label="Begrunnelse"
                    helpText="Beskriv hvorfor forholdet medførte/ikke medførte forsinkelse"
                  >
                    <Textarea
                      {...register('begrunnelse_vilkar')}
                      rows={3}
                      fullWidth
                    />
                  </FormField>

                  {/* Info about subsidiary calculation */}
                  {!harHindring && !port2ErSubsidiaer && (
                    <Alert variant="info" title="Subsidiær beregning">
                      Selv om du mener det ikke var reell hindring, må du{' '}
                      <strong>subsidiært</strong> ta stilling til antall dager i Port 3.
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* ================================================================
              PORT 3: BEREGNING - Alltid vurderes, evt. subsidiært
              ================================================================ */}
          {currentPort === 3 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <Badge variant="info">Port 3</Badge>
                <h3 className="font-bold text-lg">Beregning</h3>
                {port3ErSubsidiaer && <Badge variant="warning">Subsidiært</Badge>}
              </div>

              {/* Etterlysning blocks evaluation */}
              {sendEtterlysning ? (
                <Alert variant="info" title="Avventer svar">
                  Du avventer spesifisert krav fra entreprenøren. Beregning gjøres senere.
                </Alert>
              ) : (
                <>
                  {/* Subsidiary banner */}
                  {port3ErSubsidiaer && (
                    <Alert variant="warning" title="Subsidiær beregning">
                      {erPrekludert && !harHindring
                        ? 'Du har prinsipalt avvist kravet pga. preklusjon og mener det ikke var hindring. Ta nå subsidiært stilling til hvor mange dager entreprenøren maksimalt kan ha krav på – selv om du skulle ta feil i din prinsipale vurdering.'
                        : erPrekludert
                          ? 'Du har prinsipalt avvist kravet pga. preklusjon. Ta nå subsidiært stilling til hvor mange dager entreprenøren maksimalt kan ha krav på – selv om du skulle ta feil i din prinsipale vurdering.'
                          : 'Du mener det ikke var reell hindring. Ta nå subsidiært stilling til hvor mange dager entreprenøren maksimalt kan ha krav på – selv om du skulle ta feil i din prinsipale vurdering.'}
                    </Alert>
                  )}

                  {!port3ErSubsidiaer && (
                    <p className="text-sm text-pkt-text-body-subtle">
                      Beregn antall dager fristforlengelse basert på den faktiske forsinkelsen forholdet har forårsaket.
                    </p>
                  )}

                  {/* Hovedkrav beregning */}
                  <div className="p-4 bg-pkt-surface-subtle rounded-none border-2 border-pkt-border-default">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <h4 className="font-bold">
                        {port3ErSubsidiaer ? 'Subsidiær beregning' : 'Fristkrav'}
                      </h4>
                      <div className="text-left sm:text-right">
                        <span className="text-sm text-pkt-text-body-subtle">Krevd: </span>
                        <span className="text-lg font-mono font-bold">
                          {effektivKrevdDager} dager
                        </span>
                      </div>
                    </div>

                    <FormField
                      label={
                        port3ErSubsidiaer
                          ? 'Maksimalt antall dager'
                          : 'Godkjent antall dager'
                      }
                      required
                      error={errors.godkjent_dager?.message}
                      helpText={
                        !port3ErSubsidiaer && effektivKrevdDager > 0 && formValues.godkjent_dager !== undefined
                          ? `Differanse: ${effektivKrevdDager - formValues.godkjent_dager} dager (${((formValues.godkjent_dager / effektivKrevdDager) * 100).toFixed(1)}% godkjent)`
                          : undefined
                      }
                    >
                      <Input
                        type="number"
                        {...register('godkjent_dager', { valueAsNumber: true })}
                        width="xs"
                        error={!!errors.godkjent_dager}
                      />
                    </FormField>

                    {/* Ny sluttdato */}
                    {!port3ErSubsidiaer && (
                      <FormField
                        label="Ny sluttdato"
                        className="mt-4"
                        helpText="Beregnet ny sluttdato basert på godkjent forlengelse"
                      >
                        <Controller
                          name="ny_sluttdato"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              id="ny_sluttdato"
                              value={field.value}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </FormField>
                    )}
                  </div>

                  {/* Begrunnelse beregning */}
                  {(formValues.godkjent_dager !== effektivKrevdDager || port3ErSubsidiaer) && (
                    <FormField
                      label="Begrunnelse"
                      helpText={
                        port3ErSubsidiaer
                          ? 'Begrunn ditt subsidiære standpunkt'
                          : 'Begrunn din vurdering av antall dager'
                      }
                    >
                      <Textarea
                        {...register('begrunnelse_beregning')}
                        rows={3}
                        fullWidth
                      />
                    </FormField>
                  )}

                  {/* §33.8 Forsering warning */}
                  {visForsering && avslatteDager > 0 && !port3ErSubsidiaer && (
                    <Alert variant="info" title="Forsering-risiko (§33.8)">
                      Du avslår <strong>{avslatteDager} dager</strong> som TE mener å ha krav på.
                      <ul className="list-disc pl-5 mt-2 text-sm">
                        <li>
                          Dersom avslaget er uberettiget, kan TE velge å anse det som et{' '}
                          <strong>pålegg om forsering</strong>.
                        </li>
                        <li>
                          <strong>Begrensning:</strong> TE har ikke denne valgretten dersom
                          forseringskostnaden overstiger <strong>dagmulkten + 30%</strong>.
                        </li>
                      </ul>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* ================================================================
              PORT 4: OPPSUMMERING
              ================================================================ */}
          {currentPort === 4 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <Badge variant="info">Port 4</Badge>
                <h3 className="font-bold text-lg">Oppsummering</h3>
              </div>

              {/* Sammendrag av valg */}
              <div className="space-y-4">
                {/* Preklusjon (Port 1) */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-2">Preklusjon (Port 1)</h5>
                  <div className="flex items-center gap-2">
                    {sendEtterlysning ? (
                      <>
                        <Badge variant="warning">Etterlysning sendt</Badge>
                        <span className="text-sm">Avventer spesifisert krav fra TE</span>
                      </>
                    ) : erPrekludert ? (
                      <>
                        <Badge variant="danger">Prinsipalt prekludert</Badge>
                        <span className="text-sm">Varslet for sent</span>
                      </>
                    ) : (
                      <>
                        <Badge variant="success">OK</Badge>
                        <span className="text-sm">Varslet i tide</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Vilkår (Port 2) */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-2">
                    Vilkår (Port 2) {port2ErSubsidiaer && '- Subsidiært'}
                  </h5>
                  <div className="flex items-center gap-2">
                    {sendEtterlysning ? (
                      <span className="text-sm text-pkt-text-body-subtle">(Avventer)</span>
                    ) : harHindring ? (
                      <>
                        <Badge variant="success">
                          {port2ErSubsidiaer ? 'Subsidiært: ' : ''}Hindring erkjent
                        </Badge>
                        <span className="text-sm">Forholdet forårsaket forsinkelse</span>
                      </>
                    ) : (
                      <>
                        <Badge variant="warning">
                          {port2ErSubsidiaer ? 'Subsidiært: ' : ''}Ingen hindring
                        </Badge>
                        <span className="text-sm">TE hadde slakk / ikke reell forsinkelse</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Beregning (Port 3) */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-3">
                    Beregning (Port 3) {port3ErSubsidiaer && '- Subsidiært'}
                  </h5>
                  {sendEtterlysning ? (
                    <span className="text-sm text-pkt-text-body-subtle">(Avventer)</span>
                  ) : (
                    <>
                      {/* Desktop: tabell */}
                      <table className="hidden sm:table w-full text-sm">
                        <thead>
                          <tr className="border-b border-pkt-border-subtle">
                            <th className="text-left py-1">Krav</th>
                            <th className="text-right py-1">Krevd</th>
                            <th className="text-right py-1">
                              {port3ErSubsidiaer ? 'Maks. subs.' : 'Godkjent'}
                            </th>
                            <th className="text-right py-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-pkt-border-subtle">
                            <td className="py-2">Fristforlengelse</td>
                            <td className="text-right font-mono">{effektivKrevdDager} dager</td>
                            <td className="text-right font-mono">{godkjentDager} dager</td>
                            <td className="text-right">
                              {godkjentDager >= effektivKrevdDager ? (
                                <Badge variant="success">
                                  {port3ErSubsidiaer ? 'Subs. godkj.' : 'Godkjent'}
                                </Badge>
                              ) : godkjentDager > 0 ? (
                                <Badge variant="warning">
                                  {port3ErSubsidiaer ? 'Subs. delvis' : 'Delvis'}
                                </Badge>
                              ) : (
                                <Badge variant="danger">
                                  {port3ErSubsidiaer ? 'Subs. avsl.' : 'Avslått'}
                                </Badge>
                              )}
                            </td>
                          </tr>
                          <tr className="font-bold">
                            <td className="py-2">DIFFERANSE</td>
                            <td className="text-right font-mono"></td>
                            <td className="text-right font-mono">{avslatteDager} dager</td>
                            <td className="text-right">
                              {effektivKrevdDager > 0 && (
                                <span className="text-sm">
                                  {((godkjentDager / effektivKrevdDager) * 100).toFixed(1)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Mobil: card-liste */}
                      <div className="sm:hidden space-y-3">
                        {/* Fristforlengelse card */}
                        <div className="p-3 border border-pkt-border-subtle rounded-none">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium">Fristforlengelse</span>
                            {godkjentDager >= effektivKrevdDager ? (
                              <Badge variant="success">
                                {port3ErSubsidiaer ? 'Subs. godkj.' : 'Godkjent'}
                              </Badge>
                            ) : godkjentDager > 0 ? (
                              <Badge variant="warning">
                                {port3ErSubsidiaer ? 'Subs. delvis' : 'Delvis'}
                              </Badge>
                            ) : (
                              <Badge variant="danger">
                                {port3ErSubsidiaer ? 'Subs. avsl.' : 'Avslått'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-pkt-text-body-subtle">Krevd:</span>
                            <span className="font-mono">{effektivKrevdDager} dager</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-pkt-text-body-subtle">
                              {port3ErSubsidiaer ? 'Maks. subs.:' : 'Godkjent:'}
                            </span>
                            <span className="font-mono">{godkjentDager} dager</span>
                          </div>
                        </div>

                        {/* Differanse card */}
                        <div className="p-3 border-2 border-pkt-border-default rounded-none bg-pkt-surface-subtle">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold">DIFFERANSE</span>
                            {effektivKrevdDager > 0 && (
                              <span className="text-sm font-medium">
                                {((godkjentDager / effektivKrevdDager) * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-pkt-text-body-subtle">Avslått:</span>
                            <span className="font-mono font-bold">{avslatteDager} dager</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Prinsipalt resultat */}
                <div className="p-4 bg-pkt-surface-strong-dark-blue text-white rounded-none">
                  <h5 className="font-medium text-sm mb-2 opacity-80">PRINSIPALT RESULTAT</h5>
                  <div className="text-xl font-bold">{getResultatLabel(prinsipaltResultat)}</div>
                  {!sendEtterlysning && prinsipaltResultat !== 'avslatt' && (
                    <div className="mt-2 text-lg font-mono">
                      Godkjent: {godkjentDager} av {effektivKrevdDager} dager
                    </div>
                  )}
                </div>

                {/* Subsidiært resultat - shown when principal is avslatt */}
                {visSubsidiaertResultat && !sendEtterlysning && (
                  <div className="p-4 bg-pkt-surface-yellow border-2 border-pkt-surface-strong-yellow rounded-none">
                    <h5 className="font-medium text-sm mb-2 text-pkt-text-body-dark">SUBSIDIÆRT RESULTAT</h5>
                    <div className="text-xl font-bold text-pkt-text-body-dark">
                      {getResultatLabel(subsidiaertResultat)}
                    </div>
                    <div className="mt-2 text-lg font-mono text-pkt-text-body-dark">
                      {subsidiaertResultat === 'avslatt'
                        ? 'Subsidiært: Avslått'
                        : `Subsidiært: Maks ${godkjentDager} av ${effektivKrevdDager} dager`}
                    </div>
                    <p className="text-sm text-pkt-text-body-subtle mt-2 italic">
                      «Byggherren er etter dette uenig i kravet, og kan dessuten under ingen
                      omstendigheter se at mer enn {godkjentDager} dager er berettiget å kreve.»
                    </p>
                  </div>
                )}

                {/* §33.8 Forsering warning in summary */}
                {visForsering && avslatteDager > 0 && !sendEtterlysning && (
                  <Alert variant="warning" title="§33.8 Forsering-risiko">
                    Du avslår <strong>{avslatteDager} dager</strong>. Hvis avslaget er uberettiget,
                    kan TE velge å anse det som et pålegg om forsering.
                  </Alert>
                )}

                {/* Show description of principal result */}
                {prinsipaltResultat && BH_FRISTSVAR_DESCRIPTIONS[prinsipaltResultat] && (
                  <div className="p-4 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
                    <p className="text-sm text-pkt-text-body-subtle">
                      {BH_FRISTSVAR_DESCRIPTIONS[prinsipaltResultat]}
                    </p>
                  </div>
                )}

                {/* Samlet begrunnelse */}
                <FormField
                  label="Samlet begrunnelse"
                  required
                  error={errors.begrunnelse_samlet?.message}
                  helpText="Oppsummer din vurdering av fristkravet (prinsipalt og eventuelt subsidiært)"
                >
                  <Textarea
                    {...register('begrunnelse_samlet')}
                    rows={4}
                    fullWidth
                    error={!!errors.begrunnelse_samlet}
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Error Message */}
          {mutation.isError && (
            <Alert variant="danger" title="Feil ved innsending">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </Alert>
          )}

          {/* Navigation Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-4 pt-6 border-t-2 border-pkt-border-subtle">
            <div className="sm:order-1">
              {currentPort > 1 && (
                <Button type="button" variant="ghost" onClick={goToPrevPort} size="lg" className="w-full sm:w-auto">
                  ← Forrige
                </Button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
                size="lg"
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Avbryt
              </Button>

              {currentPort < 4 ? (
                <Button type="button" variant="primary" onClick={goToNextPort} size="lg" className="w-full sm:w-auto order-1 sm:order-2">
                  Neste →
                </Button>
              ) : (
                <Button type="submit" variant="primary" disabled={isSubmitting} size="lg" className="w-full sm:w-auto order-1 sm:order-2">
                  {isSubmitting ? 'Sender...' : 'Send svar'}
                </Button>
              )}
            </div>
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
      </div>
    </Modal>
  );
}
