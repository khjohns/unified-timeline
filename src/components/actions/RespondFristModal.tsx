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
import { KontraktsregelInline } from '../shared';

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
  /** Varsel om fristforlengelse info (§33.4) */
  frist_varsel?: VarselInfoData;
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
  /** Type of varsel TE sent - determines which checks to show */
  varselType?: 'varsel' | 'spesifisert' | 'begrunnelse_utsatt';
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
  frist_varsel_ok: z.boolean().optional(),  // §33.4: Varsel om fristforlengelse rettidig?
  spesifisert_krav_ok: z.boolean().optional(),
  foresporsel_svar_ok: z.boolean().optional(), // §33.6.2/§5: Svar på forespørsel i tide?
  send_foresporsel: z.boolean().optional(),
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
  sendForesporsel: boolean;
  harHindring: boolean;
  krevdDager: number;
  godkjentDager: number;
}): string {
  // 1. Etterlysning sendes - avslått (BH avslår midlertidig, venter på spesifisert krav)
  if (data.sendForesporsel) {
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
  // In this case, BH should typically send forespørsel to request specification
  const erVarselUtenDager = varselType === 'varsel' && effektivKrevdDager === 0;

  // §33.6.2 bokstav b: TE har begrunnet hvorfor beregning ikke er mulig
  // I dette tilfellet gjelder §33.6.1 videre - BH kan bare bekrefte mottak
  const erBegrunnelseUtsatt = varselType === 'begrunnelse_utsatt';

  // ========== UPDATE MODE: Compute default values ==========
  const computedDefaultValues = useMemo((): Partial<RespondFristFormData> => {
    if (isUpdateMode && lastResponseEvent && fristTilstand) {
      // UPDATE MODE: Pre-fill from previous response
      return {
        frist_varsel_ok: fristTilstand.frist_varsel_ok ?? true,
        spesifisert_krav_ok: fristTilstand.spesifisert_krav_ok ?? true,
        foresporsel_svar_ok: fristTilstand.foresporsel_svar_ok ?? true,
        vilkar_oppfylt: fristTilstand.vilkar_oppfylt ?? true,
        send_foresporsel: false,
        godkjent_dager: lastResponseEvent.godkjent_dager ?? effektivKrevdDager,
      };
    }
    // RESPOND MODE: Default values
    return {
      frist_varsel_ok: true,
      spesifisert_krav_ok: true,
      foresporsel_svar_ok: true,
      vilkar_oppfylt: true,
      send_foresporsel: false,
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
      frist_varsel_ok: true,
      spesifisert_krav_ok: true,
      foresporsel_svar_ok: true,
      vilkar_oppfylt: true,
      send_foresporsel: false,
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
  const harTidligereVarselITide = useMemo(() => {
    // Tidligere vurdert og akseptert av BH
    if (fristTilstand?.frist_varsel_ok === true) {
      return true;
    }
    // Finnes nøytralt varsel (fra event eller tilstand) og BH har ikke avslått det
    const harFristVarsel = !!(fristEvent?.frist_varsel || fristTilstand?.frist_varsel);
    if (harFristVarsel && formValues.frist_varsel_ok !== false) {
      return true;
    }
    return false;
  }, [fristTilstand?.frist_varsel_ok, fristTilstand?.frist_varsel, fristEvent?.frist_varsel, formValues.frist_varsel_ok]);

  // §33.6.2 fjerde ledd: Hvis kravet er svar på forespørsel, kan byggherren
  // IKKE påberope at fristen i §33.6.1 er oversittet
  const erSvarPaForesporsel = useMemo(() => {
    return fristTilstand?.har_bh_foresporsel === true && varselType === 'spesifisert';
  }, [fristTilstand?.har_bh_foresporsel, varselType]);

  // §33.6.2 tredje ledd + §5: Sen respons på forespørsel = PREKLUSJON
  // BH må påberope dette via §5 ("skriftlig uten ugrunnet opphold")
  const erForesporselSvarForSent = useMemo(() => {
    return erSvarPaForesporsel && formValues.foresporsel_svar_ok === false;
  }, [erSvarPaForesporsel, formValues.foresporsel_svar_ok]);

  // Calculate preclusion status from Port 1
  // §33.4: Varsel for sent = FULL PREKLUSJON (kravet tapes)
  // §33.6.2 tredje ledd: Sen respons på forespørsel = PREKLUSJON
  const erPrekludert = useMemo(() => {
    // §33.6.2 tredje ledd + §5: Sen respons på forespørsel = PREKLUSJON
    if (erForesporselSvarForSent) {
      return true;
    }
    // §33.4: Nøytralt varsel for sent = PREKLUSJON
    if (varselType === 'varsel') {
      return formValues.frist_varsel_ok === false;
    }
    // §33.4: Spesifisert krav direkte (uten tidligere nøytralt varsel i tide)
    // Vi bruker frist_varsel_ok for §33.4-vurderingen også her
    if (varselType === 'spesifisert' && !harTidligereVarselITide) {
      return formValues.frist_varsel_ok === false;
    }
    return false;
  }, [formValues.frist_varsel_ok, varselType, harTidligereVarselITide, erForesporselSvarForSent]);

  // §33.6.1: Sen spesifisering gir reduksjon (ikke preklusjon)
  // Entreprenøren har kun krav på det byggherren "måtte forstå"
  // Gjelder når §33.4 er oppfylt men §33.6.1 er brutt
  // UNNTAK: Gjelder IKKE når kravet er svar på forespørsel (§33.6.2 fjerde ledd)
  const erRedusert_33_6_1 = useMemo(() => {
    // §33.6.2 fjerde ledd: Byggherren kan ikke påberope §33.6.1 ved svar på forespørsel
    if (erSvarPaForesporsel) {
      return false;
    }
    // Case 1: TE sendte nøytralt varsel i tide, men spesifisert krav for sent
    if (varselType === 'spesifisert' && harTidligereVarselITide) {
      return formValues.spesifisert_krav_ok === false;
    }
    // Case 2: TE sendte kun spesifisert krav - §33.4 OK men §33.6.1 for sent
    if (varselType === 'spesifisert' && !harTidligereVarselITide) {
      return formValues.frist_varsel_ok === true && formValues.spesifisert_krav_ok === false;
    }
    return false;
  }, [formValues.frist_varsel_ok, formValues.spesifisert_krav_ok, varselType, erSvarPaForesporsel, harTidligereVarselITide]);

  // Reset send_foresporsel when frist_varsel_ok changes to false
  // (forespørsel is only valid when varsel was on time)
  useEffect(() => {
    if (formValues.frist_varsel_ok === false && formValues.send_foresporsel === true) {
      setValue('send_foresporsel', false);
    }
  }, [formValues.frist_varsel_ok, formValues.send_foresporsel, setValue]);

  // Check if sending forespørsel (blocks further evaluation)
  const sendForesporsel = formValues.send_foresporsel === true;

  // Check hindrance status from Port 2
  const harHindring = formValues.vilkar_oppfylt === true;

  // Determine subsidiary treatment levels
  // Inkluderer grunnlagsavslag som trigger for subsidiær behandling
  const port2ErSubsidiaer = (erPrekludert || erGrunnlagSubsidiaer) && !sendForesporsel;
  const port3ErSubsidiaer = (erPrekludert || !harHindring || erGrunnlagSubsidiaer) && !sendForesporsel;

  // Get godkjent dager (respecting subsidiary logic)
  const godkjentDager = formValues.godkjent_dager ?? 0;

  // Calculate principal result
  const prinsipaltResultat = useMemo(
    () =>
      beregnPrinsipaltResultat({
        erPrekludert,
        sendForesporsel,
        harHindring,
        krevdDager: effektivKrevdDager,
        godkjentDager,
      }),
    [erPrekludert, sendForesporsel, harHindring, effektivKrevdDager, godkjentDager]
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
      fristVarselOk: formValues.frist_varsel_ok,
      spesifisertKravOk: formValues.spesifisert_krav_ok,
      foresporselSvarOk: formValues.foresporsel_svar_ok,
      sendForesporsel: sendForesporsel,

      // Vilkår
      vilkarOppfylt: harHindring,

      // Beregning
      godkjentDager: godkjentDager,

      // Computed
      erPrekludert: erPrekludert,
      erForesporselSvarForSent: erForesporselSvarForSent,
      erRedusert_33_6_1: erRedusert_33_6_1,
      harTidligereVarselITide: harTidligereVarselITide,
      erGrunnlagSubsidiaer: erGrunnlagSubsidiaer,
      prinsipaltResultat: prinsipaltResultat,
      subsidiaertResultat: subsidiaertResultat,
      visSubsidiaertResultat: visSubsidiaertResultat,
    };

    return generateFristResponseBegrunnelse(input);
  }, [
    varselType,
    effektivKrevdDager,
    formValues.frist_varsel_ok,
    formValues.spesifisert_krav_ok,
    formValues.foresporsel_svar_ok,
    sendForesporsel,
    harHindring,
    godkjentDager,
    erPrekludert,
    erForesporselSvarForSent,
    erRedusert_33_6_1,
    harTidligereVarselITide,
    erGrunnlagSubsidiaer,
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
        'frist_varsel_ok',
        'spesifisert_krav_ok',
        'send_foresporsel',
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
        if (varselType === 'varsel') {
          eventData.frist_varsel_ok = true;
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

    // Grunnlag avslått - hele fristkravet behandles subsidiært
    if (erGrunnlagSubsidiaer) {
      triggers.push('grunnlag_avslatt');
    }

    // Port 1: Preklusjon-trigger (kun §33.4 - nøytralt varsel for sent)
    // Merk: §33.6.1 (spesifisert for sent) er REDUKSJON, ikke preklusjon
    if (erPrekludert) {
      triggers.push('preklusjon_varsel');
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
        frist_varsel_ok: data.frist_varsel_ok,
        spesifisert_krav_ok: data.spesifisert_krav_ok,
        foresporsel_svar_ok: data.foresporsel_svar_ok,
        send_foresporsel: data.send_foresporsel,
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
      formValues.frist_varsel_ok !== fristTilstand.frist_varsel_ok ||
      formValues.spesifisert_krav_ok !== fristTilstand.spesifisert_krav_ok ||
      formValues.foresporsel_svar_ok !== fristTilstand.foresporsel_svar_ok ||
      formValues.vilkar_oppfylt !== fristTilstand.vilkar_oppfylt ||
      formValues.godkjent_dager !== lastResponseEvent.godkjent_dager
    );
  }, [isUpdateMode, lastResponseEvent, fristTilstand, formValues]);

  // Detect if changes are to TE's disadvantage
  const erEndringTilUgunst = useMemo(() => {
    if (!isUpdateMode || !lastResponseEvent || !fristTilstand) return false;

    // Preklusjon changed from OK to not OK = to disadvantage
    if (fristTilstand.frist_varsel_ok === true && formValues.frist_varsel_ok === false) return true;
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
            <KontraktsregelInline hjemmel="§33.7" />
            <Alert variant="danger" title="Svarplikt (§33.7)" className="mt-2">
              Du har brukt <strong>{dagerSidenKrav} dager</strong> på å svare. Du skal svare
              &ldquo;uten ugrunnet opphold&rdquo;. Passivitet medfører at du taper innsigelser mot
              kravet!
            </Alert>
          </>
        )}

        {/* UPDATE MODE: Compact display of current response */}
        {isUpdateMode && lastResponseEvent && (
          <div className="flex items-center gap-2 text-sm py-2 px-3 bg-pkt-surface-subtle border-l-2 border-pkt-border-subtle">
            <span className="text-pkt-text-body-subtle">Ditt nåværende svar:</span>
            <Badge
              variant={
                lastResponseEvent.resultat === 'godkjent' ? 'success' :
                lastResponseEvent.resultat === 'avslatt' ? 'danger' : 'warning'
              }
              size="sm"
            >
              {lastResponseEvent.resultat === 'godkjent' ? 'Godkjent' :
               lastResponseEvent.resultat === 'avslatt' ? 'Avslått' : 'Delvis godkjent'}
            </Badge>
            {lastResponseEvent.godkjent_dager !== undefined && (
              <span className="font-mono">{lastResponseEvent.godkjent_dager} dager</span>
            )}
          </div>
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
                  beregningsgrunnlaget foreligger. Du kan sende ny forespørsel senere hvis
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

              {/* Kompakt kravlinje - detaljer tilgjengelig i EventDetailModal */}
              <div className="flex items-center gap-2 text-sm py-2 px-3 bg-pkt-surface-subtle border-l-2 border-pkt-border-subtle">
                <span className="text-pkt-text-body-subtle">Krav:</span>
                {erVarselUtenDager ? (
                  <Badge variant="warning" size="sm">Ikke spesifisert</Badge>
                ) : (
                  <span className="font-mono font-medium text-pkt-text-body">{effektivKrevdDager} dager</span>
                )}
                {varselType && (
                  <span className="text-pkt-text-body-subtle">
                    ({varselType === 'varsel' ? '§33.4 varsel' : '§33.6 spesifisert'})
                  </span>
                )}
              </div>

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
                {varselType === 'varsel' && (
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
              {varselType === 'varsel' && (
                <div className="mb-4">
                  <KontraktsregelInline hjemmel="§33.4" />
                </div>
              )}
              {varselType === 'spesifisert' && !erSvarPaForesporsel && harTidligereVarselITide && (
                <div className="mb-4">
                  <KontraktsregelInline hjemmel="§33.6.1" />
                </div>
              )}
              {varselType === 'spesifisert' && !erSvarPaForesporsel && !harTidligereVarselITide && (
                <div className="mb-4 space-y-2">
                  <KontraktsregelInline hjemmel="§33.4" />
                  <KontraktsregelInline hjemmel="§33.6.1" />
                </div>
              )}
              {erSvarPaForesporsel && (
                <div className="mb-4">
                  <KontraktsregelInline hjemmel="§33.6.2" />
                </div>
              )}

              {/* Show varsel info */}
              {varselType && (() => {
                const varselInfo = varselType === 'varsel'
                  ? (fristEvent?.frist_varsel || fristTilstand?.frist_varsel)
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
              {varselType === 'varsel' && (
                <>
                  <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                    <FormField
                      label="Foreløpig varsel sendt i tide? (§33.4)"
                      required
                      helpText="Entreprenøren skal varsle 'uten ugrunnet opphold' når han blir klar over at det kan oppstå forsinkelse."
                    >
                      <Controller
                        name="frist_varsel_ok"
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
                    {formValues.frist_varsel_ok === false && (
                      <Alert variant="danger" title="Preklusjon etter §33.4" className="mt-3">
                        Entreprenøren varslet ikke «uten ugrunnet opphold». Du påberoper at kravet
                        er tapt. Husk at du må gjøre denne innsigelsen skriftlig «uten ugrunnet
                        opphold» etter å ha mottatt varselet, jf. §5.
                      </Alert>
                    )}
                  </div>

                  {/* Etterlysning option - only if varsel was OK */}
                  {formValues.frist_varsel_ok && (
                    <div className="space-y-3">
                      <Alert variant="warning" title="Etterlysning (§33.6.2)">
                        Entreprenøren har kun sendt foreløpig varsel uten antall dager. Du kan
                        etterspørre et spesifisert krav. Hvis entreprenøren ikke svarer «uten ugrunnet
                        opphold», tapes kravet.
                      </Alert>
                      <FormField label="Vil du sende forespørsel?">
                        <Controller
                          name="send_foresporsel"
                          control={control}
                          render={({ field }) => (
                            <RadioGroup
                              value={
                                field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                              }
                              onValueChange={(val: string) => field.onChange(val === 'ja')}
                            >
                              <RadioItem value="ja" label="Ja - send forespørsel nå" />
                              <RadioItem value="nei" label="Nei - fortsett behandling" />
                            </RadioGroup>
                          )}
                        />
                      </FormField>

                      {formValues.send_foresporsel && (
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
                  {/* §33.6.2: Svar på forespørsel */}
                  {erSvarPaForesporsel ? (
                    <>
                      <Alert variant="info" title="Svar på forespørsel (§33.6.2)" className="mb-4">
                        Dette kravet er et svar på din forespørsel. Du kan ikke påberope at fristen
                        i §33.6.1 er oversittet. Du kan imidlertid vurdere om svaret kom i tide iht.
                        §33.6.2 annet ledd.
                      </Alert>
                      <FormField
                        label="Kom svaret på forespørselen i tide? (§33.6.2/§5)"
                        required
                        helpText="Entreprenøren skal svare «uten ugrunnet opphold» på forespørselen. Hvis ikke, må du påberope dette skriftlig (§5)."
                      >
                        <Controller
                          name="foresporsel_svar_ok"
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
                      {erForesporselSvarForSent && (
                        <Alert variant="danger" title="Preklusjon etter §33.6.2 tredje ledd" className="mt-3">
                          Entreprenøren svarte ikke «uten ugrunnet opphold» på forespørselen.
                          Du påberoper nå at kravet er tapt iht. §33.6.2 tredje ledd, jf. §5.
                          Systemet vil generere en skriftlig innsigelse.
                        </Alert>
                      )}
                    </>
                  ) : harTidligereVarselITide ? (
                    /* Case: TE sendte nøytralt varsel i tide først - kun §33.6.1 vurdering */
                    <>
                      <FormField
                        label="Spesifisert krav sendt i tide? (§33.6.1)"
                        required
                        helpText="Entreprenøren skal «uten ugrunnet opphold» angi og begrunne antall dager når han har grunnlag for å beregne omfanget."
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
                                label="Nei - for sent (reduseres til det byggherren måtte forstå)"
                              />
                            </RadioGroup>
                          )}
                        />
                      </FormField>
                      {/* Info om §33.6.1 reduksjon */}
                      {erRedusert_33_6_1 && (
                        <Alert variant="warning" title="Reduksjon etter §33.6.1" className="mt-3">
                          Entreprenøren har kun krav på den fristforlengelsen byggherren måtte forstå
                          at han hadde krav på. I beregningssteget angir du hvor mange dager du mener
                          var forståelig ut fra omstendighetene. Husk at du må gjøre denne innsigelsen
                          skriftlig «uten ugrunnet opphold» etter å ha mottatt kravet, jf. §5.
                        </Alert>
                      )}
                    </>
                  ) : (
                    /* Case: TE sendte kun spesifisert krav (ingen tidligere nøytralt varsel)
                       Må vurdere BÅDE §33.4 OG §33.6.1 */
                    <div className="space-y-4">
                      <Alert variant="info" title="Dobbelt vurdering kreves" className="mb-2">
                        Entreprenøren sendte spesifisert krav direkte uten forutgående varsel.
                        Du må vurdere både (1) om det ble varslet i tide etter §33.4, og
                        (2) om det spesifiserte kravet kom i tide etter §33.6.1.
                      </Alert>

                      {/* 1. §33.4: Spesifisert krav som varsel */}
                      <div className="p-3 border border-pkt-border-subtle rounded-none">
                        <FormField
                          label="1. Sendt i tide som varsel? (§33.4)"
                          required
                          helpText="Vurder om kravet ble sendt «uten ugrunnet opphold» etter at forholdet oppstod. Skjæringstidspunktet er dato oppdaget."
                        >
                          <Controller
                            name="frist_varsel_ok"
                            control={control}
                            render={({ field }) => (
                              <RadioGroup
                                value={
                                  field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                                }
                                onValueChange={(val: string) => field.onChange(val === 'ja')}
                              >
                                <RadioItem value="ja" label="Ja - varslet i tide (§33.4 oppfylt)" />
                                <RadioItem
                                  value="nei"
                                  label="Nei - for sent (prekludert - kravet tapes)"
                                />
                              </RadioGroup>
                            )}
                          />
                        </FormField>
                        {formValues.frist_varsel_ok === false && (
                          <Alert variant="danger" title="Preklusjon etter §33.4" className="mt-3">
                            Kravet ble ikke varslet «uten ugrunnet opphold» etter at forholdet oppstod.
                            Kravet er prekludert. Husk at du må gjøre denne innsigelsen skriftlig
                            «uten ugrunnet opphold» etter å ha mottatt kravet, jf. §5.
                          </Alert>
                        )}
                      </div>

                      {/* 2. §33.6.1: Spesifisert krav - kun hvis §33.4 OK */}
                      {formValues.frist_varsel_ok === true && (
                        <div className="p-3 border border-pkt-border-subtle rounded-none">
                          <FormField
                            label="2. Spesifisert i tide? (§33.6.1)"
                            required
                            helpText="Vurder om kravet ble spesifisert «uten ugrunnet opphold» etter at entreprenøren hadde grunnlag for å beregne omfanget."
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
                                  <RadioItem value="ja" label="Ja - spesifisert i tide (§33.6.1 oppfylt)" />
                                  <RadioItem
                                    value="nei"
                                    label="Nei - for sent (reduseres til det byggherren måtte forstå)"
                                  />
                                </RadioGroup>
                              )}
                            />
                          </FormField>
                          {formValues.spesifisert_krav_ok === false && (
                            <Alert variant="warning" title="Reduksjon etter §33.6.1" className="mt-3">
                              Varselet (§33.4) kom i tide, men det spesifiserte kravet kom for sent.
                              Entreprenøren har kun krav på den fristforlengelsen du måtte forstå.
                              Husk at du må gjøre denne innsigelsen skriftlig «uten ugrunnet opphold», jf. §5.
                            </Alert>
                          )}
                        </div>
                      )}
                    </div>
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
                  {formValues.spesifisert_krav_ok === false && harTidligereVarselITide && (
                    <Alert variant="warning" title="Reduksjon etter §33.6.1" className="mt-3">
                      Entreprenøren har kun krav på den fristforlengelsen byggherren måtte forstå
                      at han hadde krav på. I beregningssteget angir du hvor mange dager du mener
                      var forståelig ut fra omstendighetene. Husk at du må gjøre denne innsigelsen
                      skriftlig «uten ugrunnet opphold» etter å ha mottatt kravet, jf. §5.
                    </Alert>
                  )}
                  {formValues.spesifisert_krav_ok === false && !harTidligereVarselITide && (
                    <Alert variant="danger" title="Preklusjon etter §33.4" className="mt-3">
                      Uten tidligere foreløpig varsel i tide, fungerer kravet som varsel. Siden det
                      kom for sent, er kravet prekludert. Husk at du må gjøre denne innsigelsen
                      skriftlig «uten ugrunnet opphold» etter å ha mottatt kravet, jf. §5.
                    </Alert>
                  )}
                </div>
              )}

              {sendForesporsel && (
                <Alert variant="info" title="Avventer svar">
                  Du sender forespørsel til entreprenøren. Svaret blir{' '}
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
              {sendForesporsel && (
                <Alert variant="info" title="Etterlysning sendes" className="mb-4">
                  Du etterspør spesifisert krav fra entreprenøren. Du kan likevel ta stilling til vilkårene nedenfor.
                </Alert>
              )}

              {/* TODO: Legg til hovedkategori prop for å støtte §33.3 (force majeure) */}
              <KontraktsregelInline hjemmel="§33.1" />

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
              {sendForesporsel ? (
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
                  {erVarselUtenDager && (
                    <Alert variant="info" title="Antall dager ikke spesifisert">
                      Entreprenøren har ikke spesifisert antall dager i sitt nøytrale varsel.
                      Du kan ikke ta stilling til antall dager før kravet er spesifisert.
                    </Alert>
                  )}

                  {/* Hovedkrav beregning - only show input if days are specified */}
                  {!erVarselUtenDager && (
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
                {/* Grunnlagsstatus - vises kun hvis avslått */}
                {erGrunnlagSubsidiaer && (
                  <StatusSummary title="Ansvarsgrunnlag">
                    <Badge variant="danger">Avslått</Badge>
                    <span className="text-sm">Fristkrav behandles subsidiært</span>
                  </StatusSummary>
                )}

                {/* Varslingsvurdering (§33.4 / §33.6.1 / §33.6.2) */}
                <StatusSummary title="Varsling">
                  {sendForesporsel ? (
                    <>
                      <Badge variant="warning">Etterlysning sendt</Badge>
                      <span className="text-sm">Avventer spesifisert krav fra entreprenøren</span>
                    </>
                  ) : erForesporselSvarForSent ? (
                    <>
                      <Badge variant="danger">Prekludert (§33.6.2/§5)</Badge>
                      <span className="text-sm">Svar på forespørsel kom for sent - kravet tapes</span>
                    </>
                  ) : erPrekludert ? (
                    <>
                      <Badge variant="danger">Prekludert (§33.4)</Badge>
                      <span className="text-sm">
                        {varselType === 'varsel'
                          ? 'Foreløpig varsel kom for sent - kravet tapes'
                          : 'Spesifisert krav (uten forutgående varsel) kom for sent - kravet tapes'}
                      </span>
                    </>
                  ) : erRedusert_33_6_1 ? (
                    <>
                      <Badge variant="warning">Redusert (§33.6.1)</Badge>
                      <span className="text-sm">Spesifisert krav kom for sent - reduseres til det byggherren måtte forstå</span>
                    </>
                  ) : erSvarPaForesporsel ? (
                    <>
                      <Badge variant="success">Svar på forespørsel (i tide)</Badge>
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
                  {sendForesporsel ? (
                    <span className="text-sm text-pkt-text-body-subtle">(Avventer)</span>
                  ) : erVarselUtenDager ? (
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
                  {!sendForesporsel && prinsipaltResultat !== 'avslatt' && effektivKrevdDager > 0 && (
                    <div className="mt-2 text-lg font-mono">
                      Godkjent: {godkjentDager} av {effektivKrevdDager} dager
                    </div>
                  )}
                  {!sendForesporsel && prinsipaltResultat !== 'avslatt' && erVarselUtenDager && (
                    <div className="mt-2 text-sm italic opacity-80">
                      Grunnlag og vilkår er vurdert. Antall dager kan først vurderes når entreprenøren spesifiserer kravet.
                    </div>
                  )}
                </div>

                {/* §33.8 Forsering warning in summary */}
                {visForsering && avslatteDager > 0 && !sendForesporsel && (
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
                          {formValues.frist_varsel_ok !== fristTilstand?.frist_varsel_ok && (
                            <DataListItem label="Foreløpig varsel">
                              {formValues.frist_varsel_ok ? 'I tide' : 'Prekludert'}
                              <span className="text-pkt-text-body-subtle"> ← {fristTilstand?.frist_varsel_ok ? 'I tide' : 'Prekludert'}</span>
                            </DataListItem>
                          )}
                          {formValues.spesifisert_krav_ok !== fristTilstand?.spesifisert_krav_ok && (
                            <DataListItem label="Spesifisert krav">
                              {formValues.spesifisert_krav_ok
                                ? 'I tide'
                                : harTidligereVarselITide ? 'Redusert' : 'Prekludert'}
                              <span className="text-pkt-text-body-subtle">
                                {' ← '}
                                {fristTilstand?.spesifisert_krav_ok
                                  ? 'I tide'
                                  : harTidligereVarselITide ? 'Redusert' : 'Prekludert'}
                              </span>
                            </DataListItem>
                          )}
                          {formValues.foresporsel_svar_ok !== fristTilstand?.foresporsel_svar_ok && (
                            <DataListItem label="Svar på forespørsel">
                              {formValues.foresporsel_svar_ok ? 'I tide' : 'Prekludert (§33.6.2/§5)'}
                              <span className="text-pkt-text-body-subtle">
                                {' ← '}
                                {fristTilstand?.foresporsel_svar_ok ? 'I tide' : 'Prekludert (§33.6.2/§5)'}
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
