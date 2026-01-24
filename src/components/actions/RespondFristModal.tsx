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

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  Alert,
  Badge,
  Button,
  DataList,
  DataListItem,
  DatePicker,
  FormField,
  InlineDataList,
  InlineDataListItem,
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  StatusSummary,
  StepIndicator,
  Textarea,
  useToast,
} from '../primitives';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { differenceInDays, format, parseISO } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { SubsidiaerTrigger, FristTilstand, FristBeregningResultat } from '../../types/timeline';
import {
  generateFristResponseBegrunnelse,
  combineBegrunnelse,
  type FristResponseInput,
} from '../../utils/begrunnelseGenerator';
import { getResultatLabel, formatVarselMetode } from '../../utils/formatters';
import { VarslingsregelInline } from '../shared';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// Varsel info structure
interface VarselInfoData {
  dato_sendt?: string;
  metode?: string[];
}

// Frist event info for context display
interface FristEventInfo {
  antall_dager?: number;
  ny_sluttfrist?: string;
  begrunnelse?: string;
  /** Date when the specified claim was received (for §33.7 preclusion calculation) */
  dato_krav_mottatt?: string;
  /** Date when TE discovered the issue (from grunnlag) */
  dato_oppdaget?: string;
  /** Foreløpig varsel info (§33.4) */
  noytralt_varsel?: VarselInfoData;
  /** Spesifisert krav info (§33.6) */
  spesifisert_varsel?: VarselInfoData;
}

// Last response event info for update mode
interface LastFristResponseEvent {
  event_id: string;
  resultat: FristBeregningResultat;
  godkjent_dager?: number;
  begrunnelse?: string;
}

interface RespondFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the frist claim event being responded to (required for respond mode, not needed for update mode) */
  fristKravId?: string;
  krevdDager?: number;
  /** Optional frist event data for context display */
  fristEvent?: FristEventInfo;
  /** Status of the grunnlag response (for subsidiary treatment) */
  grunnlagStatus?: 'godkjent' | 'avslatt' | 'delvis_godkjent';
  /** Type of varsel TE sent (nøytralt or spesifisert) - determines which checks to show */
  varselType?: 'noytralt' | 'spesifisert';
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
  /** When true, show "Lagre utkast" instead of "Send svar" for approval workflow */
  approvalEnabled?: boolean;
  /** Callback when saving as draft (for approval workflow) */
  onSaveDraft?: (draftData: {
    dager: number;
    resultat: 'godkjent' | 'delvis_godkjent' | 'avslatt';
    begrunnelse?: string;
    formData: RespondFristFormData;
  }) => void;

  // ========== UPDATE MODE ==========
  /** When provided, modal switches to update mode (asymmetric changes only) */
  lastResponseEvent?: LastFristResponseEvent;
  /** Full frist state - required for update mode */
  fristTilstand?: FristTilstand;
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const respondFristSchema = z.object({
  // Port 1: Preklusjon
  noytralt_varsel_ok: z.boolean().optional(),
  spesifisert_krav_ok: z.boolean().optional(),
  etterlysning_svar_ok: z.boolean().optional(), // §33.6.2/§5: Svar på etterlysning i tide?
  send_etterlysning: z.boolean().optional(),
  frist_for_spesifisering: z.string().optional(),

  // Port 2: Vilkår (alltid vurderes, evt. subsidiært)
  vilkar_oppfylt: z.boolean(),
  begrunnelse_vilkar: z.string().optional(),

  // Port 3: Beregning (alltid vurderes, evt. subsidiært)
  godkjent_dager: z.number().min(0, 'Antall dager kan ikke være negativt'),
  ny_sluttdato: z.string().optional(),

  // Port 4: Oppsummering
  // Note: auto_begrunnelse is generated, not user-editable
  tilleggs_begrunnelse: z.string().optional(),

  // ========== UPDATE MODE FIELDS ==========
  // Port 2: Preklusjon - kan kun endres til TEs gunst
  endre_preklusjon: z.boolean().optional(),

  // Port 3: Vilkår - kan kun endres til TEs gunst
  endre_vilkar: z.boolean().optional(),

  // Port 4: Beregning
  beregnings_resultat: z.string().optional(),

  // Update mode begrunnelse
  kommentar: z.string().optional(),
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
  // 1. Etterlysning sendes - avslått (BH avslår midlertidig, venter på spesifisert krav)
  if (data.sendEtterlysning) {
    return 'avslatt';
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
  onCatendaWarning,
  approvalEnabled = false,
  onSaveDraft,
  // Update mode props
  lastResponseEvent,
  fristTilstand,
}: RespondFristModalProps) {
  // ========== UPDATE MODE DETECTION ==========
  const isUpdateMode = !!lastResponseEvent;
  const [currentPort, setCurrentPort] = useState(1);
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Scroll to top of modal content
  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Effective days to compare (from fristEvent, krevdDager prop, or fristTilstand for update mode)
  const effektivKrevdDager = fristEvent?.antall_dager ?? krevdDager ?? fristTilstand?.krevd_dager ?? 0;

  // Check if this is a neutral notice without specified days
  // In this case, BH should typically send etterlysning to request specification
  const erNoytraltUtenDager = varselType === 'noytralt' && effektivKrevdDager === 0;

  // §33.6.2 bokstav b: TE har begrunnet hvorfor beregning ikke er mulig
  // I dette tilfellet gjelder §33.6.1 videre - BH kan bare bekrefte mottak
  const erBegrunnelseUtsatt = varselType === 'begrunnelse_utsatt';

  // ========== UPDATE MODE: Compute default values ==========
  const computedDefaultValues = useMemo((): Partial<RespondFristFormData> => {
    if (isUpdateMode && lastResponseEvent && fristTilstand) {
      // UPDATE MODE: Pre-fill from previous response
      return {
        noytralt_varsel_ok: fristTilstand.noytralt_varsel_ok ?? true,
        spesifisert_krav_ok: fristTilstand.spesifisert_krav_ok ?? true,
        etterlysning_svar_ok: fristTilstand.etterlysning_svar_ok ?? true,
        vilkar_oppfylt: fristTilstand.vilkar_oppfylt ?? true,
        send_etterlysning: false,
        godkjent_dager: lastResponseEvent.godkjent_dager ?? effektivKrevdDager,
      };
    }
    // RESPOND MODE: Default values
    return {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      etterlysning_svar_ok: true,
      vilkar_oppfylt: true,
      send_etterlysning: false,
      godkjent_dager: effektivKrevdDager,
    };
  }, [isUpdateMode, lastResponseEvent, fristTilstand, effektivKrevdDager]);

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
    clearErrors,
  } = useForm<RespondFristFormData>({
    resolver: zodResolver(respondFristSchema),
    mode: 'onTouched', // Only show errors after field is touched
    defaultValues: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      etterlysning_svar_ok: true,
      vilkar_oppfylt: true,
      send_etterlysning: false,
      godkjent_dager: effektivKrevdDager,
    },
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'respons_frist', formData, isDirty);

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

  // Reset form when opening in update mode with new lastResponseEvent
  useEffect(() => {
    if (open && isUpdateMode && lastResponseEvent) {
      reset(computedDefaultValues);
    }
  }, [open, isUpdateMode, lastResponseEvent, reset, computedDefaultValues]);

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
      setCurrentPort(1);
      onOpenChange(false);
      toast.success(
        isUpdateMode ? 'Svar oppdatert' : 'Svar sendt',
        isUpdateMode ? 'Ditt oppdaterte svar på fristkravet er registrert.' : 'Ditt svar på fristkravet er registrert.'
      );
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

  // Watch all form values
  const formValues = watch();

  // Derived state from grunnlag
  const erGrunnlagSubsidiaer = grunnlagStatus === 'avslatt';

  // §33.7: Calculate BH response time for preclusion warning
  // BH skal svare "uten ugrunnet opphold" - varsler etter 5 dager for å gi margin
  const dagerSidenKrav = fristEvent?.dato_krav_mottatt
    ? differenceInDays(new Date(), new Date(fristEvent.dato_krav_mottatt))
    : 0;
  const bhPreklusjonsrisiko = dagerSidenKrav > 5;

  // Sjekk om det finnes tidligere nøytralt varsel som ble akseptert som i tide
  // Dette er viktig for å skille mellom §33.4 preklusjon og §33.6.1 reduksjon
  const harTidligereNoytraltVarselITide = useMemo(() => {
    // Tidligere vurdert og akseptert av BH
    if (fristTilstand?.noytralt_varsel_ok === true) {
      return true;
    }
    // Finnes nøytralt varsel (fra event eller tilstand) og BH har ikke avslått det
    const harNoytraltVarsel = !!(fristEvent?.noytralt_varsel || fristTilstand?.noytralt_varsel);
    if (harNoytraltVarsel && formValues.noytralt_varsel_ok !== false) {
      return true;
    }
    return false;
  }, [fristTilstand?.noytralt_varsel_ok, fristTilstand?.noytralt_varsel, fristEvent?.noytralt_varsel, formValues.noytralt_varsel_ok]);

  // §33.6.2 fjerde ledd: Hvis kravet er svar på etterlysning, kan byggherren
  // IKKE påberope at fristen i §33.6.1 er oversittet
  const erSvarPaEtterlysning = useMemo(() => {
    return fristTilstand?.har_bh_etterlyst === true && varselType === 'spesifisert';
  }, [fristTilstand?.har_bh_etterlyst, varselType]);

  // §33.6.2 tredje ledd + §5: Sen respons på etterlysning = PREKLUSJON
  // BH må påberope dette via §5 ("skriftlig uten ugrunnet opphold")
  const erEtterlysningSvarForSent = useMemo(() => {
    return erSvarPaEtterlysning && formValues.etterlysning_svar_ok === false;
  }, [erSvarPaEtterlysning, formValues.etterlysning_svar_ok]);

  // Calculate preclusion status from Port 1
  // §33.4: Varsel for sent = FULL PREKLUSJON (kravet tapes)
  // §33.6.2 tredje ledd: Sen respons på etterlysning = PREKLUSJON
  const erPrekludert = useMemo(() => {
    // §33.6.2 tredje ledd + §5: Sen respons på etterlysning = PREKLUSJON
    if (erEtterlysningSvarForSent) {
      return true;
    }
    // §33.4: Nøytralt varsel for sent = PREKLUSJON
    if (varselType === 'noytralt') {
      return formValues.noytralt_varsel_ok === false;
    }
    // §33.4: Spesifisert krav direkte (uten tidligere nøytralt varsel i tide) for sent = PREKLUSJON
    // Fordi det spesifiserte kravet fungerer som varsel, og det kom for sent
    if (varselType === 'spesifisert' && !harTidligereNoytraltVarselITide) {
      return formValues.spesifisert_krav_ok === false;
    }
    return false;
  }, [formValues.noytralt_varsel_ok, formValues.spesifisert_krav_ok, varselType, harTidligereNoytraltVarselITide, erEtterlysningSvarForSent]);

  // §33.6.1: Sen spesifisering gir reduksjon (ikke preklusjon)
  // Entreprenøren har kun krav på det byggherren "måtte forstå"
  // FORUTSETNING: Nøytralt varsel må ha blitt sendt i tide først
  // UNNTAK: Gjelder IKKE når kravet er svar på etterlysning (§33.6.2 fjerde ledd)
  const erRedusert_33_6_1 = useMemo(() => {
    // §33.6.2 fjerde ledd: Byggherren kan ikke påberope §33.6.1 ved svar på etterlysning
    if (erSvarPaEtterlysning) {
      return false;
    }
    // §33.6.1 reduksjon gjelder KUN når:
    // 1. Nåværende varsel er spesifisert
    // 2. Det ble sendt nøytralt varsel i tide tidligere (§33.4 oppfylt)
    // 3. Spesifisert krav kom for sent
    if (varselType === 'spesifisert' && harTidligereNoytraltVarselITide) {
      return formValues.spesifisert_krav_ok === false;
    }
    return false;
  }, [formValues.spesifisert_krav_ok, varselType, erSvarPaEtterlysning, harTidligereNoytraltVarselITide]);

  // Reset send_etterlysning when noytralt_varsel_ok changes to false
  // (etterlysning is only valid when varsel was on time)
  useEffect(() => {
    if (formValues.noytralt_varsel_ok === false && formValues.send_etterlysning === true) {
      setValue('send_etterlysning', false);
    }
  }, [formValues.noytralt_varsel_ok, formValues.send_etterlysning, setValue]);

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

  // Generate auto-begrunnelse based on all form selections
  const autoBegrunnelse = useMemo(() => {
    const input: FristResponseInput = {
      // Claim context
      varselType: varselType,
      krevdDager: effektivKrevdDager,

      // Preklusjon
      noytraltVarselOk: formValues.noytralt_varsel_ok,
      spesifisertKravOk: formValues.spesifisert_krav_ok,
      etterlysningVarOk: formValues.etterlysning_svar_ok,
      sendEtterlysning: sendEtterlysning,

      // Vilkår
      vilkarOppfylt: harHindring,

      // Beregning
      godkjentDager: godkjentDager,

      // Computed
      erPrekludert: erPrekludert,
      erEtterlysningSvarForSent: erEtterlysningSvarForSent,
      erRedusert_33_6_1: erRedusert_33_6_1,
      harTidligereNoytraltVarselITide: harTidligereNoytraltVarselITide,
      prinsipaltResultat: prinsipaltResultat,
      subsidiaertResultat: subsidiaertResultat,
      visSubsidiaertResultat: visSubsidiaertResultat,
    };

    return generateFristResponseBegrunnelse(input);
  }, [
    varselType,
    effektivKrevdDager,
    formValues.noytralt_varsel_ok,
    formValues.spesifisert_krav_ok,
    formValues.etterlysning_svar_ok,
    sendEtterlysning,
    harHindring,
    godkjentDager,
    erPrekludert,
    erEtterlysningSvarForSent,
    erRedusert_33_6_1,
    harTidligereNoytraltVarselITide,
    prinsipaltResultat,
    subsidiaertResultat,
    visSubsidiaertResultat,
  ]);

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

  // Steps configuration - 5 steps
  const steps = [
    { label: 'Oversikt' },
    { label: 'Preklusjon' },
    { label: 'Årsakssammenheng' },
    { label: 'Beregning' },
    { label: 'Oppsummering' },
  ];

  const totalPorts = 5;

  // Determine which step type we're on based on currentPort
  const getStepType = useCallback(
    (port: number): 'oversikt' | 'preklusjon' | 'vilkar' | 'beregning' | 'oppsummering' => {
      if (port === 1) return 'oversikt';
      if (port === 2) return 'preklusjon';
      if (port === 3) return 'vilkar';
      if (port === 4) return 'beregning';
      return 'oppsummering';
    },
    []
  );

  const currentStepType = getStepType(currentPort);

  // Navigation
  const goToNextPort = useCallback(async () => {
    let isValid = true;

    // Validate current port based on step type
    if (currentStepType === 'preklusjon') {
      isValid = await trigger([
        'noytralt_varsel_ok',
        'spesifisert_krav_ok',
        'send_etterlysning',
      ]);
    } else if (currentStepType === 'vilkar') {
      isValid = await trigger(['vilkar_oppfylt']);
    } else if (currentStepType === 'beregning') {
      isValid = await trigger(['godkjent_dager']);
    }
    // 'oversikt' has no validation - just informational

    if (isValid && currentPort < totalPorts) {
      setCurrentPort(currentPort + 1);
      // Clear errors for next step's fields to prevent premature validation display
      clearErrors('tilleggs_begrunnelse');
      // Small delay to ensure DOM has updated before scrolling
      setTimeout(scrollToTop, 50);
    }
  }, [currentPort, totalPorts, trigger, currentStepType, scrollToTop, clearErrors]);

  const goToPrevPort = useCallback(() => {
    if (currentPort > 1) {
      setCurrentPort(currentPort - 1);
      setTimeout(scrollToTop, 50);
    }
  }, [currentPort, scrollToTop]);

  // Handler for saving as draft (approval workflow)
  const handleSaveDraft = (data: RespondFristFormData) => {
    if (!onSaveDraft) return;

    // Determine resultat based on principal result
    let resultat: 'godkjent' | 'delvis_godkjent' | 'avslatt';
    if (prinsipaltResultat === 'godkjent') {
      resultat = 'godkjent';
    } else if (prinsipaltResultat === 'avslatt') {
      resultat = 'avslatt';
    } else {
      resultat = 'delvis_godkjent';
    }

    // Combine auto-generated begrunnelse with user's additional comments
    const samletBegrunnelse = combineBegrunnelse(autoBegrunnelse, data.tilleggs_begrunnelse);

    onSaveDraft({
      dager: godkjentDager,
      resultat,
      begrunnelse: samletBegrunnelse,
      formData: data,
    });

    // Clear backup and close modal
    clearBackup();
    reset();
    setCurrentPort(1);
    onOpenChange(false);
    toast.success('Utkast lagret', 'Fristsvaret er lagret som utkast. Du kan nå sende det til godkjenning.');
  };

  // Submit handler
  const onSubmit = (data: RespondFristFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending(
      isUpdateMode ? 'Lagrer endringer...' : 'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    // ========== UPDATE MODE SUBMIT ==========
    if (isUpdateMode && lastResponseEvent) {
      // Build event data based on what's being changed
      const eventData: Record<string, unknown> = {
        original_respons_id: lastResponseEvent.event_id,
        kommentar: data.kommentar,
        dato_endret: new Date().toISOString().split('T')[0],
      };

      // Port 2: Preklusjon-endringer (kun til TEs gunst)
      if (data.endre_preklusjon) {
        if (varselType === 'noytralt') {
          eventData.noytralt_varsel_ok = true;
        } else {
          eventData.spesifisert_krav_ok = true;
        }
      }

      // Port 3: Vilkår-endringer (kun til TEs gunst)
      if (data.endre_vilkar) {
        eventData.vilkar_oppfylt = true;
      }

      // Port 4: Beregning-endringer
      if (data.beregnings_resultat) {
        eventData.beregnings_resultat = data.beregnings_resultat;
        eventData.godkjent_dager = data.beregnings_resultat === 'godkjent'
          ? effektivKrevdDager
          : data.godkjent_dager;
      }

      mutation.mutate({
        eventType: 'respons_frist_oppdatert',
        data: eventData,
      });
      return;
    }

    // ========== RESPOND MODE SUBMIT (original) ==========
    // Beregn subsidiære triggere basert på Port 1 og Port 2 beslutninger
    const triggers: SubsidiaerTrigger[] = [];

    // Port 1: Preklusjon-trigger (kun §33.4 - nøytralt varsel for sent)
    // Merk: §33.6.1 (spesifisert for sent) er REDUKSJON, ikke preklusjon
    if (erPrekludert) {
      triggers.push('preklusjon_noytralt');
    }

    // Port 2: Ingen hindring trigger
    if (!harHindring) {
      triggers.push('ingen_hindring');
    }

    // Combine auto-generated begrunnelse with user's additional comments
    const samletBegrunnelse = combineBegrunnelse(autoBegrunnelse, data.tilleggs_begrunnelse);

    mutation.mutate({
      eventType: 'respons_frist',
      data: {
        frist_krav_id: fristKravId,

        // Port 1: Preklusjon
        noytralt_varsel_ok: data.noytralt_varsel_ok,
        spesifisert_krav_ok: data.spesifisert_krav_ok,
        etterlysning_svar_ok: data.etterlysning_svar_ok,
        send_etterlysning: data.send_etterlysning,
        frist_for_spesifisering: data.frist_for_spesifisering,

        // Port 2: Vilkår
        vilkar_oppfylt: data.vilkar_oppfylt,
        begrunnelse_vilkar: data.begrunnelse_vilkar,

        // Port 3: Beregning
        godkjent_dager: godkjentDager,
        ny_sluttdato: data.ny_sluttdato,

        // Port 4: Oppsummering - combined auto + user begrunnelse
        begrunnelse: samletBegrunnelse,
        auto_begrunnelse: autoBegrunnelse,
        tilleggs_begrunnelse: data.tilleggs_begrunnelse,

        // Automatisk beregnet - prinsipalt
        beregnings_resultat: prinsipaltResultat,
        krevd_dager: effektivKrevdDager,

        // Subsidiært standpunkt (nye felt)
        subsidiaer_triggers: triggers.length > 0 ? triggers : undefined,
        subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
        subsidiaer_godkjent_dager: visSubsidiaertResultat ? godkjentDager : undefined,
        subsidiaer_begrunnelse: visSubsidiaertResultat ? samletBegrunnelse : undefined,
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

  // ========== UPDATE MODE: Change detection ==========
  // Detect if any changes were made from previous response
  const harEndringer = useMemo(() => {
    if (!isUpdateMode || !lastResponseEvent || !fristTilstand) return false;

    // Compare current form values with previous state
    return (
      formValues.noytralt_varsel_ok !== fristTilstand.noytralt_varsel_ok ||
      formValues.spesifisert_krav_ok !== fristTilstand.spesifisert_krav_ok ||
      formValues.etterlysning_svar_ok !== fristTilstand.etterlysning_svar_ok ||
      formValues.vilkar_oppfylt !== fristTilstand.vilkar_oppfylt ||
      formValues.godkjent_dager !== lastResponseEvent.godkjent_dager
    );
  }, [isUpdateMode, lastResponseEvent, fristTilstand, formValues]);

  // Detect if changes are to TE's disadvantage
  const erEndringTilUgunst = useMemo(() => {
    if (!isUpdateMode || !lastResponseEvent || !fristTilstand) return false;

    // Preklusjon changed from OK to not OK = to disadvantage
    if (fristTilstand.noytralt_varsel_ok === true && formValues.noytralt_varsel_ok === false) return true;
    if (fristTilstand.spesifisert_krav_ok === true && formValues.spesifisert_krav_ok === false) return true;

    // Vilkår changed from OK to not OK = to disadvantage
    if (fristTilstand.vilkar_oppfylt === true && formValues.vilkar_oppfylt === false) return true;

    // Godkjent dager reduced = to disadvantage
    if (lastResponseEvent.godkjent_dager !== undefined &&
        formValues.godkjent_dager !== undefined &&
        formValues.godkjent_dager < lastResponseEvent.godkjent_dager) return true;

    return false;
  }, [isUpdateMode, lastResponseEvent, fristTilstand, formValues]);

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={isUpdateMode ? "Oppdater svar på fristkrav" : "Svar på fristkrav"}
      size="lg"
    >
      <div className="space-y-6">
        {/* Scroll target marker */}
        <div ref={topRef} />
        {/* Step Indicator (ikke for begrunnelse_utsatt) */}
        {!erBegrunnelseUtsatt && <StepIndicator currentStep={currentPort} steps={steps} />}

        {/* §33.7 BH preclusion warning */}
        {bhPreklusjonsrisiko && (
          <>
            <VarslingsregelInline hjemmel="§33.7" />
            <Alert variant="danger" title="Svarplikt (§33.7)" className="mt-2">
              Du har brukt <strong>{dagerSidenKrav} dager</strong> på å svare. Du skal svare
              &ldquo;uten ugrunnet opphold&rdquo;. Passivitet medfører at du taper innsigelser mot
              kravet!
            </Alert>
          </>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          onKeyDown={(e) => {
            // Prevent Enter from submitting form while navigating through wizard steps
            if (e.key === 'Enter' && currentPort < totalPorts) {
              e.preventDefault();
            }
          }}
          className="space-y-6"
        >
          {/* ================================================================
              SPESIALHÅNDTERING: BEGRUNNELSE FOR UTSETTELSE (§33.6.2 bokstav b)
              TE har begrunnet hvorfor beregning ikke er mulig - forenklet visning
              ================================================================ */}
          {erBegrunnelseUtsatt && (
            <div className="space-y-6">
              <Alert variant="info" title="Begrunnelse for utsettelse (§33.6.2 b)">
                <p>
                  Entreprenøren har begrunnet hvorfor han ikke har grunnlag for å beregne
                  fristforlengelsen. I henhold til §33.6.2 femte ledd gjelder vanlige
                  §33.6.1-regler videre.
                </p>
                <p className="mt-2">
                  Entreprenøren må sende spesifisert krav «uten ugrunnet opphold» når
                  beregningsgrunnlaget foreligger. Du kan sende ny etterlysning senere hvis
                  du mener grunnlaget burde foreligge.
                </p>
              </Alert>

              <SectionContainer title="Entreprenørens begrunnelse">
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <p className="text-sm text-pkt-text-body whitespace-pre-wrap">
                    {fristEvent?.begrunnelse || fristTilstand?.begrunnelse || 'Ingen begrunnelse oppgitt'}
                  </p>
                </div>
              </SectionContainer>

              <SectionContainer title="Din kommentar (valgfritt)">
                <FormField
                  helpText="Legg til eventuelle kommentarer eller merknader til begrunnelsen"
                >
                  <Textarea
                    {...register('tilleggs_begrunnelse')}
                    rows={3}
                    fullWidth
                    placeholder="F.eks. notater om når du forventer spesifisert krav..."
                  />
                </FormField>
              </SectionContainer>

              {/* Action buttons for begrunnelse_utsatt */}
              <div className="flex justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
                <Button variant="secondary" onClick={() => onOpenChange(false)}>
                  Lukk
                </Button>
                <Button type="submit" variant="primary">
                  Bekreft mottak
                </Button>
              </div>
            </div>
          )}

          {/* ================================================================
              STEG 1: OVERSIKT (normal flyt - ikke for begrunnelse_utsatt)
              Shows claim summary and explains what will be evaluated
              ================================================================ */}
          {!erBegrunnelseUtsatt && currentStepType === 'oversikt' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Oversikt</h3>

              {/* Kravsammendrag */}
              <SectionContainer title="Fristkrav fra entreprenør">
                <DataList align="right">
                  <DataListItem label="Krevd forlengelse" mono>
                    {erNoytraltUtenDager ? (
                      <Badge variant="warning">Ikke spesifisert</Badge>
                    ) : (
                      <>{effektivKrevdDager} dager</>
                    )}
                  </DataListItem>

                  {fristEvent?.ny_sluttfrist && (
                    <DataListItem label="Ønsket ny sluttdato" mono>
                      {fristEvent.ny_sluttfrist}
                    </DataListItem>
                  )}

                  {varselType && (
                    <DataListItem label="Type varsel">
                      <Badge variant="default">
                        {varselType === 'noytralt' && 'Foreløpig varsel (§33.4)'}
                        {varselType === 'spesifisert' && 'Spesifisert krav (§33.6)'}
                        {varselType === 'begrunnelse_utsatt' && 'Begrunnelse for utsettelse (§33.6.2 b)'}
                      </Badge>
                    </DataListItem>
                  )}
                </DataList>
              </SectionContainer>

              {/* Subsidiær behandling info */}
              {erGrunnlagSubsidiaer && (
                <Alert variant="warning" title="Subsidiær behandling">
                  Du har avvist ansvarsgrunnlaget. Dine vurderinger i dette skjemaet gjelder derfor{' '}
                  <strong>subsidiært</strong> - det vil si for det tilfellet at du ikke får medhold i
                  avvisningen.
                </Alert>
              )}

              {/* Veiviser */}
              <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                <h4 className="font-medium text-sm mb-3">Hva du skal vurdere</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3">
                    <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 2</span>
                    <div>
                      <span className="font-medium">Preklusjon</span>
                      <span className="text-pkt-text-body-subtle">
                        {' '}
                        — Ble kravet varslet i tide? (§33.4/§33.6)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 3</span>
                    <div>
                      <span className="font-medium">Årsakssammenheng</span>
                      <span className="text-pkt-text-body-subtle">
                        {' '}
                        — Forårsaket forholdet faktisk forsinkelse? (§33.1)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 4</span>
                    <div>
                      <span className="font-medium">Beregning</span>
                      <span className="text-pkt-text-body-subtle">
                        {' '}
                        — Hvor mange kalenderdager? (§33.5)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 5</span>
                    <div>
                      <span className="font-medium">Oppsummering</span>
                      <span className="text-pkt-text-body-subtle"> — Se resultat og send svar</span>
                    </div>
                  </div>
                </div>

                {/* Etterlysning-info for foreløpig varsel */}
                {varselType === 'noytralt' && (
                  <div className="mt-4 pt-3 border-t border-pkt-border-subtle text-sm text-pkt-text-body-subtle">
                    <strong>Merk:</strong> Ved foreløpig varsel kan du etterspørre et spesifisert krav
                    (§33.6.2). Hvis entreprenøren ikke svarer i tide, tapes kravet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              STEG 2: PREKLUSJON (§33.4, §33.6)
              ================================================================ */}
          {!erBegrunnelseUtsatt && currentStepType === 'preklusjon' && (
            <SectionContainer
              title="Preklusjon (§33.4, §33.6)"
              description="Vurder om entreprenøren har varslet i tide. Hvis ikke, kan kravet avvises pga preklusjon."
            >
              {/* Varslingsregel info - viser relevant regel basert på varseltype */}
              {varselType === 'noytralt' && (
                <div className="mb-4">
                  <VarslingsregelInline hjemmel="§33.4" />
                </div>
              )}
              {varselType === 'spesifisert' && !erSvarPaEtterlysning && (
                <div className="mb-4">
                  <VarslingsregelInline hjemmel={harTidligereNoytraltVarselITide ? '§33.6.1' : '§33.4'} />
                </div>
              )}
              {erSvarPaEtterlysning && (
                <div className="mb-4">
                  <VarslingsregelInline hjemmel="§33.6.2" />
                </div>
              )}

              {/* Show varsel info */}
              {varselType && (() => {
                const varselInfo = varselType === 'noytralt'
                  ? (fristEvent?.noytralt_varsel || fristTilstand?.noytralt_varsel)
                  : (fristEvent?.spesifisert_varsel || fristTilstand?.spesifisert_varsel);
                const varselDato = varselInfo?.dato_sendt;
                const varselMetode = varselInfo?.metode;
                const datoOppdaget = fristEvent?.dato_oppdaget;
                const dagerMellom = datoOppdaget && varselDato
                  ? differenceInDays(parseISO(varselDato), parseISO(datoOppdaget))
                  : null;

                // Vurdering: over 14 dager er kritisk, over 7 dager er sen
                const erKritisk = dagerMellom !== null && dagerMellom > 14;
                const erSen = dagerMellom !== null && dagerMellom > 7 && dagerMellom <= 14;

                return (
                  <>
                    {/* Fremtredende dager-beregning */}
                    {datoOppdaget && varselDato && dagerMellom !== null && (
                      <div className={`flex items-center gap-3 p-3 mb-4 rounded-none border ${
                        erKritisk
                          ? 'bg-pkt-bg-danger-subtle border-pkt-border-danger'
                          : erSen
                            ? 'bg-pkt-bg-warning-subtle border-pkt-border-warning'
                            : 'bg-pkt-surface-subtle border-pkt-border-subtle'
                      }`}>
                        <span className="text-sm text-pkt-text-body">
                          Forholdet oppstod{' '}
                          <span className="font-medium">
                            {format(parseISO(datoOppdaget), 'd. MMMM yyyy', { locale: nb })}
                          </span>
                          {' '}→ varslet{' '}
                          <span className="font-medium">
                            {format(parseISO(varselDato), 'd. MMMM yyyy', { locale: nb })}
                          </span>
                          {' '}={' '}
                          <span className={`font-mono font-medium ${
                            erKritisk ? 'text-pkt-text-danger' :
                            erSen ? 'text-pkt-text-warning' :
                            'text-pkt-text-success'
                          }`}>
                            {dagerMellom} {dagerMellom === 1 ? 'dag' : 'dager'}
                          </span>
                        </span>
                      </div>
                    )}
                    <DataList variant="grid" className="mb-4">
                      {datoOppdaget && !varselDato && (
                        <DataListItem label="Dato oppdaget">
                          {format(parseISO(datoOppdaget), 'd. MMM yyyy', { locale: nb })}
                        </DataListItem>
                      )}
                      {varselDato && !datoOppdaget && (
                        <DataListItem label="Dato varslet">
                          {format(parseISO(varselDato), 'd. MMM yyyy', { locale: nb })}
                        </DataListItem>
                      )}
                      {varselMetode && varselMetode.length > 0 && (
                        <DataListItem label="Varslingsmetode">
                          {formatVarselMetode(varselMetode)}
                        </DataListItem>
                      )}
                    </DataList>
                  </>
                );
              })()}

              {/* Foreløpig varsel */}
              {varselType === 'noytralt' && (
                <>
                  <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                    <FormField
                      label="Foreløpig varsel sendt i tide? (§33.4)"
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
                              label="Nei - prekludert (varslet for sent)"
                            />
                          </RadioGroup>
                        )}
                      />
                    </FormField>

                    {/* §5 innsigelse - når BH påberoper for sent varsel */}
                    {formValues.noytralt_varsel_ok === false && (
                      <Alert variant="danger" title="Preklusjon etter §33.4" className="mt-3">
                        Entreprenøren varslet ikke «uten ugrunnet opphold». Du påberoper at kravet
                        er tapt. Husk at du må gjøre denne innsigelsen skriftlig «uten ugrunnet
                        opphold» etter å ha mottatt varselet, jf. §5.
                      </Alert>
                    )}
                  </div>

                  {/* Etterlysning option - only if varsel was OK */}
                  {formValues.noytralt_varsel_ok && (
                    <div className="space-y-3">
                      <Alert variant="warning" title="Etterlysning (§33.6.2)">
                        Entreprenøren har kun sendt foreløpig varsel uten antall dager. Du kan
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
                  {/* §33.6.2: Svar på etterlysning */}
                  {erSvarPaEtterlysning ? (
                    <>
                      <Alert variant="info" title="Svar på etterlysning (§33.6.2)" className="mb-4">
                        Dette kravet er et svar på din etterlysning. Du kan ikke påberope at fristen
                        i §33.6.1 er oversittet. Du kan imidlertid vurdere om svaret kom i tide iht.
                        §33.6.2 annet ledd.
                      </Alert>
                      <FormField
                        label="Kom svaret på etterlysningen i tide? (§33.6.2/§5)"
                        required
                        helpText="Entreprenøren skal svare «uten ugrunnet opphold» på etterlysningen. Hvis ikke, må du påberope dette skriftlig (§5)."
                      >
                        <Controller
                          name="etterlysning_svar_ok"
                          control={control}
                          render={({ field }) => (
                            <RadioGroup
                              value={
                                field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                              }
                              onValueChange={(val: string) => field.onChange(val === 'ja')}
                            >
                              <RadioItem value="ja" label="Ja - svaret kom i tide" />
                              <RadioItem
                                value="nei"
                                label="Nei - for sent (prekludert - kravet tapes)"
                              />
                            </RadioGroup>
                          )}
                        />
                      </FormField>
                      {/* Info om §5 innsigelse */}
                      {erEtterlysningSvarForSent && (
                        <Alert variant="danger" title="Preklusjon etter §33.6.2 tredje ledd" className="mt-3">
                          Entreprenøren svarte ikke «uten ugrunnet opphold» på etterlysningen.
                          Du påberoper nå at kravet er tapt iht. §33.6.2 tredje ledd, jf. §5.
                          Systemet vil generere en skriftlig innsigelse.
                        </Alert>
                      )}
                    </>
                  ) : (
                    <>
                      <FormField
                        label={
                          harTidligereNoytraltVarselITide
                            ? "Spesifisert krav sendt i tide? (§33.6.1)"
                            : "Spesifisert krav sendt i tide? (§33.4)"
                        }
                        required
                        helpText={
                          harTidligereNoytraltVarselITide
                            ? "Entreprenøren skal 'uten ugrunnet opphold' angi og begrunne antall dager når han har grunnlag."
                            : "Entreprenøren har ikke sendt foreløpig varsel først. Det spesifiserte kravet fungerer dermed som varsel (§33.4)."
                        }
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
                                label={
                                  harTidligereNoytraltVarselITide
                                    ? "Nei - for sent (reduseres til det byggherren måtte forstå)"
                                    : "Nei - for sent (prekludert - kravet tapes)"
                                }
                              />
                            </RadioGroup>
                          )}
                        />
                      </FormField>
                      {/* Info om §33.6.1 reduksjon - kun når nøytralt varsel var i tide */}
                      {erRedusert_33_6_1 && (
                        <Alert variant="warning" title="Reduksjon etter §33.6.1" className="mt-3">
                          Entreprenøren har kun krav på den fristforlengelsen byggherren måtte forstå
                          at han hadde krav på. I beregningssteget angir du hvor mange dager du mener
                          var forståelig ut fra omstendighetene. Husk at du må gjøre denne innsigelsen
                          skriftlig «uten ugrunnet opphold» etter å ha mottatt kravet, jf. §5.
                        </Alert>
                      )}
                      {/* Info om §33.4 preklusjon - kun når direkte spesifisert uten tidligere nøytralt */}
                      {!harTidligereNoytraltVarselITide && formValues.spesifisert_krav_ok === false && (
                        <Alert variant="danger" title="Preklusjon etter §33.4" className="mt-3">
                          Entreprenøren sendte spesifisert krav direkte uten å ha sendt foreløpig
                          varsel i tide først. Det spesifiserte kravet fungerer dermed som varsel,
                          og siden varselet kom for sent, er kravet prekludert. Husk at du må gjøre
                          denne innsigelsen skriftlig «uten ugrunnet opphold» etter å ha mottatt
                          kravet, jf. §5.
                        </Alert>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Fallback if varselType not set */}
              {!varselType && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <FormField
                    label="Varsel/krav sendt i tide? (§33.4/§33.6)"
                    required
                    helpText="Vurder om entreprenøren har varslet innen fristen. Konsekvensen avhenger av om det finnes tidligere foreløpig varsel."
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
                            label="Nei - for sent"
                          />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                  {/* Info avhengig av om det finnes tidligere nøytralt varsel */}
                  {formValues.spesifisert_krav_ok === false && harTidligereNoytraltVarselITide && (
                    <Alert variant="warning" title="Reduksjon etter §33.6.1" className="mt-3">
                      Entreprenøren har kun krav på den fristforlengelsen byggherren måtte forstå
                      at han hadde krav på. I beregningssteget angir du hvor mange dager du mener
                      var forståelig ut fra omstendighetene. Husk at du må gjøre denne innsigelsen
                      skriftlig «uten ugrunnet opphold» etter å ha mottatt kravet, jf. §5.
                    </Alert>
                  )}
                  {formValues.spesifisert_krav_ok === false && !harTidligereNoytraltVarselITide && (
                    <Alert variant="danger" title="Preklusjon etter §33.4" className="mt-3">
                      Uten tidligere foreløpig varsel i tide, fungerer kravet som varsel. Siden det
                      kom for sent, er kravet prekludert. Husk at du må gjøre denne innsigelsen
                      skriftlig «uten ugrunnet opphold» etter å ha mottatt kravet, jf. §5.
                    </Alert>
                  )}
                </div>
              )}

              {sendEtterlysning && (
                <Alert variant="info" title="Avventer svar">
                  Du sender etterlysning til entreprenøren. Svaret blir{' '}
                  <strong>&ldquo;Avventer spesifikasjon&rdquo;</strong>. Entreprenøren må svare med spesifisert
                  krav.
                </Alert>
              )}
            </SectionContainer>
          )}

          {/* ================================================================
              STEG 3: ÅRSAKSSAMMENHENG (§33.1) - Alltid vurderes, evt. subsidiært
              ================================================================ */}
          {!erBegrunnelseUtsatt && currentStepType === 'vilkar' && (
            <SectionContainer
              title="Årsakssammenheng (§33.1)"
              description="Vurder om forholdet faktisk forårsaket forsinkelse i fremdriften."
            >
              {/* Subsidiary banner */}
              {port2ErSubsidiaer && (
                <Alert variant="warning" title="Subsidiær vurdering" className="mb-4">
                  Du har prinsipalt avvist kravet pga. preklusjon. Ta nå{' '}
                  <strong>subsidiært</strong> stilling til om forholdet medførte
                  fremdriftshindring.
                </Alert>
              )}

              {/* Etterlysning blocks further evaluation */}
              {sendEtterlysning && (
                <Alert variant="info" title="Etterlysning sendes" className="mb-4">
                  Du etterspør spesifisert krav fra entreprenøren. Du kan likevel ta stilling til vilkårene nedenfor.
                </Alert>
              )}

              <Alert variant="info" title="Vilkår for fristforlengelse (§33.1, §33.5)" className="mb-4">
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

              {/* Begrunnelse vilkår - viktig at dette fylles ut */}
              <FormField
                label="Begrunnelse for vurderingen"
                helpText="Beskriv hvorfor forholdet medførte/ikke medførte forsinkelse"
              >
                <Textarea
                  {...register('begrunnelse_vilkar')}
                  rows={3}
                  fullWidth
                />
              </FormField>
            </SectionContainer>
          )}

          {/* ================================================================
              STEG 4: BEREGNING (§33.5) - Alltid vurderes, evt. subsidiært
              ================================================================ */}
          {!erBegrunnelseUtsatt && currentStepType === 'beregning' && (
            <SectionContainer
              title="Beregning av fristforlengelse (§33.5)"
              description="Vurder om kravet reflekterer reell virkning på fremdriften. Momenter: nødvendig avbrudd, årstidsforskyvning, samlet virkning av tidligere forhold, og om entreprenøren har oppfylt tapsbegrensningsplikten."
            >
              {/* Etterlysning blocks evaluation */}
              {sendEtterlysning ? (
                <Alert variant="info" title="Avventer svar">
                  Du avventer spesifisert krav fra entreprenøren. Beregning gjøres senere.
                </Alert>
              ) : (
                <>
                  {/* Subsidiary banner */}
                  {port3ErSubsidiaer && (
                    <Alert variant="warning" title="Subsidiær beregning" className="mb-4">
                      {erPrekludert && !harHindring
                        ? 'Du har prinsipalt avvist kravet pga. preklusjon og mener det ikke var hindring. Ta nå subsidiært stilling til hvor mange dager entreprenøren maksimalt kan ha krav på.'
                        : erPrekludert
                          ? 'Du har prinsipalt avvist kravet pga. preklusjon. Ta nå subsidiært stilling til hvor mange dager entreprenøren maksimalt kan ha krav på.'
                          : 'Du mener det ikke var reell hindring. Ta nå subsidiært stilling til hvor mange dager entreprenøren maksimalt kan ha krav på.'}
                    </Alert>
                  )}

                  {/* §33.6.1 reduksjon påminnelse */}
                  {erRedusert_33_6_1 && !port3ErSubsidiaer && (
                    <Alert variant="warning" title="Begrenset godkjenning (§33.6.1)" className="mb-4">
                      Det spesifiserte kravet kom for sent. Du skal kun godkjenne det antall dager
                      du <strong>måtte forstå</strong> at entreprenøren hadde krav på ut fra
                      omstendighetene – ikke nødvendigvis det han har krevd.
                    </Alert>
                  )}

                  {/* Info when neutral notice without days */}
                  {erNoytraltUtenDager && (
                    <Alert variant="info" title="Antall dager ikke spesifisert">
                      Entreprenøren har ikke spesifisert antall dager i sitt nøytrale varsel.
                      Du kan ikke ta stilling til antall dager før kravet er spesifisert.
                    </Alert>
                  )}

                  {/* Hovedkrav beregning - only show input if days are specified */}
                  {!erNoytraltUtenDager && (
                    <>
                      <InlineDataList className="mb-4">
                        <InlineDataListItem label="Krevd" mono bold>
                          {effektivKrevdDager} dager
                        </InlineDataListItem>
                      </InlineDataList>

                      <FormField
                        label={
                          port3ErSubsidiaer
                            ? 'Maksimalt antall kalenderdager'
                            : 'Godkjent antall kalenderdager'
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
                    </>
                  )}

                  {/* §33.8 Forsering warning */}
                  {visForsering && avslatteDager > 0 && !port3ErSubsidiaer && (
                    <Alert variant="info" title="Forsering-risiko (§33.8)">
                      Du avslår <strong>{avslatteDager} dager</strong> som entreprenøren mener å ha krav på.
                      <ul className="list-disc pl-5 mt-2 text-sm">
                        <li>
                          Dersom avslaget er uberettiget, kan entreprenøren velge å anse det som et{' '}
                          <strong>pålegg om forsering</strong>.
                        </li>
                        <li>
                          <strong>Begrensning:</strong> Entreprenøren har ikke denne valgretten dersom
                          forseringskostnaden overstiger <strong>dagmulkten + 30%</strong>.
                        </li>
                      </ul>
                    </Alert>
                  )}
                </>
              )}
            </SectionContainer>
          )}

          {/* ================================================================
              STEG 5: OPPSUMMERING
              ================================================================ */}
          {!erBegrunnelseUtsatt && currentStepType === 'oppsummering' && (
            <SectionContainer title="Oppsummering">
              {/* Sammendrag av valg */}
              <div className="space-y-4">
                {/* Varslingsvurdering (§33.4 / §33.6.1 / §33.6.2) */}
                <StatusSummary title="Varsling">
                  {sendEtterlysning ? (
                    <>
                      <Badge variant="warning">Etterlysning sendt</Badge>
                      <span className="text-sm">Avventer spesifisert krav fra entreprenøren</span>
                    </>
                  ) : erEtterlysningSvarForSent ? (
                    <>
                      <Badge variant="danger">Prekludert (§33.6.2/§5)</Badge>
                      <span className="text-sm">Svar på etterlysning kom for sent - kravet tapes</span>
                    </>
                  ) : erPrekludert ? (
                    <>
                      <Badge variant="danger">Prekludert (§33.4)</Badge>
                      <span className="text-sm">
                        {varselType === 'noytralt'
                          ? 'Foreløpig varsel kom for sent - kravet tapes'
                          : 'Spesifisert krav (uten forutgående varsel) kom for sent - kravet tapes'}
                      </span>
                    </>
                  ) : erRedusert_33_6_1 ? (
                    <>
                      <Badge variant="warning">Redusert (§33.6.1)</Badge>
                      <span className="text-sm">Spesifisert krav kom for sent - reduseres til det byggherren måtte forstå</span>
                    </>
                  ) : erSvarPaEtterlysning ? (
                    <>
                      <Badge variant="success">Svar på etterlysning (i tide)</Badge>
                      <span className="text-sm">Svaret kom i tide - §33.6.1 kan ikke påberopes</span>
                    </>
                  ) : (
                    <>
                      <Badge variant="success">OK</Badge>
                      <span className="text-sm">Varslet i tide</span>
                    </>
                  )}
                </StatusSummary>

                {/* Årsakssammenheng */}
                <StatusSummary title={`Årsakssammenheng${port2ErSubsidiaer ? ' (subsidiært)' : ''}`}>
                  {harHindring ? (
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
                      <span className="text-sm">Entreprenøren hadde slakk / ikke reell forsinkelse</span>
                    </>
                  )}
                </StatusSummary>

                {/* Beregning */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-3">
                    Beregning {port3ErSubsidiaer && '(subsidiært)'}
                  </h5>
                  {sendEtterlysning ? (
                    <span className="text-sm text-pkt-text-body-subtle">(Avventer)</span>
                  ) : erNoytraltUtenDager ? (
                    <div className="text-sm text-pkt-text-body-subtle italic">
                      Antall dager er ikke spesifisert i kravet. Beregning gjøres når entreprenøren sender spesifisert krav.
                    </div>
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
                        <div className="p-3 border border-pkt-border-default rounded-none bg-pkt-surface-subtle">
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
                  {!sendEtterlysning && prinsipaltResultat !== 'avslatt' && effektivKrevdDager > 0 && (
                    <div className="mt-2 text-lg font-mono">
                      Godkjent: {godkjentDager} av {effektivKrevdDager} dager
                    </div>
                  )}
                  {!sendEtterlysning && prinsipaltResultat !== 'avslatt' && erNoytraltUtenDager && (
                    <div className="mt-2 text-sm italic opacity-80">
                      Grunnlag og vilkår er vurdert. Antall dager kan først vurderes når entreprenøren spesifiserer kravet.
                    </div>
                  )}
                </div>

                {/* §33.8 Forsering warning in summary */}
                {visForsering && avslatteDager > 0 && !sendEtterlysning && (
                  <Alert variant="warning" title="§33.8 Forsering-risiko">
                    Du avslår <strong>{avslatteDager} dager</strong>. Hvis avslaget er uberettiget,
                    kan entreprenøren velge å anse det som et pålegg om forsering.
                  </Alert>
                )}

                {/* UPDATE MODE: Warnings and change summary */}
                {isUpdateMode && (
                  <>
                    {/* Warning: Changes to TE's disadvantage */}
                    {erEndringTilUgunst && (
                      <Alert variant="warning" title="Endring til entreprenørens ugunst">
                        Du er i ferd med å endre standpunkt til entreprenørens ugunst.
                        Sørg for at du har dokumentasjon som støtter endringen.
                      </Alert>
                    )}

                    {/* Change summary */}
                    {harEndringer && (
                      <SectionContainer title="Endringer fra forrige svar" variant="subtle">
                        <DataList variant="grid">
                          {formValues.noytralt_varsel_ok !== fristTilstand?.noytralt_varsel_ok && (
                            <DataListItem label="Foreløpig varsel">
                              {formValues.noytralt_varsel_ok ? 'I tide' : 'Prekludert'}
                              <span className="text-pkt-text-body-subtle"> ← {fristTilstand?.noytralt_varsel_ok ? 'I tide' : 'Prekludert'}</span>
                            </DataListItem>
                          )}
                          {formValues.spesifisert_krav_ok !== fristTilstand?.spesifisert_krav_ok && (
                            <DataListItem label="Spesifisert krav">
                              {formValues.spesifisert_krav_ok
                                ? 'I tide'
                                : harTidligereNoytraltVarselITide ? 'Redusert' : 'Prekludert'}
                              <span className="text-pkt-text-body-subtle">
                                {' ← '}
                                {fristTilstand?.spesifisert_krav_ok
                                  ? 'I tide'
                                  : harTidligereNoytraltVarselITide ? 'Redusert' : 'Prekludert'}
                              </span>
                            </DataListItem>
                          )}
                          {formValues.etterlysning_svar_ok !== fristTilstand?.etterlysning_svar_ok && (
                            <DataListItem label="Svar på etterlysning">
                              {formValues.etterlysning_svar_ok ? 'I tide' : 'Prekludert (§33.6.2/§5)'}
                              <span className="text-pkt-text-body-subtle">
                                {' ← '}
                                {fristTilstand?.etterlysning_svar_ok ? 'I tide' : 'Prekludert (§33.6.2/§5)'}
                              </span>
                            </DataListItem>
                          )}
                          {formValues.vilkar_oppfylt !== fristTilstand?.vilkar_oppfylt && (
                            <DataListItem label="Vilkår">
                              {formValues.vilkar_oppfylt ? 'Oppfylt' : 'Ikke oppfylt'}
                              <span className="text-pkt-text-body-subtle"> ← {fristTilstand?.vilkar_oppfylt ? 'Oppfylt' : 'Ikke oppfylt'}</span>
                            </DataListItem>
                          )}
                          {formValues.godkjent_dager !== lastResponseEvent?.godkjent_dager && (
                            <DataListItem label="Godkjente dager" mono>
                              {formValues.godkjent_dager}
                              <span className="text-pkt-text-body-subtle"> ← {lastResponseEvent?.godkjent_dager}</span>
                            </DataListItem>
                          )}
                        </DataList>
                      </SectionContainer>
                    )}
                  </>
                )}

                {/* Auto-generert begrunnelse (ikke redigerbar) */}
                <SectionContainer
                  title="Generert begrunnelse"
                  variant="subtle"
                  description="Automatisk generert basert på valgene dine. Kan ikke redigeres direkte."
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {autoBegrunnelse || 'Fyll ut valgene ovenfor for å generere begrunnelse.'}
                  </p>
                </SectionContainer>

                {/* Tilleggsbegrunnelse (valgfri) */}
                <FormField
                  label="Tilleggskommentar"
                  optional
                  error={errors.tilleggs_begrunnelse?.message}
                  helpText="Legg til egne kommentarer, f.eks. detaljer om beregning eller referanser til dokumenter"
                >
                  <Textarea
                    {...register('tilleggs_begrunnelse')}
                    rows={3}
                    fullWidth
                    error={!!errors.tilleggs_begrunnelse}
                                      />
                </FormField>
              </div>
            </SectionContainer>
          )}

          {/* Error Message */}
          {mutation.isError && (
            <Alert variant="danger" title="Feil ved innsending">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </Alert>
          )}

          {/* Navigation Actions (ikke for begrunnelse_utsatt - har egen knapper) */}
          {!erBegrunnelseUtsatt && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-4 pt-6 border-t-2 border-pkt-border-subtle">
            <div>
              {currentPort > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goToPrevPort();
                  }}
                  className="w-full sm:w-auto"
                >
                  ← Forrige
                </Button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Avbryt
              </Button>

              {currentPort < totalPorts ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goToNextPort();
                  }}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  Neste →
                </Button>
              ) : approvalEnabled ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={isSubmitting}
                  className="w-full sm:w-auto order-1 sm:order-2"
                  onClick={handleSubmit(handleSaveDraft)}
                >
                  Lagre utkast
                </Button>
              ) : (
                <Button type="submit" variant="primary" loading={isSubmitting} className="w-full sm:w-auto order-1 sm:order-2">
                  {isUpdateMode ? 'Lagre Endringer' : 'Send svar'}
                </Button>
              )}
            </div>
          </div>
          )}
        </form>

        <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
      </div>
    </Modal>
  );
}
