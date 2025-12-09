/**
 * RespondFristModal Component
 *
 * Action modal for BH (client) to respond to a frist (deadline extension) claim.
 * Uses a 4-port wizard model based on NS 8407 requirements.
 *
 * WIZARD STRUCTURE:
 * - Port 1: Preklusjon (§33.4, §33.6) - Evaluate if TE notified in time
 * - Port 2: Vilkår (§33.5) - Evaluate if there was actual hindrance
 * - Port 3: Beregning - Calculate days (only if not precluded and has hindrance)
 * - Port 4: Oppsummering - Summary with auto-calculated result
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
 * - Automatic result calculation based on port inputs
 * - Port logic connection (preklusjon → vilkår → beregning)
 * - Summary table with krevd vs godkjent
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
  fristType?: 'kalenderdager' | 'arbeidsdager';
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

  // Port 2: Vilkår
  vilkar_oppfylt: z.boolean(),
  begrunnelse_vilkar: z.string().optional(),

  // Port 3: Beregning
  godkjent_dager: z.number().min(0, 'Antall dager kan ikke være negativt').optional(),
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
 * Calculate automatic result based on wizard inputs
 * Following NS 8407 logic from Datasett_varslingsregler_8407.py
 */
function beregnFristResultat(
  data: {
    erPrekludert: boolean;
    sendEtterlysning: boolean;
    harHindring: boolean;
    krevdDager: number;
    godkjentDager: number;
  }
): string {
  // 1. Etterlysning sendes - avventer spesifikasjon
  if (data.sendEtterlysning) {
    return 'avventer_spesifikasjon';
  }

  // 2. Preklusjon (Port 1)
  if (data.erPrekludert) {
    return 'avvist_preklusjon';
  }

  // 3. Ingen hindring (Port 2)
  if (!data.harHindring) {
    return 'avslatt_ingen_hindring';
  }

  // 4. Beregning (Port 3)
  if (data.krevdDager === 0) {
    return 'godkjent_fullt'; // Edge case - no days requested
  }

  const godkjentProsent = data.godkjentDager / data.krevdDager;

  if (godkjentProsent >= 0.99) {
    return 'godkjent_fullt';
  }

  return 'delvis_godkjent';
}

/**
 * Get result label for display
 */
function getResultatLabel(resultat: string): string {
  const labels: Record<string, string> = {
    godkjent_fullt: 'Godkjent fullt ut',
    delvis_godkjent: 'Delvis godkjent',
    avventer_spesifikasjon: 'Avventer spesifikasjon',
    avslatt_ingen_hindring: 'Avslått - Ingen fremdriftshindring',
    avvist_preklusjon: 'Avvist - Varslet for sent (preklusjon)',
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
  fristType,
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

  // Derived state
  const erSubsidiaer = grunnlagStatus === 'avvist_uenig';

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

  // Check if sending etterlysning
  const sendEtterlysning = formValues.send_etterlysning === true;

  // Check hindrance status from Port 2
  const harHindring = formValues.vilkar_oppfylt === true;

  // Calculate effective godkjent dager
  const effektivGodkjentDager = useMemo(() => {
    if (erPrekludert || sendEtterlysning) return 0;
    if (!harHindring) return 0;
    return formValues.godkjent_dager ?? 0;
  }, [erPrekludert, sendEtterlysning, harHindring, formValues.godkjent_dager]);

  // Calculate automatic result
  const automatiskResultat = useMemo(
    () =>
      beregnFristResultat({
        erPrekludert,
        sendEtterlysning,
        harHindring,
        krevdDager: effektivKrevdDager,
        godkjentDager: effektivGodkjentDager,
      }),
    [erPrekludert, sendEtterlysning, harHindring, effektivKrevdDager, effektivGodkjentDager]
  );

  // §33.8: Show forsering warning when rejecting or partial approval
  const visForsering = useMemo(() => {
    if (automatiskResultat === 'avslatt_ingen_hindring') return true;
    if (automatiskResultat === 'delvis_godkjent' && effektivGodkjentDager < effektivKrevdDager) {
      return true;
    }
    return false;
  }, [automatiskResultat, effektivGodkjentDager, effektivKrevdDager]);

  // Avslåtte dager for forsering warning
  const avslatteDager = effektivKrevdDager - effektivGodkjentDager;

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
        godkjent_dager: effektivGodkjentDager,
        ny_sluttdato: data.ny_sluttdato,
        begrunnelse_beregning: data.begrunnelse_beregning,

        // Port 4: Oppsummering
        begrunnelse: data.begrunnelse_samlet,

        // Automatisk beregnet
        resultat: automatiskResultat,
        krevd_dager: effektivKrevdDager,
      },
    });
  };

  // Reset to port 1 when opening
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setCurrentPort(1);
      // Reset godkjent_dager to krevd when opening
      setValue('godkjent_dager', effektivKrevdDager);
    }
    onOpenChange(newOpen);
  };

  // Determine if Port 3 should be disabled (prekludert or no hindrance)
  const port3Disabled = erPrekludert || sendEtterlysning || !harHindring;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Svar på fristkrav"
      description="Vurder fristkravet gjennom portmodellen"
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

        {/* Subsidiary treatment info */}
        {erSubsidiaer && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="warning">Subsidiær behandling</Badge>
            </div>
            <p className="text-sm text-amber-800">
              Du har avvist ansvarsgrunnlaget. Dine svar gjelder derfor{' '}
              <strong>kun subsidiært</strong>.
            </p>
          </div>
        )}

        {/* Fristkrav context */}
        {fristEvent && (fristEvent.antall_dager !== undefined || fristEvent.begrunnelse) && (
          <div className="p-4 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <h4 className="font-bold text-sm text-pkt-text-body-dark mb-2">
              Entreprenørens krav:
            </h4>
            <div className="flex justify-between items-center">
              <span className="text-xs text-pkt-text-body-subtle uppercase font-bold">
                Krav fra Entreprenør
              </span>
              {fristEvent.antall_dager !== undefined && (
                <span className="text-2xl font-bold">
                  {fristEvent.antall_dager} {fristType === 'arbeidsdager' ? 'arbeidsdager' : 'dager'}
                </span>
              )}
            </div>
            {fristEvent.ny_sluttfrist && (
              <p className="text-sm mt-1 text-pkt-text-body-subtle">
                Ønsket ny sluttdato: {fristEvent.ny_sluttfrist}
              </p>
            )}
            {fristEvent.begrunnelse && (
              <p className="italic text-pkt-text-body-subtle mt-2 text-sm border-t pt-2 border-pkt-border-subtle">
                &ldquo;{fristEvent.begrunnelse}&rdquo;
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ================================================================
              PORT 1: PREKLUSJON (§33.4, §33.6)
              ================================================================ */}
          {currentPort === 1 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex items-center gap-2 mb-4">
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
                              label="Nei - varslet for sent → Kravet prekluderes"
                            />
                          </RadioGroup>
                        )}
                      />
                    </FormField>
                  </div>

                  {/* Etterlysning option - only if varsel was OK */}
                  {formValues.noytralt_varsel_ok && (
                    <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="warning">Etterlysning (§33.6.2)</Badge>
                      </div>
                      <p className="text-sm text-amber-800 mb-3">
                        Entreprenøren har kun sendt nøytralt varsel uten antall dager. Du kan
                        etterspørre et spesifisert krav. Hvis TE ikke svarer &ldquo;uten ugrunnet
                        opphold&rdquo;, tapes kravet.
                      </p>
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

                      {/* Frist for spesifisering */}
                      {formValues.send_etterlysning && (
                        <FormField
                          label="Frist for svar fra TE"
                          className="mt-4"
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
                                placeholder="Velg dato"
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
                            label="Nei - kravet kom for sent → Kravet prekluderes"
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
                          <RadioItem value="nei" label="Nei - varslet for sent → Preklusjon" />
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
                          <RadioItem value="nei" label="Nei - varslet for sent → Preklusjon" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}

              {/* Begrunnelse for preklusjon */}
              {(erPrekludert || sendEtterlysning) && (
                <FormField
                  label={sendEtterlysning ? 'Begrunnelse for etterlysning' : 'Begrunnelse for preklusjon'}
                  helpText={
                    sendEtterlysning
                      ? 'Begrunn hvorfor du etterspør spesifisert krav'
                      : 'Begrunn hvorfor varselet kom for sent'
                  }
                >
                  <Textarea
                    {...register('begrunnelse_preklusjon')}
                    rows={3}
                    fullWidth
                    placeholder={
                      sendEtterlysning
                        ? 'Begrunn din etterlysning...'
                        : 'Begrunn din vurdering av at varselet kom for sent...'
                    }
                  />
                </FormField>
              )}

              {/* Preview of consequence */}
              {erPrekludert && (
                <Alert variant="warning" title="Konsekvens">
                  Fordi varselet kom for sent, vil kravet automatisk bli{' '}
                  <strong>avvist pga preklusjon</strong>. Du trenger ikke vurdere vilkår eller
                  beregning.
                </Alert>
              )}

              {sendEtterlysning && (
                <Alert variant="info" title="Konsekvens">
                  Du sender etterlysning til TE. Svaret blir automatisk{' '}
                  <strong>&ldquo;Avventer spesifikasjon&rdquo;</strong>. TE må svare med spesifisert
                  krav.
                </Alert>
              )}
            </div>
          )}

          {/* ================================================================
              PORT 2: VILKÅR (§33.5)
              ================================================================ */}
          {currentPort === 2 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="info">Port 2</Badge>
                <h3 className="font-bold text-lg">Vilkår (§33.5)</h3>
              </div>

              {/* Show if prekludert or etterlysning - this port is informational only */}
              {(erPrekludert || sendEtterlysning) ? (
                <div className="p-4 bg-gray-100 border-2 border-gray-300 rounded-none">
                  <p className="text-gray-600">
                    {erPrekludert && (
                      <>
                        <Badge variant="danger" className="mb-2">Prekludert i Port 1</Badge>
                        <br />
                        Kravet er allerede avvist pga. for sen varsling. Vilkårsvurdering er ikke
                        nødvendig.
                      </>
                    )}
                    {sendEtterlysning && (
                      <>
                        <Badge variant="warning" className="mb-2">Etterlysning sendt</Badge>
                        <br />
                        Du avventer spesifisert krav fra TE. Vilkårsvurdering gjøres når svaret
                        kommer.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-pkt-text-body-subtle mb-4">
                    Vurder om forholdet faktisk har medført en fremdriftshindring. Dette er
                    uavhengig av ansvarsvurderingen i Grunnlag-sporet.
                  </p>

                  <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                    <FormField
                      label="Har forholdet medført faktisk fremdriftshindring?"
                      required
                      helpText="Selv om grunnlaget (ansvaret) er erkjent, kan du vurdere at det ikke medførte reell forsinkelse."
                    >
                      <Controller
                        name="vilkar_oppfylt"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup
                            value={field.value ? 'ja' : 'nei'}
                            onValueChange={(val: string) => field.onChange(val === 'ja')}
                          >
                            <RadioItem value="ja" label="Ja - forholdet forårsaket forsinkelse" />
                            <RadioItem
                              value="nei"
                              label="Nei - ingen reell hindring (f.eks. TE hadde slakk)"
                            />
                          </RadioGroup>
                        )}
                      />
                    </FormField>
                  </div>

                  {/* Begrunnelse vilkår */}
                  <FormField
                    label="Begrunnelse for vilkårsvurdering"
                    helpText="Beskriv hvorfor forholdet medførte/ikke medførte forsinkelse."
                  >
                    <Textarea
                      {...register('begrunnelse_vilkar')}
                      rows={3}
                      fullWidth
                      placeholder={
                        harHindring
                          ? 'Beskriv hvordan forholdet påvirket fremdriften...'
                          : 'Beskriv hvorfor forholdet ikke medførte forsinkelse (f.eks. slakk i planen)...'
                      }
                    />
                  </FormField>

                  {/* Warning if no hindrance */}
                  {!harHindring && (
                    <Alert variant="warning" title="Konsekvens">
                      Fordi du mener det ikke var reell hindring, vil kravet automatisk bli{' '}
                      <strong>avslått med 0 dager</strong> godkjent.
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* ================================================================
              PORT 3: BEREGNING
              ================================================================ */}
          {currentPort === 3 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="info">Port 3</Badge>
                <h3 className="font-bold text-lg">Beregning</h3>
              </div>

              {/* Show if disabled */}
              {port3Disabled ? (
                <div className="p-4 bg-gray-100 border-2 border-gray-300 rounded-none">
                  <p className="text-gray-600">
                    {erPrekludert && (
                      <>
                        <Badge variant="danger" className="mb-2">Prekludert</Badge>
                        <br />
                        Kravet er avvist pga. for sen varsling. Godkjent: <strong>0 dager</strong>
                      </>
                    )}
                    {sendEtterlysning && (
                      <>
                        <Badge variant="warning" className="mb-2">Avventer svar</Badge>
                        <br />
                        Du avventer spesifisert krav fra TE. Beregning gjøres senere.
                      </>
                    )}
                    {!erPrekludert && !sendEtterlysning && !harHindring && (
                      <>
                        <Badge variant="warning" className="mb-2">Ingen hindring</Badge>
                        <br />
                        Du vurderte at det ikke var reell fremdriftshindring. Godkjent:{' '}
                        <strong>0 dager</strong>
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-pkt-text-body-subtle mb-4">
                    Beregn antall dager fristforlengelse. Dette er ren utmåling - ansvarsvurdering
                    håndteres i Grunnlag-sporet.
                  </p>

                  {/* Hovedkrav beregning */}
                  <div className="p-4 bg-pkt-surface-subtle rounded-none border-2 border-pkt-border-default">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold">Fristkrav</h4>
                      <div className="text-right">
                        <span className="text-sm text-pkt-text-body-subtle">TE krever: </span>
                        <span className="text-lg font-mono font-bold">
                          {effektivKrevdDager} dager
                        </span>
                      </div>
                    </div>

                    <FormField
                      label="Godkjent antall dager"
                      required
                      error={errors.godkjent_dager?.message}
                      helpText={
                        effektivKrevdDager > 0 && formValues.godkjent_dager !== undefined
                          ? `Differanse: ${effektivKrevdDager - formValues.godkjent_dager} dager (${((formValues.godkjent_dager / effektivKrevdDager) * 100).toFixed(1)}% godkjent)`
                          : undefined
                      }
                    >
                      <Input
                        type="number"
                        {...register('godkjent_dager', { valueAsNumber: true })}
                        width="xs"
                        placeholder="0"
                        error={!!errors.godkjent_dager}
                      />
                    </FormField>

                    {/* Ny sluttdato */}
                    <FormField
                      label="Ny sluttdato"
                      className="mt-4"
                      helpText="Beregnet ny sluttdato basert på godkjent forlengelse."
                    >
                      <Controller
                        name="ny_sluttdato"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            id="ny_sluttdato"
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Velg dato"
                          />
                        )}
                      />
                    </FormField>
                  </div>

                  {/* Begrunnelse beregning */}
                  {formValues.godkjent_dager !== effektivKrevdDager && (
                    <FormField
                      label="Begrunnelse for beregning"
                      helpText="Begrunn din vurdering av antall dager"
                    >
                      <Textarea
                        {...register('begrunnelse_beregning')}
                        rows={3}
                        fullWidth
                        placeholder="Begrunn hvorfor du godkjenner færre/flere dager enn krevd..."
                      />
                    </FormField>
                  )}

                  {/* §33.8 Forsering warning */}
                  {visForsering && avslatteDager > 0 && (
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
              <div className="flex items-center gap-2 mb-4">
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
                        <Badge variant="danger">Prekludert</Badge>
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
                  <h5 className="font-medium text-sm mb-2">Vilkår (Port 2)</h5>
                  <div className="flex items-center gap-2">
                    {erPrekludert || sendEtterlysning ? (
                      <span className="text-sm text-gray-500">(Ikke vurdert)</span>
                    ) : harHindring ? (
                      <>
                        <Badge variant="success">Hindring erkjent</Badge>
                        <span className="text-sm">Forholdet forårsaket forsinkelse</span>
                      </>
                    ) : (
                      <>
                        <Badge variant="warning">Ingen hindring</Badge>
                        <span className="text-sm">TE hadde slakk / ikke reell forsinkelse</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Beregning (Port 3) */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-3">Beregning (Port 3)</h5>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pkt-border-subtle">
                        <th className="text-left py-1">Krav</th>
                        <th className="text-right py-1">Krevd</th>
                        <th className="text-right py-1">Godkjent</th>
                        <th className="text-right py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-pkt-border-subtle">
                        <td className="py-2">Fristforlengelse</td>
                        <td className="text-right font-mono">{effektivKrevdDager} dager</td>
                        <td className="text-right font-mono">{effektivGodkjentDager} dager</td>
                        <td className="text-right">
                          {erPrekludert ? (
                            <Badge variant="danger">Prekludert</Badge>
                          ) : sendEtterlysning ? (
                            <Badge variant="warning">Avventer</Badge>
                          ) : !harHindring ? (
                            <Badge variant="warning">Avslått</Badge>
                          ) : effektivGodkjentDager >= effektivKrevdDager ? (
                            <Badge variant="success">Godkjent</Badge>
                          ) : (
                            <Badge variant="warning">Delvis</Badge>
                          )}
                        </td>
                      </tr>
                      <tr className="font-bold">
                        <td className="py-2">DIFFERANSE</td>
                        <td className="text-right font-mono"></td>
                        <td className="text-right font-mono">
                          {effektivKrevdDager - effektivGodkjentDager} dager
                        </td>
                        <td className="text-right">
                          {effektivKrevdDager > 0 && (
                            <span className="text-sm">
                              {((effektivGodkjentDager / effektivKrevdDager) * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Automatisk beregnet resultat */}
                <div className="p-4 bg-pkt-surface-strong-dark-blue text-white rounded-none">
                  <h5 className="font-medium text-sm mb-2 opacity-80">
                    AUTOMATISK BEREGNET RESULTAT
                  </h5>
                  <div className="text-xl font-bold">{getResultatLabel(automatiskResultat)}</div>
                  {!sendEtterlysning && (
                    <div className="mt-2 text-lg font-mono">
                      Godkjent: {effektivGodkjentDager} av {effektivKrevdDager} dager
                    </div>
                  )}
                </div>

                {/* §33.8 Forsering warning in summary */}
                {visForsering && avslatteDager > 0 && (
                  <Alert variant="warning" title="§33.8 Forsering-risiko">
                    Du avslår <strong>{avslatteDager} dager</strong>. Hvis avslaget er uberettiget,
                    kan TE velge å anse det som et pålegg om forsering.
                  </Alert>
                )}

                {/* Show description of result */}
                {automatiskResultat && BH_FRISTSVAR_DESCRIPTIONS[automatiskResultat] && (
                  <div className="p-4 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
                    <p className="text-sm text-pkt-text-body-subtle">
                      {BH_FRISTSVAR_DESCRIPTIONS[automatiskResultat]}
                    </p>
                  </div>
                )}

                {/* Samlet begrunnelse */}
                <FormField
                  label="Samlet begrunnelse"
                  required
                  error={errors.begrunnelse_samlet?.message}
                  helpText="Oppsummer din vurdering av fristkravet"
                >
                  <Textarea
                    {...register('begrunnelse_samlet')}
                    rows={4}
                    fullWidth
                    placeholder="Begrunn din samlede vurdering av fristkravet..."
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
          <div className="flex justify-between pt-6 border-t-2 border-pkt-border-subtle">
            <div>
              {currentPort > 1 && (
                <Button type="button" variant="ghost" onClick={goToPrevPort} size="lg">
                  ← Forrige
                </Button>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
                size="lg"
              >
                Avbryt
              </Button>

              {currentPort < 4 ? (
                <Button type="button" variant="primary" onClick={goToNextPort} size="lg">
                  Neste →
                </Button>
              ) : (
                <Button type="submit" variant="primary" disabled={isSubmitting} size="lg">
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
