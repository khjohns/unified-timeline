/**
 * RespondVederlagModal Component
 *
 * Action modal for BH (client) to respond to a vederlag (compensation) claim.
 * Uses a 4-port wizard model based on NS 8407 requirements.
 *
 * WIZARD STRUCTURE:
 * - Port 1: Særskilte krav - Preklusjon (§34.1.3) - Only for rigg/drift/produktivitet
 * - Port 2: Beregningsmetode - Method acceptance, EP-justering, tilbakeholdelse
 * - Port 3: Beløpsvurdering - Amount evaluation (subsidiært for precluded særskilte krav)
 * - Port 4: Oppsummering - Summary with principal AND subsidiary results
 *
 * KEY RULES (from Datasett_varslingsregler_8407.py):
 * - §34.1.3: Særskilte krav (rigg/drift/produktivitet) requires separate notice - PRECLUSION if late
 * - §34.3.3: BH must respond to EP-justering "uten ugrunnet opphold" - PASSIVE ACCEPTANCE if silent
 * - §30.2: BH can withhold payment for regningsarbeid without kostnadsoverslag
 * - §34.2.1: Rejection of fastpris falls back to regningsarbeid (§34.4)
 * - §30.3.2: BH has 14 days to protest timelister - PASSIVE ACCEPTANCE if silent
 *
 * IMPORTANT: There is NO general preclusion for the main vederlag claim from BH side.
 * Preclusion of main claim is handled in Grunnlag track (§34.1.2).
 *
 * IMPORTANT: BH must ALWAYS be able to take subsidiary position on særskilte krav.
 * Even if precluded, BH should evaluate the amount subsidiarily.
 *
 * UPDATED (2025-12-09):
 * - Complete rewrite with 4-port wizard
 * - Subsidiary evaluation always available for precluded særskilte krav
 * - Principal AND subsidiary results shown in summary
 * - Correct NS 8407 rule implementation
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  Alert,
  AttachmentUpload,
  Badge,
  Button,
  CurrencyInput,
  ExpandableText,
  FormField,
  InlineDataList,
  InlineDataListItem,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  StatusSummary,
  StepIndicator,
  Textarea,
  useToast,
} from '../primitives';
import type { AttachmentFile } from '../../types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import {
  VEDERLAGSMETODER_OPTIONS,
  getVederlagsmetodeLabel,
  VEDERLAGSMETODE_DESCRIPTIONS,
  type VederlagsMetode,
} from '../../constants';
import { differenceInDays } from 'date-fns';
import type { SubsidiaerTrigger } from '../../types/timeline';
import {
  generateVederlagResponseBegrunnelse,
  type VederlagResponseInput,
} from '../../utils/begrunnelseGenerator';
import { getResultatLabel } from '../../utils/formatters';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// Vurdering options for beløp
type BelopVurdering = 'godkjent' | 'delvis' | 'avslatt';

// Særskilt krav item structure (§34.1.3)
interface SaerskiltKravItem {
  belop?: number;
  dato_klar_over?: string;
}

// Vederlag event info for context display and conditional logic
interface VederlagEventInfo {
  metode?: VederlagsMetode;
  belop_direkte?: number;
  kostnads_overslag?: number;
  begrunnelse?: string;
  krever_justert_ep?: boolean;
  varslet_for_oppstart?: boolean;
  saerskilt_krav?: {
    rigg_drift?: SaerskiltKravItem;
    produktivitet?: SaerskiltKravItem;
  };
  /** Date when the claim was received (for BH response time tracking) */
  dato_krav_mottatt?: string;
  /** Date when TE discovered the issue (for §34.1.2 preclusion check) */
  dato_oppdaget?: string;
}

/** Previous response data for update mode */
interface LastResponseEvent {
  event_id: string;
  resultat: string;
  godkjent_belop?: number;
  respondedToVersion?: number;
  // Previous evaluations for pre-filling
  hovedkrav_varslet_i_tide?: boolean;
  rigg_varslet_i_tide?: boolean;
  produktivitet_varslet_i_tide?: boolean;
  aksepterer_metode?: boolean;
  oensket_metode?: VederlagsMetode;
  ep_justering_varslet_i_tide?: boolean;
  ep_justering_akseptert?: boolean;
  hold_tilbake?: boolean;
  hovedkrav_vurdering?: BelopVurdering;
  hovedkrav_godkjent_belop?: number;
  rigg_vurdering?: BelopVurdering;
  rigg_godkjent_belop?: number;
  produktivitet_vurdering?: BelopVurdering;
  produktivitet_godkjent_belop?: number;
}

interface RespondVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the vederlag claim event being responded to */
  vederlagKravId: string;
  /** Optional vederlag event data for context display and conditional logic */
  vederlagEvent?: VederlagEventInfo;
  /** Status of the grunnlag response (for subsidiary treatment) */
  grunnlagStatus?: 'godkjent' | 'avslatt' | 'delvis_godkjent';
  /** Hovedkategori - påvirker om §34.1.2 preklusjon gjelder (kun SVIKT/ANDRE) */
  hovedkategori?: 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE';
  /** §32.2: Har BH påberopt at grunnlagsvarselet kom for sent? (kun ENDRING)
   * Når true: Forholdet kan kvalifisere som SVIKT/ANDRE, og §34.1.2 gjelder subsidiært */
  grunnlagVarsletForSent?: boolean;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
  /** When true, show "Lagre utkast" instead of "Send svar" for approval workflow */
  approvalEnabled?: boolean;
  /** Callback when saving as draft (for approval workflow). Receives the form data. */
  onSaveDraft?: (draftData: {
    belop: number;
    resultat: 'godkjent' | 'delvis_godkjent' | 'avslatt';
    begrunnelse?: string;
    formData: RespondVederlagFormData;
  }) => void;
  /** UPDATE MODE: Previous response event to update. If provided, modal operates in update mode. */
  lastResponseEvent?: LastResponseEvent;
  /** UPDATE MODE: Current vederlag state (required when lastResponseEvent is provided) */
  vederlagTilstand?: import('../../types/timeline').VederlagTilstand;
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const respondVederlagSchema = z.object({
  // Port 1: Hovedkrav preklusjon (§34.1.2)
  // - SVIKT/ANDRE: Prinsipalt
  // - ENDRING + §32.2 påberopt: Subsidiært
  hovedkrav_varslet_i_tide: z.boolean().optional(),

  // Port 1: Særskilte krav preklusjon (kun §34.1.3)
  rigg_varslet_i_tide: z.boolean().optional(),
  produktivitet_varslet_i_tide: z.boolean().optional(),

  // Port 2: Beregningsmetode
  aksepterer_metode: z.boolean(),
  oensket_metode: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD']).optional(),
  ep_justering_varslet_i_tide: z.boolean().optional(),
  ep_justering_akseptert: z.boolean().optional(),
  hold_tilbake: z.boolean().optional(),

  // Port 3: Beløpsvurdering - Hovedkrav
  hovedkrav_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']),
  hovedkrav_godkjent_belop: z.number().min(0).optional(),

  // Port 3: Beløpsvurdering - Særskilte (kun hvis ikke prekludert)
  rigg_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']).optional(),
  rigg_godkjent_belop: z.number().min(0).optional(),
  produktivitet_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']).optional(),
  produktivitet_godkjent_belop: z.number().min(0).optional(),

  // Port 4: Oppsummering
  begrunnelse: z.string().optional(),
  vedlegg: z.array(z.any()).optional(), // AttachmentFile[]
});

type RespondVederlagFormData = z.infer<typeof respondVederlagSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate principal result based on wizard inputs (respects preclusion)
 * Following NS 8407 logic from Datasett_varslingsregler_8407.py
 */
function beregnPrinsipaltResultat(
  data: Partial<RespondVederlagFormData>,
  computed: {
    totalKrevdInklPrekludert: number;
    totalGodkjent: number;
    harMetodeendring: boolean;
    holdTilbake: boolean;
  }
): string {
  // 1. Tilbakeholdelse (§30.2) has priority
  if (computed.holdTilbake) {
    return 'hold_tilbake';
  }

  // 2. Calculate approval percentage (relative to total claimed, not just eligible)
  const godkjentProsent =
    computed.totalKrevdInklPrekludert > 0 ? computed.totalGodkjent / computed.totalKrevdInklPrekludert : 0;

  // 3. Total rejection - if nothing is approved principally (regardless of reason)
  if (computed.totalGodkjent === 0) {
    return 'avslatt';
  }

  // 4. Full approval
  if (godkjentProsent >= 0.99 && !computed.harMetodeendring) {
    return 'godkjent';
  }

  // 5. Method change or partial approval
  return 'delvis_godkjent';
}

/**
 * Calculate subsidiary result (ignores preclusion, evaluates all amounts)
 * Used when særskilte krav are precluded but BH still evaluates subsidiarily
 */
function beregnSubsidiaertResultat(
  data: Partial<RespondVederlagFormData>,
  computed: {
    totalKrevdInklPrekludert: number;
    totalGodkjentInklPrekludert: number;
    harMetodeendring: boolean;
  }
): string {
  const godkjentProsent =
    computed.totalKrevdInklPrekludert > 0
      ? computed.totalGodkjentInklPrekludert / computed.totalKrevdInklPrekludert
      : 0;

  // Total rejection
  if (godkjentProsent === 0 && data.hovedkrav_vurdering === 'avslatt') {
    return 'avslatt';
  }

  // Full approval
  if (godkjentProsent >= 0.99 && !computed.harMetodeendring) {
    return 'godkjent';
  }

  // Method change or partial approval
  return 'delvis_godkjent';
}


// ============================================================================
// COMPONENT
// ============================================================================

export function RespondVederlagModal({
  open,
  onOpenChange,
  sakId,
  vederlagKravId,
  vederlagEvent,
  grunnlagStatus,
  hovedkategori,
  grunnlagVarsletForSent,
  onCatendaWarning,
  approvalEnabled = false,
  onSaveDraft,
  lastResponseEvent,
  vederlagTilstand,
}: RespondVederlagModalProps) {
  // UPDATE MODE: Detect if we're updating an existing response
  const isUpdateMode = !!lastResponseEvent;

  const [currentPort, setCurrentPort] = useState(1);
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Scroll to top of modal content
  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Determine if särskilda krav exists with amount > 0 (affects which ports to show)
  const harRiggKrav = (vederlagEvent?.saerskilt_krav?.rigg_drift?.belop ?? 0) > 0;
  const harProduktivitetKrav = (vederlagEvent?.saerskilt_krav?.produktivitet?.belop ?? 0) > 0;
  const harSaerskiltKrav = harRiggKrav || harProduktivitetKrav;

  // §34.1.2 preklusjon gjelder for:
  // - SVIKT/ANDRE: Alltid (prinsipalt)
  // - ENDRING/IRREG + §32.2 påberopt: Prinsipalt, fordi BH hevder forholdet er SVIKT/ANDRE
  //   (Når BH påberoper §32.2 sier BH: "Dette er IKKE en ENDRING" → ergo SVIKT/ANDRE)
  const har34_1_2_Preklusjon =
    hovedkategori === 'SVIKT' ||
    hovedkategori === 'ANDRE' ||
    (hovedkategori === 'ENDRING' && grunnlagVarsletForSent === true);

  // Vises §34.1.2 fordi BH påberoper §32.2? (for kontekstforklaring i UI)
  const erFra32_2_Paaberopelse = hovedkategori === 'ENDRING' && grunnlagVarsletForSent === true;

  // Calculate total ports (5 with preklusjon-steg, 4 without)
  // Preklusjon-steg vises når: harSaerskiltKrav ELLER har34_1_2_Preklusjon
  const harPreklusjonsSteg = harSaerskiltKrav || har34_1_2_Preklusjon;
  const startPort = 1;
  const totalPorts = harPreklusjonsSteg ? 5 : 4;

  // Compute defaultValues based on mode
  const computedDefaultValues = useMemo((): Partial<RespondVederlagFormData> => {
    if (isUpdateMode && lastResponseEvent) {
      // UPDATE MODE: Pre-fill from previous response
      return {
        hovedkrav_varslet_i_tide: lastResponseEvent.hovedkrav_varslet_i_tide ?? true,
        aksepterer_metode: lastResponseEvent.aksepterer_metode ?? true,
        oensket_metode: lastResponseEvent.oensket_metode,
        hovedkrav_vurdering: lastResponseEvent.hovedkrav_vurdering ?? 'godkjent',
        hovedkrav_godkjent_belop: lastResponseEvent.hovedkrav_godkjent_belop,
        rigg_varslet_i_tide: lastResponseEvent.rigg_varslet_i_tide ?? true,
        produktivitet_varslet_i_tide: lastResponseEvent.produktivitet_varslet_i_tide ?? true,
        rigg_vurdering: lastResponseEvent.rigg_vurdering,
        rigg_godkjent_belop: lastResponseEvent.rigg_godkjent_belop,
        produktivitet_vurdering: lastResponseEvent.produktivitet_vurdering,
        produktivitet_godkjent_belop: lastResponseEvent.produktivitet_godkjent_belop,
        ep_justering_akseptert: lastResponseEvent.ep_justering_akseptert,
        hold_tilbake: lastResponseEvent.hold_tilbake,
        begrunnelse: '',
        vedlegg: [],
      };
    }
    // NEW RESPONSE MODE: Default values
    return {
      hovedkrav_varslet_i_tide: true,
      aksepterer_metode: true,
      hovedkrav_vurdering: 'godkjent',
      rigg_varslet_i_tide: true,
      produktivitet_varslet_i_tide: true,
      begrunnelse: '',
      vedlegg: [],
    };
  }, [isUpdateMode, lastResponseEvent]);

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
    setError,
  } = useForm<RespondVederlagFormData>({
    resolver: zodResolver(respondVederlagSchema),
    mode: 'onTouched', // Only show errors after field is touched
    defaultValues: computedDefaultValues,
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'respons_vederlag', formData, isDirty);

  // Fresh values for reset and Tilbakestill (same as computedDefaultValues)
  const freshValues = computedDefaultValues;

  // Reset form with latest values when modal opens
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;

      // Check for backup and merge with fresh values (backup takes precedence, but fills gaps)
      if (hasBackup && !isDirty) {
        const backup = getBackup();
        if (backup) {
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

  // Handle reset to fresh values (Tilbakestill button) - only for update mode
  const handleReset = () => {
    clearBackup();
    reset(freshValues);
    setCurrentPort(startPort);
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
      setCurrentPort(startPort);
      onOpenChange(false);
      toast.success(
        isUpdateMode ? 'Svar oppdatert' : 'Svar sendt',
        isUpdateMode ? 'Ditt oppdaterte svar på vederlagskravet er registrert.' : 'Ditt svar på vederlagskravet er registrert.'
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
      // Check for magic link token issues
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
        return;
      }
      // Check for Catenda token expiry (from ApiError.data)
      const apiError = error as Error & { data?: { error?: string } };
      if (apiError.data?.error === 'CATENDA_TOKEN_EXPIRED') {
        setShowTokenExpired(true);
      }
    },
  });

  // Watch all form values for conditional rendering and calculations
  const formValues = watch();

  // Derived state
  // NB: Variabelen heter erSubsidiaer men sjekker kun om grunnlag er avslått.
  // Den faktiske er_subsidiaert_vederlag beregnes i backend (krever også at vederlag er godkjent).
  // Her brukes den som prosess-flagg for å vise "subsidiær behandling"-veiledning i UI.
  // Se: backend/models/sak_state.py:931-956 for fullstendig beregning.
  const erSubsidiaer = grunnlagStatus === 'avslatt';
  const kanHoldeTilbake =
    vederlagEvent?.metode === 'REGNINGSARBEID' && !vederlagEvent?.kostnads_overslag;
  const maSvarePaJustering =
    vederlagEvent?.metode === 'ENHETSPRISER' && vederlagEvent?.krever_justert_ep;
  const erFastprisTilbud = vederlagEvent?.metode === 'FASTPRIS_TILBUD';

  // Get amounts for display
  const metodeLabel = vederlagEvent?.metode
    ? getVederlagsmetodeLabel(vederlagEvent.metode)
    : undefined;

  // Method-specific help text for BH when deciding on beregningsmetode
  const metodeHelpText = useMemo(() => {
    switch (vederlagEvent?.metode) {
      case 'ENHETSPRISER':
        return 'Oppgjør basert på kontraktens enhetspriser (§34.3).';
      case 'REGNINGSARBEID':
        return 'Oppgjør basert på dokumenterte kostnader + påslag (§34.4/§30). Du kan kreve kostnadsoverslag og holde tilbake betaling (§30.2).';
      case 'FASTPRIS_TILBUD':
        return 'Spesifisert tilbud fra entreprenør (§34.2.1). Ved avslag faller oppgjøret tilbake på enhetspriser (§34.3) eller regningsarbeid (§34.4).';
      default:
        return undefined;
    }
  }, [vederlagEvent?.metode]);

  const hovedkravBelop =
    vederlagEvent?.metode === 'REGNINGSARBEID'
      ? vederlagEvent?.kostnads_overslag
      : vederlagEvent?.belop_direkte;
  const riggBelop = vederlagEvent?.saerskilt_krav?.rigg_drift?.belop;
  const produktivitetBelop = vederlagEvent?.saerskilt_krav?.produktivitet?.belop;

  // Calculate BH response time for warning
  // BH skal svare "uten ugrunnet opphold" - varsler etter 5 dager for å gi margin
  const dagerSidenKrav = vederlagEvent?.dato_krav_mottatt
    ? differenceInDays(new Date(), new Date(vederlagEvent.dato_krav_mottatt))
    : 0;
  const bhSvarpliktAdvarsel = dagerSidenKrav > 5;

  // Check if hovedkrav is precluded (§34.1.2 - kun SVIKT/ANDRE)
  const hovedkravPrekludert = har34_1_2_Preklusjon && formValues.hovedkrav_varslet_i_tide === false;

  // Check if særskilte krav are precluded
  const riggPrekludert = harRiggKrav && formValues.rigg_varslet_i_tide === false;
  const produktivitetPrekludert =
    harProduktivitetKrav && formValues.produktivitet_varslet_i_tide === false;

  // Calculate totals for automatic result (both principal and subsidiary)
  const computed = useMemo(() => {
    // Principal totals (respects preclusion)
    const totalKrevd =
      (hovedkravBelop || 0) +
      (harRiggKrav && !riggPrekludert ? riggBelop || 0 : 0) +
      (harProduktivitetKrav && !produktivitetPrekludert ? produktivitetBelop || 0 : 0);

    // Total krevd including precluded (for subsidiary calculation)
    const totalKrevdInklPrekludert =
      (hovedkravBelop || 0) +
      (harRiggKrav ? riggBelop || 0 : 0) +
      (harProduktivitetKrav ? produktivitetBelop || 0 : 0);

    // Principal godkjent (respects preclusion)
    let totalGodkjent = 0;

    // Hovedkrav (kun hvis ikke prekludert per §34.1.2 - prinsipalt)
    if (!hovedkravPrekludert) {
      if (formValues.hovedkrav_vurdering === 'godkjent') {
        totalGodkjent += hovedkravBelop || 0;
      } else if (formValues.hovedkrav_vurdering === 'delvis') {
        totalGodkjent += formValues.hovedkrav_godkjent_belop || 0;
      }
    }

    // Rigg (kun hvis ikke prekludert - prinsipalt)
    if (harRiggKrav && !riggPrekludert) {
      if (formValues.rigg_vurdering === 'godkjent') {
        totalGodkjent += riggBelop || 0;
      } else if (formValues.rigg_vurdering === 'delvis') {
        totalGodkjent += formValues.rigg_godkjent_belop || 0;
      }
    }

    // Produktivitet (kun hvis ikke prekludert - prinsipalt)
    if (harProduktivitetKrav && !produktivitetPrekludert) {
      if (formValues.produktivitet_vurdering === 'godkjent') {
        totalGodkjent += produktivitetBelop || 0;
      } else if (formValues.produktivitet_vurdering === 'delvis') {
        totalGodkjent += formValues.produktivitet_godkjent_belop || 0;
      }
    }

    // Subsidiary godkjent (includes precluded krav evaluations)
    let totalGodkjentInklPrekludert = totalGodkjent;

    // Add precluded hovedkrav (subsidiært - §34.1.2)
    if (hovedkravPrekludert) {
      if (formValues.hovedkrav_vurdering === 'godkjent') {
        totalGodkjentInklPrekludert += hovedkravBelop || 0;
      } else if (formValues.hovedkrav_vurdering === 'delvis') {
        totalGodkjentInklPrekludert += formValues.hovedkrav_godkjent_belop || 0;
      }
    }

    // Add precluded rigg (subsidiært)
    if (harRiggKrav && riggPrekludert) {
      if (formValues.rigg_vurdering === 'godkjent') {
        totalGodkjentInklPrekludert += riggBelop || 0;
      } else if (formValues.rigg_vurdering === 'delvis') {
        totalGodkjentInklPrekludert += formValues.rigg_godkjent_belop || 0;
      }
    }

    // Add precluded produktivitet (subsidiært)
    if (harProduktivitetKrav && produktivitetPrekludert) {
      if (formValues.produktivitet_vurdering === 'godkjent') {
        totalGodkjentInklPrekludert += produktivitetBelop || 0;
      } else if (formValues.produktivitet_vurdering === 'delvis') {
        totalGodkjentInklPrekludert += formValues.produktivitet_godkjent_belop || 0;
      }
    }

    return {
      totalKrevd,
      totalGodkjent,
      totalKrevdInklPrekludert,
      totalGodkjentInklPrekludert,
      harMetodeendring: !formValues.aksepterer_metode,
      holdTilbake: formValues.hold_tilbake === true,
      harPrekludertKrav: hovedkravPrekludert || riggPrekludert || produktivitetPrekludert,
    };
  }, [
    formValues,
    hovedkravBelop,
    riggBelop,
    produktivitetBelop,
    harRiggKrav,
    harProduktivitetKrav,
    riggPrekludert,
    produktivitetPrekludert,
  ]);

  // Calculate automatic results (principal and subsidiary)
  const prinsipaltResultat = useMemo(
    () => beregnPrinsipaltResultat(formValues, computed),
    [formValues, computed]
  );

  const subsidiaertResultat = useMemo(
    () =>
      beregnSubsidiaertResultat(formValues, {
        totalKrevdInklPrekludert: computed.totalKrevdInklPrekludert,
        totalGodkjentInklPrekludert: computed.totalGodkjentInklPrekludert,
        harMetodeendring: computed.harMetodeendring,
      }),
    [formValues, computed]
  );

  // Show subsidiary result when there are precluded særskilte krav
  const visSubsidiaertResultat = computed.harPrekludertKrav;

  // UPDATE MODE: Detect changes that are to TE's disadvantage
  const erEndringTilUgunst = useMemo(() => {
    if (!isUpdateMode || !lastResponseEvent) return false;

    // Preklusjon endret til "for sent" = til ugunst (kun hvis kravet har disse)
    if (harRiggKrav && formValues.rigg_varslet_i_tide === false && lastResponseEvent.rigg_varslet_i_tide === true) return true;
    if (harProduktivitetKrav && formValues.produktivitet_varslet_i_tide === false && lastResponseEvent.produktivitet_varslet_i_tide === true) return true;

    // Metode avvist når tidligere akseptert = til ugunst
    if (formValues.aksepterer_metode === false && lastResponseEvent.aksepterer_metode === true) return true;

    // EP-justering avvist når tidligere akseptert = til ugunst
    if (formValues.ep_justering_akseptert === false && lastResponseEvent.ep_justering_akseptert === true) return true;

    // Beløp redusert = til ugunst
    const tidligereGodkjent = lastResponseEvent.godkjent_belop ?? 0;
    if (computed.totalGodkjent < tidligereGodkjent) return true;

    return false;
  }, [isUpdateMode, lastResponseEvent, formValues, computed.totalGodkjent, harRiggKrav, harProduktivitetKrav]);

  // UPDATE MODE: Detect if any changes were made from previous response
  const harEndringer = useMemo(() => {
    if (!isUpdateMode || !lastResponseEvent) return false;

    // Check each field for changes (only check særskilte krav fields if they exist)
    if (formValues.aksepterer_metode !== lastResponseEvent.aksepterer_metode) return true;
    if (harRiggKrav && formValues.rigg_varslet_i_tide !== lastResponseEvent.rigg_varslet_i_tide) return true;
    if (harProduktivitetKrav && formValues.produktivitet_varslet_i_tide !== lastResponseEvent.produktivitet_varslet_i_tide) return true;
    if (formValues.ep_justering_akseptert !== lastResponseEvent.ep_justering_akseptert) return true;
    if (formValues.hold_tilbake !== lastResponseEvent.hold_tilbake) return true;
    if (formValues.hovedkrav_vurdering !== lastResponseEvent.hovedkrav_vurdering) return true;
    if (formValues.hovedkrav_godkjent_belop !== lastResponseEvent.hovedkrav_godkjent_belop) return true;
    if (harRiggKrav && formValues.rigg_vurdering !== lastResponseEvent.rigg_vurdering) return true;
    if (harRiggKrav && formValues.rigg_godkjent_belop !== lastResponseEvent.rigg_godkjent_belop) return true;
    if (harProduktivitetKrav && formValues.produktivitet_vurdering !== lastResponseEvent.produktivitet_vurdering) return true;
    if (harProduktivitetKrav && formValues.produktivitet_godkjent_belop !== lastResponseEvent.produktivitet_godkjent_belop) return true;

    return false;
  }, [isUpdateMode, lastResponseEvent, formValues, harRiggKrav, harProduktivitetKrav]);

  // UPDATE MODE: Detect if claim was revised after previous response
  const kravRevidertEtterSvar = useMemo(() => {
    if (!isUpdateMode || !lastResponseEvent || !vederlagTilstand) return false;
    const currentVersion = vederlagTilstand.antall_versjoner ?? 1;
    const respondedVersion = lastResponseEvent.respondedToVersion ?? 1;
    return currentVersion > respondedVersion;
  }, [isUpdateMode, lastResponseEvent, vederlagTilstand]);

  // Generate auto-begrunnelse based on all form selections
  const autoBegrunnelse = useMemo(() => {
    const input: VederlagResponseInput = {
      // Claim context
      metode: vederlagEvent?.metode,
      hovedkravBelop: hovedkravBelop,
      riggBelop: riggBelop,
      produktivitetBelop: produktivitetBelop,
      harRiggKrav: harRiggKrav,
      harProduktivitetKrav: harProduktivitetKrav,

      // Preklusjon
      hovedkravVarsletITide: har34_1_2_Preklusjon ? formValues.hovedkrav_varslet_i_tide : undefined,
      riggVarsletITide: formValues.rigg_varslet_i_tide,
      produktivitetVarsletITide: formValues.produktivitet_varslet_i_tide,

      // Metode
      akseptererMetode: formValues.aksepterer_metode,
      oensketMetode: formValues.oensket_metode,
      epJusteringVarsletITide: formValues.ep_justering_varslet_i_tide,
      epJusteringAkseptert: formValues.ep_justering_akseptert,
      kreverJustertEp: vederlagEvent?.krever_justert_ep,
      holdTilbake: formValues.hold_tilbake,

      // Beløp
      hovedkravVurdering: formValues.hovedkrav_vurdering,
      hovedkravGodkjentBelop: formValues.hovedkrav_godkjent_belop,
      riggVurdering: formValues.rigg_vurdering,
      riggGodkjentBelop: formValues.rigg_godkjent_belop,
      produktivitetVurdering: formValues.produktivitet_vurdering,
      produktivitetGodkjentBelop: formValues.produktivitet_godkjent_belop,

      // Computed totals
      // Bruk totalKrevdInklPrekludert for begrunnelse - viser hva TE faktisk krevde
      totalKrevd: computed.totalKrevdInklPrekludert,
      totalGodkjent: computed.totalGodkjent,
      totalGodkjentSubsidiaer: computed.totalGodkjentInklPrekludert,
      harPrekludertKrav: computed.harPrekludertKrav,
    };

    return generateVederlagResponseBegrunnelse(input);
  }, [
    vederlagEvent?.metode,
    vederlagEvent?.krever_justert_ep,
    hovedkravBelop,
    riggBelop,
    produktivitetBelop,
    harRiggKrav,
    harProduktivitetKrav,
    har34_1_2_Preklusjon,
    formValues,
    computed,
  ]);

  // Steps configuration - 5 steps with optional preklusjon
  const steps = useMemo(() => {
    if (harPreklusjonsSteg) {
      return [
        { label: 'Oversikt' },
        { label: 'Preklusjon' },
        { label: 'Beregningsmetode' },
        { label: 'Beløp' },
        { label: 'Oppsummering' },
      ];
    }
    return [
      { label: 'Oversikt' },
      { label: 'Beregningsmetode' },
      { label: 'Beløp' },
      { label: 'Oppsummering' },
    ];
  }, [harPreklusjonsSteg]);

  // Determine which step type we're on based on currentPort
  const getStepType = useCallback(
    (port: number): 'oversikt' | 'preklusjon' | 'metode' | 'belop' | 'oppsummering' => {
      if (port === 1) return 'oversikt';
      if (harPreklusjonsSteg) {
        if (port === 2) return 'preklusjon';
        if (port === 3) return 'metode';
        if (port === 4) return 'belop';
        return 'oppsummering';
      } else {
        if (port === 2) return 'metode';
        if (port === 3) return 'belop';
        return 'oppsummering';
      }
    },
    [harPreklusjonsSteg]
  );

  const currentStepType = getStepType(currentPort);

  // Pre-populate begrunnelse when entering Oppsummering step (if empty)
  useEffect(() => {
    if (currentStepType === 'oppsummering' && !formValues.begrunnelse && autoBegrunnelse) {
      setValue('begrunnelse', autoBegrunnelse);
    }
  }, [currentStepType, formValues.begrunnelse, autoBegrunnelse, setValue]);

  // Handler to regenerate begrunnelse from auto-generated
  const handleRegenerBegrunnelse = useCallback(() => {
    if (autoBegrunnelse) {
      setValue('begrunnelse', autoBegrunnelse, { shouldDirty: true });
    }
  }, [autoBegrunnelse, setValue]);

  // Navigation
  const goToNextPort = useCallback(async () => {
    let isValid = true;

    // Validate current port based on step type
    if (currentStepType === 'preklusjon') {
      isValid = await trigger([
        'hovedkrav_varslet_i_tide',
        'rigg_varslet_i_tide',
        'produktivitet_varslet_i_tide',
      ]);
    } else if (currentStepType === 'metode') {
      isValid = await trigger([
        'aksepterer_metode',
        'oensket_metode',
        'ep_justering_varslet_i_tide',
        'ep_justering_akseptert',
        'hold_tilbake',
      ]);
    } else if (currentStepType === 'belop') {
      isValid = await trigger([
        'hovedkrav_vurdering',
        'hovedkrav_godkjent_belop',
        'rigg_vurdering',
        'rigg_godkjent_belop',
        'produktivitet_vurdering',
        'produktivitet_godkjent_belop',
      ]);
    }
    // 'oversikt' has no validation - just informational

    if (isValid && currentPort < totalPorts) {
      setCurrentPort(currentPort + 1);
      // Clear errors for next step's fields to prevent premature validation display
      clearErrors('begrunnelse');
      // Small delay to ensure DOM has updated before scrolling
      setTimeout(scrollToTop, 50);
    }
  }, [currentPort, totalPorts, trigger, currentStepType, scrollToTop, clearErrors]);

  const goToPrevPort = useCallback(() => {
    if (currentPort > startPort) {
      setCurrentPort(currentPort - 1);
      setTimeout(scrollToTop, 50);
    }
  }, [currentPort, startPort, scrollToTop]);

  // Submit handler
  const onSubmit = (data: RespondVederlagFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending(
      isUpdateMode ? 'Lagrer endringer...' : 'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    // Beregn subsidiære triggere basert på Port 1 og 2 valg
    const triggers: SubsidiaerTrigger[] = [];
    if (hovedkravPrekludert) triggers.push('preklusjon_hovedkrav');
    if (riggPrekludert) triggers.push('preklusjon_rigg');
    if (produktivitetPrekludert) triggers.push('preklusjon_produktivitet');
    // §34.3.3: EP-justering begrenset hvis TE varslet for sent - TE får bare det BH "måtte forstå"
    if (vederlagEvent?.krever_justert_ep && data.ep_justering_varslet_i_tide === false) {
      triggers.push('reduksjon_ep_justering');
    }
    if (!data.aksepterer_metode) triggers.push('metode_avslatt');

    // Bruk brukerens begrunnelse direkte (pre-populert med auto-generert, evt. redigert)
    const begrunnelseTekst = data.begrunnelse || autoBegrunnelse;

    // Calculate beløp values
    const hovedkravGodkjentBelop =
      data.hovedkrav_vurdering === 'godkjent'
        ? hovedkravBelop
        : data.hovedkrav_vurdering === 'delvis'
          ? data.hovedkrav_godkjent_belop
          : 0;

    const riggGodkjentBelop =
      data.rigg_vurdering === 'godkjent'
        ? riggBelop
        : data.rigg_vurdering === 'delvis'
          ? data.rigg_godkjent_belop
          : 0;

    const produktivitetGodkjentBelop =
      data.produktivitet_vurdering === 'godkjent'
        ? produktivitetBelop
        : data.produktivitet_vurdering === 'delvis'
          ? data.produktivitet_godkjent_belop
          : 0;

    if (isUpdateMode && lastResponseEvent) {
      // UPDATE MODE: Send respons_vederlag_oppdatert
      mutation.mutate({
        eventType: 'respons_vederlag_oppdatert',
        data: {
          // Link to original response
          original_respons_id: lastResponseEvent.event_id,
          dato_endret: new Date().toISOString().split('T')[0],

          // Begrunnelse (same as new response)
          begrunnelse: begrunnelseTekst,

          // Port 1: Preklusjon
          hovedkrav_varslet_i_tide: har34_1_2_Preklusjon ? data.hovedkrav_varslet_i_tide : undefined,
          rigg_varslet_i_tide: data.rigg_varslet_i_tide,
          produktivitet_varslet_i_tide: data.produktivitet_varslet_i_tide,

          // Port 2: Beregningsmetode
          aksepterer_metode: data.aksepterer_metode,
          oensket_metode: data.oensket_metode,
          ep_justering_varslet_i_tide: data.ep_justering_varslet_i_tide,
          ep_justering_akseptert: data.ep_justering_akseptert,
          hold_tilbake: data.hold_tilbake,

          // Port 3: Beløp
          hovedkrav_vurdering: data.hovedkrav_vurdering,
          hovedkrav_godkjent_belop: hovedkravGodkjentBelop,
          rigg_vurdering: data.rigg_vurdering,
          rigg_godkjent_belop: riggGodkjentBelop,
          produktivitet_vurdering: data.produktivitet_vurdering,
          produktivitet_godkjent_belop: produktivitetGodkjentBelop,

          // Begrunnelse-detaljer
          auto_begrunnelse: autoBegrunnelse,
          vurdering_begrunnelse: begrunnelseTekst,

          // Automatisk beregnet (prinsipalt)
          beregnings_resultat: prinsipaltResultat,
          total_godkjent_belop: computed.totalGodkjent,
          // Bruk totalKrevdInklPrekludert - representerer hva TE faktisk krevde
          total_krevd_belop: computed.totalKrevdInklPrekludert,

          // Subsidiært standpunkt (kun når relevant)
          subsidiaer_triggers: triggers.length > 0 ? triggers : undefined,
          subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
          subsidiaer_godkjent_belop: visSubsidiaertResultat
            ? computed.totalGodkjentInklPrekludert
            : undefined,
          subsidiaer_begrunnelse: visSubsidiaertResultat
            ? begrunnelseTekst
            : undefined,
        },
      });
    } else {
      // NEW RESPONSE MODE: Send respons_vederlag
      mutation.mutate({
        eventType: 'respons_vederlag',
        data: {
          vederlag_krav_id: vederlagKravId,

          // Port 1: Preklusjon
          hovedkrav_varslet_i_tide: har34_1_2_Preklusjon ? data.hovedkrav_varslet_i_tide : undefined,
          rigg_varslet_i_tide: data.rigg_varslet_i_tide,
          produktivitet_varslet_i_tide: data.produktivitet_varslet_i_tide,

          // Port 2: Beregningsmetode
          aksepterer_metode: data.aksepterer_metode,
          oensket_metode: data.oensket_metode,
          ep_justering_varslet_i_tide: data.ep_justering_varslet_i_tide,
          ep_justering_akseptert: data.ep_justering_akseptert,
          hold_tilbake: data.hold_tilbake,

          // Port 3: Beløp
          hovedkrav_vurdering: data.hovedkrav_vurdering,
          hovedkrav_godkjent_belop: hovedkravGodkjentBelop,
          rigg_vurdering: data.rigg_vurdering,
          rigg_godkjent_belop: riggGodkjentBelop,
          produktivitet_vurdering: data.produktivitet_vurdering,
          produktivitet_godkjent_belop: produktivitetGodkjentBelop,

          // Port 4: Oppsummering
          begrunnelse: begrunnelseTekst,
          auto_begrunnelse: autoBegrunnelse,

          // Automatisk beregnet (prinsipalt)
          beregnings_resultat: prinsipaltResultat,
          total_godkjent_belop: computed.totalGodkjent,
          // Bruk totalKrevdInklPrekludert - representerer hva TE faktisk krevde
          total_krevd_belop: computed.totalKrevdInklPrekludert,

          // Subsidiært standpunkt (kun når relevant)
          subsidiaer_triggers: triggers.length > 0 ? triggers : undefined,
          subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
          subsidiaer_godkjent_belop: visSubsidiaertResultat
            ? computed.totalGodkjentInklPrekludert
            : undefined,
          subsidiaer_begrunnelse: visSubsidiaertResultat
            ? begrunnelseTekst
            : undefined,
        },
      });
    }
  };

  // Handler for saving as draft (approval workflow)
  const handleSaveDraft = (data: RespondVederlagFormData) => {
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

    // Bruk brukerens begrunnelse direkte
    const begrunnelseTekstDraft = data.begrunnelse || autoBegrunnelse;

    onSaveDraft({
      belop: computed.totalGodkjent,
      resultat,
      begrunnelse: begrunnelseTekstDraft,
      formData: data,
    });

    // Clear backup and close modal
    clearBackup();
    reset();
    setCurrentPort(startPort);
    onOpenChange(false);
    toast.success('Utkast lagret', 'Vederlagssvaret er lagret som utkast. Du kan nå sende det til godkjenning.');
  };

  // Reset to start port when opening
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setCurrentPort(startPort);
    }
    onOpenChange(newOpen);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={isUpdateMode ? "Oppdater svar på vederlagskrav" : "Svar på vederlagskrav"}
      size="lg"
    >
      <div className="space-y-6">
        {/* Scroll target marker */}
        <div ref={topRef} />
        {/* Step Indicator */}
        <StepIndicator
          currentStep={currentPort}
          steps={steps}
          onStepClick={(step) => setCurrentPort(step)}
        />

        {/* BH svarplikt warning */}
        {bhSvarpliktAdvarsel && (
          <Alert variant="danger" title="Svarplikt">
            Du har brukt <strong>{dagerSidenKrav} dager</strong> på å svare. Du skal svare
            &ldquo;uten ugrunnet opphold&rdquo;. Passivitet kan medføre at du taper innsigelser.
          </Alert>
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
              STEG 1: OVERSIKT
              Shows claim summary and explains what will be evaluated
              ================================================================ */}
          {currentStepType === 'oversikt' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Oversikt</h3>

              {/* Kravsammendrag */}
              <InlineDataList stackOnMobile>
                <InlineDataListItem label="Hovedkrav" mono>
                  kr {(hovedkravBelop || 0).toLocaleString('nb-NO')},-
                </InlineDataListItem>
                {harRiggKrav && (
                  <InlineDataListItem label="Rigg/drift" mono>
                    kr {(riggBelop || 0).toLocaleString('nb-NO')},-
                  </InlineDataListItem>
                )}
                {harProduktivitetKrav && (
                  <InlineDataListItem label="Produktivitet" mono>
                    kr {(produktivitetBelop || 0).toLocaleString('nb-NO')},-
                  </InlineDataListItem>
                )}
              </InlineDataList>

              {/* Subsidiær behandling info */}
              {erSubsidiaer && (
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
                  {harPreklusjonsSteg && (
                    <div className="flex gap-3">
                      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 2</span>
                      <div>
                        <span className="font-medium">Preklusjon</span>
                        <span className="text-pkt-text-body-subtle">
                          {' '}
                          — Ta stilling til om kravene ble varslet i tide
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">
                      Steg {harPreklusjonsSteg ? 3 : 2}
                    </span>
                    <div>
                      <span className="font-medium">Beregningsmetode</span>
                      <span className="text-pkt-text-body-subtle">
                        {' '}
                        — Akseptere eller endre beregningsmetode
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">
                      Steg {harPreklusjonsSteg ? 4 : 3}
                    </span>
                    <div>
                      <span className="font-medium">Beløp</span>
                      <span className="text-pkt-text-body-subtle"> — Vurdere beløpene for hvert krav</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">
                      Steg {harPreklusjonsSteg ? 5 : 4}
                    </span>
                    <div>
                      <span className="font-medium">Oppsummering</span>
                      <span className="text-pkt-text-body-subtle"> — Se samlet resultat og send svar</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              STEG 2 (med særskilte krav): PREKLUSJON (§34.1.2 og §34.1.3)
              ================================================================ */}
          {currentStepType === 'preklusjon' && (
            <SectionContainer
              title="Preklusjon"
              description="Vurder om kravene ble varslet i tide. Ved manglende varsel tapes kravet."
            >
              {/* §34.1.2: Hovedkrav preklusjon (SVIKT/ANDRE, eller ENDRING der BH påberoper §32.2) */}
              {har34_1_2_Preklusjon && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle mb-4">
                  {/* Forklaring når preklusjon vises pga §32.2 påberopelse */}
                  {erFra32_2_Paaberopelse && (
                    <Alert variant="info" size="sm" className="mb-3">
                      Du har påberopt at forholdet ikke er en endring. Dermed må du også vurdere
                      om vederlagskravet ble varslet i tide.
                    </Alert>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Hovedkrav</h4>
                      <span className="font-mono text-sm">
                        kr {hovedkravBelop?.toLocaleString('nb-NO') || 0},-
                      </span>
                    </div>
                    {vederlagEvent?.dato_oppdaget && (
                      <span className="text-xs text-pkt-grays-gray-500">
                        Entreprenøren klar over: {vederlagEvent.dato_oppdaget}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-pkt-text-body-subtle mb-3">
                    <ExpandableText preview="Entreprenøren skal varsle «uten ugrunnet opphold».">
                      Entreprenøren skal varsle «uten ugrunnet opphold» når han blir eller burde ha blitt klar over forsinkelse eller svikt ved byggherrens ytelser, eller andre forhold byggherren har risikoen for. Krav på vederlagsjustering tapes dersom det ikke varsles innen fristen.
                    </ExpandableText>
                  </p>

                  <FormField label="Ble vederlagskravet varslet i tide?" required>
                    <Controller
                      name="hovedkrav_varslet_i_tide"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value === undefined ? undefined : field.value ? 'ja' : 'nei'}
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - varslet i tide" />
                          <RadioItem value="nei" label="Nei - prekludert (varslet for sent)" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>

                  {formValues.hovedkrav_varslet_i_tide === false && (
                    <Alert variant="danger" size="sm" title="Prekludert" className="mt-3">
                      Du tar subsidiært stilling til beløpet. Husk skriftlig innsigelse.
                    </Alert>
                  )}
                </div>
              )}

              {/* Rigg/Drift */}
              {harRiggKrav && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Rigg/drift</h4>
                      <span className="font-mono text-sm">
                        kr {riggBelop?.toLocaleString('nb-NO') || 0},-
                      </span>
                    </div>
                    {vederlagEvent?.saerskilt_krav?.rigg_drift?.dato_klar_over && (
                      <span className="text-xs text-pkt-grays-gray-500">
                        Entreprenøren klar over: {vederlagEvent.saerskilt_krav.rigg_drift.dato_klar_over}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-pkt-text-body-subtle mb-3">
                    <ExpandableText preview="Kravet må varsles «uten ugrunnet opphold».">
                      Krav på særskilt justering for rigg/drift må varsles «uten ugrunnet opphold» etter at entreprenøren ble klar over at utgifter ville påløpe som en nødvendig følge av endring, forsinkelse/svikt ved byggherrens ytelser, eller andre forhold byggherren har risikoen for.
                    </ExpandableText>
                  </p>

                  <FormField label="Ble rigg/drift-kravet varslet i tide?" required>
                    <Controller
                      name="rigg_varslet_i_tide"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value === undefined ? undefined : field.value ? 'ja' : 'nei'}
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

                  {formValues.rigg_varslet_i_tide === false && (
                    <Alert variant="danger" size="sm" title="Prekludert" className="mt-3">
                      Du tar subsidiært stilling til beløpet. Husk skriftlig innsigelse.
                    </Alert>
                  )}
                </div>
              )}

              {/* Produktivitet */}
              {harProduktivitetKrav && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Produktivitetstap</h4>
                      <span className="font-mono text-sm">
                        kr {produktivitetBelop?.toLocaleString('nb-NO') || 0},-
                      </span>
                    </div>
                    {vederlagEvent?.saerskilt_krav?.produktivitet?.dato_klar_over && (
                      <span className="text-xs text-pkt-grays-gray-500">
                        Entreprenøren klar over: {vederlagEvent.saerskilt_krav.produktivitet.dato_klar_over}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-pkt-text-body-subtle mb-3">
                    <ExpandableText preview="Kravet må varsles «uten ugrunnet opphold».">
                      Krav på produktivitetstap må varsles «uten ugrunnet opphold» etter at entreprenøren ble klar over at utgifter ville påløpe som følge av endring, forsinkelse/svikt ved byggherrens ytelser, eller andre forhold byggherren har risikoen for.
                    </ExpandableText>
                  </p>

                  <FormField label="Ble produktivitetskravet varslet i tide?" required>
                    <Controller
                      name="produktivitet_varslet_i_tide"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value === undefined ? undefined : field.value ? 'ja' : 'nei'}
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

                  {formValues.produktivitet_varslet_i_tide === false && (
                    <Alert variant="danger" size="sm" title="Prekludert" className="mt-3">
                      Du tar subsidiært stilling til beløpet. Husk skriftlig innsigelse.
                    </Alert>
                  )}
                </div>
              )}
            </SectionContainer>
          )}

          {/* ================================================================
              OPPGJØRSFORM
              ================================================================ */}
          {currentStepType === 'metode' && (
            <SectionContainer
              title="Beregningsmetode"
              description="Vurder om du aksepterer entreprenørens foreslåtte beregningsmetode."
            >
              {/* Beregningsmetode aksept */}
              <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                <FormField
                  label="Aksepterer du den foreslåtte beregningsmetoden?"
                  required
                  helpText={metodeHelpText}
                >
                  <Controller
                    name="aksepterer_metode"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ? 'ja' : 'nei'}
                        onValueChange={(val: string) => field.onChange(val === 'ja')}
                      >
                        <RadioItem value="ja" label="Ja - aksepterer beregningsmetoden" />
                        <RadioItem value="nei" label="Nei - krever annen beregningsmetode" />
                      </RadioGroup>
                    )}
                  />
                </FormField>

                {/* Regningsarbeid: varsling-info */}
                {vederlagEvent?.metode === 'REGNINGSARBEID' &&
                  vederlagEvent?.varslet_for_oppstart === false && (
                    <Alert variant="info" className="mt-3">
                      Entreprenøren varslet ikke før regningsarbeidet startet. Entreprenøren har da
                      bare krav på det du «måtte forstå» at han har hatt av utgifter.
                    </Alert>
                  )}

                {/* Ønsket metode - show when rejecting */}
                {!formValues.aksepterer_metode && (
                  <div className="mt-4 space-y-3">
                    <FormField label="Hvilken beregningsmetode krever du?" required>
                      <Controller
                        name="oensket_metode"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup value={field.value} onValueChange={field.onChange}>
                            {VEDERLAGSMETODER_OPTIONS.filter(
                              (opt) => opt.value !== '' && opt.value !== vederlagEvent?.metode
                            ).map((option) => (
                              <RadioItem
                                key={option.value}
                                value={option.value}
                                label={option.label}
                                description={VEDERLAGSMETODE_DESCRIPTIONS[option.value as VederlagsMetode]}
                              />
                            ))}
                          </RadioGroup>
                        )}
                      />
                    </FormField>

                    {/* Konsekvensvarsel for fastpristilbud */}
                    {erFastprisTilbud && (
                      <Alert variant="info">
                        Ved å avslå fastpristilbudet faller oppgjøret tilbake på{' '}
                        <strong>enhetspriser</strong> eller <strong>regningsarbeid</strong>.
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              {/* Justerte enhetspriser (§34.3.2) */}
              {maSvarePaJustering && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Justerte enhetspriser (§34.3.2)</h4>
                    <p className="text-sm text-pkt-text-body-subtle">
                      <ExpandableText preview="Entreprenøren krever at enhetsprisene justeres (§34.3.2).">
                        Entreprenøren krever at enhetsprisene justeres. Justering kan kreves når (1) ytelsene i det vesentlige er likeartet med ytelser det er fastsatt enhetspriser for, eller (2) forutsetningene for enhetsprisene forrykkes, f.eks. på grunn av omfang, antall eller tidspunkt for endringsarbeidet. Den som krever justering må varsle «uten ugrunnet opphold» (§34.3.3). Du må svare «uten ugrunnet opphold» for å bevare dine innsigelser.
                      </ExpandableText>
                    </p>
                  </div>

                  <FormField label="Varslet entreprenøren i tide? (§34.3.3)" required>
                    <Controller
                      name="ep_justering_varslet_i_tide"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value === undefined ? undefined : field.value ? 'ja' : 'nei'}
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - varslet i tide" />
                          <RadioItem value="nei" label="Nei - varslet for sent" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>

                  {formValues.ep_justering_varslet_i_tide === false && (
                    <Alert variant="warning" size="sm" title="Varslet for sent">
                      Entreprenøren har bare krav på den justering du «måtte forstå» at forholdet ville føre til (§34.3.3 første ledd).
                    </Alert>
                  )}

                  <FormField label="Aksepterer du justeringen?" required>
                    <Controller
                      name="ep_justering_akseptert"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value === undefined ? undefined : field.value ? 'ja' : 'nei'}
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem
                            value="ja"
                            label="Ja - aksepterer justering"
                          />
                          <RadioItem
                            value="nei"
                            label="Nei - avviser justering"
                          />
                        </RadioGroup>
                      )}
                    />
                  </FormField>

                  {formValues.ep_justering_akseptert === false && (
                    <Alert variant="warning" size="sm" title="Begrunn avvisning">
                      Husk å begrunne hvorfor vilkårene for justering ikke er oppfylt, f.eks. at forutsetningene ikke er forrykket eller at ytelsene ikke er tilstrekkelig likeartet.
                    </Alert>
                  )}
                </div>
              )}

              {/* Tilbakeholdelse ved manglende kostnadsoverslag */}
              {kanHoldeTilbake && (
                <div className="space-y-3">
                  <Alert variant="warning" title="Tilbakeholdelse">
                    Entreprenøren har ikke levert kostnadsoverslag for regningsarbeidet. Du kan holde
                    tilbake betaling inntil overslag mottas (§30.2).
                  </Alert>
                  <FormField label="Vil du holde tilbake betaling?">
                    <Controller
                      name="hold_tilbake"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={
                            field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                          }
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - hold tilbake inntil overslag mottas" />
                          <RadioItem value="nei" label="Nei - fortsett behandling" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}
            </SectionContainer>
          )}

          {/* ================================================================
              BELØPSVURDERING
              ================================================================ */}
          {currentStepType === 'belop' && (
            <SectionContainer
              title="Beløpsvurdering"
              description="Vurder beløpet for hvert krav. Dette er ren utmåling - ansvarsvurdering håndteres i Grunnlag-sporet."
            >

              {/* Felles alert for prekluderte krav */}
              {computed.harPrekludertKrav && (
                <Alert variant="warning" className="mb-6" title="Prekluderte krav">
                  Krav merket med <strong>PREKLUDERT</strong> er tapt på grunn av for sen varsling.
                  Prinsipalt godkjent beløp er kr 0,-. Vurder likevel beløpet subsidiært for det
                  tilfellet at kravet hadde vært varslet i tide.
                </Alert>
              )}

              {/* HOVEDKRAV */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <h4 className="font-bold text-sm">Hovedkrav</h4>
                  {hovedkravPrekludert && (
                    <>
                      <Badge variant="danger">PREKLUDERT</Badge>
                      <Badge variant="warning">Subsidiært</Badge>
                    </>
                  )}
                </div>

                <InlineDataList className="mb-4">
                  <InlineDataListItem label="Krevd" mono bold>
                    kr {hovedkravBelop?.toLocaleString('nb-NO') || 0},-
                  </InlineDataListItem>
                </InlineDataList>

                <FormField
                  label={hovedkravPrekludert ? 'Din subsidiære vurdering av beløpet' : 'Din vurdering av beløpet'}
                  required
                >
                  <Controller
                    name="hovedkrav_vurdering"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup value={field.value} onValueChange={field.onChange}>
                        <RadioItem value="godkjent" label="Godkjent fullt ut" />
                        <RadioItem value="delvis" label="Delvis godkjent" />
                        <RadioItem value="avslatt" label="Avvist" />
                      </RadioGroup>
                    )}
                  />
                </FormField>

                {/* Godkjent beløp - show when delvis */}
                {formValues.hovedkrav_vurdering === 'delvis' && (
                  <div className="mt-4 ml-6 border-l-2 border-pkt-border-subtle pl-4">
                    <FormField
                      label="Godkjent beløp"
                      required
                      error={errors.hovedkrav_godkjent_belop?.message}
                      helpText={
                        hovedkravBelop && formValues.hovedkrav_godkjent_belop
                          ? `Differanse: ${(hovedkravBelop - formValues.hovedkrav_godkjent_belop).toLocaleString('nb-NO')} kr (${((formValues.hovedkrav_godkjent_belop / hovedkravBelop) * 100).toFixed(1)}% godkjent)`
                          : undefined
                      }
                    >
                      <Controller
                        name="hovedkrav_godkjent_belop"
                        control={control}
                        render={({ field }) => (
                          <CurrencyInput
                            value={field.value ?? null}
                            onChange={field.onChange}
                            error={!!errors.hovedkrav_godkjent_belop}
                            allowNegative={false}
                          />
                        )}
                      />
                    </FormField>
                  </div>
                )}

              </div>

              {/* RIGG/DRIFT - alltid evaluerbar (subsidiært hvis prekludert) */}
              {harRiggKrav && (
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h4 className="font-bold text-sm">Særskilt: Rigg/Drift</h4>
                    {riggPrekludert && (
                      <>
                        <Badge variant="danger">PREKLUDERT</Badge>
                        <Badge variant="warning">Subsidiært</Badge>
                      </>
                    )}
                  </div>

                  <InlineDataList className="mb-4">
                    <InlineDataListItem label="Krevd" mono bold>
                      kr {riggBelop?.toLocaleString('nb-NO') || 0},-
                    </InlineDataListItem>
                  </InlineDataList>

                  <FormField
                    label={
                      riggPrekludert ? 'Din subsidiære vurdering av beløpet' : 'Din vurdering av beløpet'
                    }
                    required
                  >
                    <Controller
                      name="rigg_vurdering"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup value={field.value} onValueChange={field.onChange}>
                          <RadioItem value="godkjent" label="Godkjent fullt ut" />
                          <RadioItem value="delvis" label="Delvis godkjent" />
                          <RadioItem value="avslatt" label="Avvist" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>

                  {formValues.rigg_vurdering === 'delvis' && (
                    <div className="mt-4 ml-6 border-l-2 border-pkt-border-subtle pl-4">
                      <FormField label="Godkjent beløp" required>
                        <Controller
                          name="rigg_godkjent_belop"
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
                    </div>
                  )}
                </div>
              )}

              {/* PRODUKTIVITET - alltid evaluerbar (subsidiært hvis prekludert) */}
              {harProduktivitetKrav && (
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h4 className="font-bold text-sm">Særskilt: Produktivitetstap</h4>
                    {produktivitetPrekludert && (
                      <>
                        <Badge variant="danger">PREKLUDERT</Badge>
                        <Badge variant="warning">Subsidiært</Badge>
                      </>
                    )}
                  </div>

                  <InlineDataList className="mb-4">
                    <InlineDataListItem label="Krevd" mono bold>
                      kr {produktivitetBelop?.toLocaleString('nb-NO') || 0},-
                    </InlineDataListItem>
                  </InlineDataList>

                  <FormField
                    label={
                      produktivitetPrekludert
                        ? 'Din subsidiære vurdering av beløpet'
                        : 'Din vurdering av beløpet'
                    }
                    required
                  >
                    <Controller
                      name="produktivitet_vurdering"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup value={field.value} onValueChange={field.onChange}>
                          <RadioItem value="godkjent" label="Godkjent fullt ut" />
                          <RadioItem value="delvis" label="Delvis godkjent" />
                          <RadioItem value="avslatt" label="Avvist" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>

                  {formValues.produktivitet_vurdering === 'delvis' && (
                    <div className="mt-4 ml-6 border-l-2 border-pkt-border-subtle pl-4">
                      <FormField label="Godkjent beløp" required>
                        <Controller
                          name="produktivitet_godkjent_belop"
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
                    </div>
                  )}
                </div>
              )}
            </SectionContainer>
          )}

          {/* ================================================================
              OPPSUMMERING
              ================================================================ */}
          {currentStepType === 'oppsummering' && (
            <SectionContainer title="Oppsummering">

              {/* Sammendrag av valg */}
              <div className="space-y-4">
                {/* Metode */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle space-y-3">
                  <div>
                    <h5 className="font-medium text-sm mb-1">Beregningsmetode</h5>
                    <p className="text-sm">
                      {formValues.aksepterer_metode ? (
                        <>
                          Byggherren aksepterer{' '}
                          <span className="font-medium">
                            {vederlagEvent?.metode && getVederlagsmetodeLabel(vederlagEvent.metode).toLowerCase()}
                          </span>{' '}
                          som beregningsmetode.
                        </>
                      ) : (
                        <>
                          Byggherren krever{' '}
                          <span className="font-medium">
                            {formValues.oensket_metode && getVederlagsmetodeLabel(formValues.oensket_metode).toLowerCase()}
                          </span>{' '}
                          i stedet for{' '}
                          {vederlagEvent?.metode && getVederlagsmetodeLabel(vederlagEvent.metode).toLowerCase()}.
                        </>
                      )}
                    </p>
                  </div>

                  {maSvarePaJustering && (
                    <div>
                      <h5 className="font-medium text-sm mb-1">Justerte enhetspriser (§34.3.2)</h5>
                      <p className="text-sm">
                        {formValues.ep_justering_akseptert ? (
                          'Kravet om justering av enhetsprisene aksepteres.'
                        ) : (
                          'Kravet om justering av enhetsprisene avvises.'
                        )}
                        {formValues.ep_justering_varslet_i_tide === false &&
                          ' Kravet ble ikke varslet uten ugrunnet opphold (§34.3.3).'
                        }
                      </p>
                    </div>
                  )}

                  {formValues.hold_tilbake && (
                    <div>
                      <h5 className="font-medium text-sm mb-1">Tilbakeholdelse (§30.2)</h5>
                      <p className="text-sm">
                        Byggherren holder tilbake betaling inntil kostnadsoverslag for regningsarbeid mottas.
                      </p>
                    </div>
                  )}
                </div>

                {/* Beløpsoversikt */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-2">Beløpsvurdering</h5>

                  {/* Forklaring når det finnes prekluderte krav */}
                  {computed.harPrekludertKrav && (
                    <p className="text-xs text-pkt-text-body-subtle mb-3">
                      Krav merket «Prekludert» avvises fordi de ikke ble varslet i tide.
                      Raden under viser byggherrens subsidiære standpunkt – hva som ville blitt godkjent dersom kravet hadde vært varslet i tide.
                    </p>
                  )}

                  {/* Desktop: tabell */}
                  <table className="hidden sm:table w-full text-sm">
                    <thead>
                      <tr className="border-b border-pkt-border-subtle">
                        <th className="text-left py-1">Krav</th>
                        <th className="text-right py-1">Krevd</th>
                        <th className="text-right py-1">Godkjent</th>
                        <th className="text-right py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Hovedkrav */}
                      <tr className="border-b border-pkt-border-subtle">
                        <td className="py-2">Hovedkrav</td>
                        <td className="text-right font-mono">
                          {hovedkravBelop?.toLocaleString('nb-NO') || 0}
                        </td>
                        <td className="text-right font-mono">
                          {hovedkravPrekludert
                            ? 0
                            : formValues.hovedkrav_vurdering === 'godkjent'
                              ? hovedkravBelop?.toLocaleString('nb-NO') || 0
                              : formValues.hovedkrav_vurdering === 'delvis'
                                ? formValues.hovedkrav_godkjent_belop?.toLocaleString('nb-NO') || 0
                                : 0}
                        </td>
                        <td className="text-right">
                          {hovedkravPrekludert ? (
                            <Badge variant="danger">Prekludert</Badge>
                          ) : formValues.hovedkrav_vurdering === 'godkjent' ? (
                            <Badge variant="success">Godkjent</Badge>
                          ) : formValues.hovedkrav_vurdering === 'delvis' ? (
                            <Badge variant="warning">Delvis</Badge>
                          ) : (
                            <Badge variant="danger">Avvist</Badge>
                          )}
                        </td>
                      </tr>
                      {/* Subsidiær rad for prekludert hovedkrav */}
                      {hovedkravPrekludert && (
                        <tr className="border-b border-pkt-border-subtle text-pkt-text-body-subtle">
                          <td className="py-1 pl-4 italic">↳ Hvis varslet i tide</td>
                          <td className="text-right font-mono">
                            {hovedkravBelop?.toLocaleString('nb-NO') || 0}
                          </td>
                          <td className="text-right font-mono">
                            {formValues.hovedkrav_vurdering === 'godkjent'
                              ? hovedkravBelop?.toLocaleString('nb-NO') || 0
                              : formValues.hovedkrav_vurdering === 'delvis'
                                ? formValues.hovedkrav_godkjent_belop?.toLocaleString('nb-NO') || 0
                                : 0}
                          </td>
                          <td className="text-right">
                            {formValues.hovedkrav_vurdering === 'godkjent' ? (
                              <Badge variant="success">Godkjent</Badge>
                            ) : formValues.hovedkrav_vurdering === 'delvis' ? (
                              <Badge variant="warning">Delvis</Badge>
                            ) : (
                              <Badge variant="danger">Avvist</Badge>
                            )}
                          </td>
                        </tr>
                      )}

                      {/* Rigg/Drift */}
                      {harRiggKrav && (
                        <>
                          <tr className="border-b border-pkt-border-subtle">
                            <td className="py-2">Rigg/drift</td>
                            <td className="text-right font-mono">
                              {riggBelop?.toLocaleString('nb-NO') || 0}
                            </td>
                            <td className="text-right font-mono">
                              {riggPrekludert
                                ? 0
                                : formValues.rigg_vurdering === 'godkjent'
                                  ? riggBelop?.toLocaleString('nb-NO') || 0
                                  : formValues.rigg_vurdering === 'delvis'
                                    ? formValues.rigg_godkjent_belop?.toLocaleString('nb-NO') || 0
                                    : 0}
                            </td>
                            <td className="text-right">
                              {riggPrekludert ? (
                                <Badge variant="danger">Prekludert</Badge>
                              ) : formValues.rigg_vurdering === 'godkjent' ? (
                                <Badge variant="success">Godkjent</Badge>
                              ) : formValues.rigg_vurdering === 'delvis' ? (
                                <Badge variant="warning">Delvis</Badge>
                              ) : (
                                <Badge variant="danger">Avvist</Badge>
                              )}
                            </td>
                          </tr>
                          {/* Subsidiær rad for prekludert rigg */}
                          {riggPrekludert && (
                            <tr className="border-b border-pkt-border-subtle text-pkt-text-body-subtle">
                              <td className="py-1 pl-4 italic">↳ Hvis varslet i tide</td>
                              <td className="text-right font-mono">
                                {riggBelop?.toLocaleString('nb-NO') || 0}
                              </td>
                              <td className="text-right font-mono">
                                {formValues.rigg_vurdering === 'godkjent'
                                  ? riggBelop?.toLocaleString('nb-NO') || 0
                                  : formValues.rigg_vurdering === 'delvis'
                                    ? formValues.rigg_godkjent_belop?.toLocaleString('nb-NO') || 0
                                    : 0}
                              </td>
                              <td className="text-right">
                                {formValues.rigg_vurdering === 'godkjent' ? (
                                  <Badge variant="success">Godkjent</Badge>
                                ) : formValues.rigg_vurdering === 'delvis' ? (
                                  <Badge variant="warning">Delvis</Badge>
                                ) : (
                                  <Badge variant="danger">Avvist</Badge>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      )}

                      {/* Produktivitet */}
                      {harProduktivitetKrav && (
                        <>
                          <tr className="border-b border-pkt-border-subtle">
                            <td className="py-2">Produktivitetstap</td>
                            <td className="text-right font-mono">
                              {produktivitetBelop?.toLocaleString('nb-NO') || 0}
                            </td>
                            <td className="text-right font-mono">
                              {produktivitetPrekludert
                                ? 0
                                : formValues.produktivitet_vurdering === 'godkjent'
                                  ? produktivitetBelop?.toLocaleString('nb-NO') || 0
                                  : formValues.produktivitet_vurdering === 'delvis'
                                    ? formValues.produktivitet_godkjent_belop?.toLocaleString('nb-NO') || 0
                                    : 0}
                            </td>
                            <td className="text-right">
                              {produktivitetPrekludert ? (
                                <Badge variant="danger">Prekludert</Badge>
                              ) : formValues.produktivitet_vurdering === 'godkjent' ? (
                                <Badge variant="success">Godkjent</Badge>
                              ) : formValues.produktivitet_vurdering === 'delvis' ? (
                                <Badge variant="warning">Delvis</Badge>
                              ) : (
                                <Badge variant="danger">Avvist</Badge>
                              )}
                            </td>
                          </tr>
                          {/* Subsidiær rad for prekludert produktivitet */}
                          {produktivitetPrekludert && (
                            <tr className="border-b border-pkt-border-subtle text-pkt-text-body-subtle">
                              <td className="py-1 pl-4 italic">↳ Hvis varslet i tide</td>
                              <td className="text-right font-mono">
                                {produktivitetBelop?.toLocaleString('nb-NO') || 0}
                              </td>
                              <td className="text-right font-mono">
                                {formValues.produktivitet_vurdering === 'godkjent'
                                  ? produktivitetBelop?.toLocaleString('nb-NO') || 0
                                  : formValues.produktivitet_vurdering === 'delvis'
                                    ? formValues.produktivitet_godkjent_belop?.toLocaleString('nb-NO') || 0
                                    : 0}
                              </td>
                              <td className="text-right">
                                {formValues.produktivitet_vurdering === 'godkjent' ? (
                                  <Badge variant="success">Godkjent</Badge>
                                ) : formValues.produktivitet_vurdering === 'delvis' ? (
                                  <Badge variant="warning">Delvis</Badge>
                                ) : (
                                  <Badge variant="danger">Avvist</Badge>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      )}

                      {/* Totalt */}
                      <tr className="font-bold">
                        <td className="py-2">TOTALT</td>
                        <td className="text-right font-mono">
                          {computed.totalKrevdInklPrekludert.toLocaleString('nb-NO')}
                        </td>
                        <td className="text-right font-mono">
                          {computed.totalGodkjent.toLocaleString('nb-NO')}
                        </td>
                        <td className="text-right">
                          {computed.totalKrevdInklPrekludert > 0 && (
                            <span className="text-sm">
                              {((computed.totalGodkjent / computed.totalKrevdInklPrekludert) * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Mobil: card-liste */}
                  <div className="sm:hidden space-y-3">
                    {/* Hovedkrav card */}
                    <div className="p-3 border border-pkt-border-subtle rounded-none">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                        <span className="font-medium">Hovedkrav</span>
                        {hovedkravPrekludert ? (
                          <Badge variant="danger">Prekludert</Badge>
                        ) : formValues.hovedkrav_vurdering === 'godkjent' ? (
                          <Badge variant="success">Godkjent</Badge>
                        ) : formValues.hovedkrav_vurdering === 'delvis' ? (
                          <Badge variant="warning">Delvis</Badge>
                        ) : (
                          <Badge variant="danger">Avvist</Badge>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-pkt-text-body-subtle">Krevd:</span>
                        <span className="font-mono">{hovedkravBelop?.toLocaleString('nb-NO') || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-pkt-text-body-subtle">Godkjent:</span>
                        <span className="font-mono">
                          {hovedkravPrekludert
                            ? 0
                            : formValues.hovedkrav_vurdering === 'godkjent'
                              ? hovedkravBelop?.toLocaleString('nb-NO') || 0
                              : formValues.hovedkrav_vurdering === 'delvis'
                                ? formValues.hovedkrav_godkjent_belop?.toLocaleString('nb-NO') || 0
                                : 0}
                        </span>
                      </div>
                      {/* Subsidiært på mobil */}
                      {hovedkravPrekludert && (
                        <div className="mt-2 pt-2 border-t border-pkt-border-subtle text-pkt-text-body-subtle">
                          <div className="flex justify-between items-center mb-1">
                            <span className="italic">↳ Hvis varslet i tide:</span>
                            {formValues.hovedkrav_vurdering === 'godkjent' ? (
                              <Badge variant="success">Godkjent</Badge>
                            ) : formValues.hovedkrav_vurdering === 'delvis' ? (
                              <Badge variant="warning">Delvis</Badge>
                            ) : (
                              <Badge variant="danger">Avvist</Badge>
                            )}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Godkjent:</span>
                            <span className="font-mono">
                              {formValues.hovedkrav_vurdering === 'godkjent'
                                ? hovedkravBelop?.toLocaleString('nb-NO') || 0
                                : formValues.hovedkrav_vurdering === 'delvis'
                                  ? formValues.hovedkrav_godkjent_belop?.toLocaleString('nb-NO') || 0
                                  : 0}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rigg/Drift card */}
                    {harRiggKrav && (
                      <div className="p-3 border border-pkt-border-subtle rounded-none">
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                          <span className="font-medium">Rigg/drift</span>
                          {riggPrekludert ? (
                            <Badge variant="danger">Prekludert</Badge>
                          ) : formValues.rigg_vurdering === 'godkjent' ? (
                            <Badge variant="success">Godkjent</Badge>
                          ) : formValues.rigg_vurdering === 'delvis' ? (
                            <Badge variant="warning">Delvis</Badge>
                          ) : (
                            <Badge variant="danger">Avvist</Badge>
                          )}
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-pkt-text-body-subtle">Krevd:</span>
                          <span className="font-mono">
                            {riggBelop?.toLocaleString('nb-NO') || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-pkt-text-body-subtle">Godkjent:</span>
                          <span className="font-mono">
                            {riggPrekludert
                              ? 0
                              : formValues.rigg_vurdering === 'godkjent'
                                ? riggBelop?.toLocaleString('nb-NO') || 0
                                : formValues.rigg_vurdering === 'delvis'
                                  ? formValues.rigg_godkjent_belop?.toLocaleString('nb-NO') || 0
                                  : 0}
                          </span>
                        </div>
                        {/* Subsidiært på mobil */}
                        {riggPrekludert && (
                          <div className="mt-2 pt-2 border-t border-pkt-border-subtle text-pkt-text-body-subtle">
                            <div className="flex justify-between items-center mb-1">
                              <span className="italic">↳ Hvis varslet i tide:</span>
                              {formValues.rigg_vurdering === 'godkjent' ? (
                                <Badge variant="success">Godkjent</Badge>
                              ) : formValues.rigg_vurdering === 'delvis' ? (
                                <Badge variant="warning">Delvis</Badge>
                              ) : (
                                <Badge variant="danger">Avvist</Badge>
                              )}
                            </div>
                            <div className="flex justify-between">
                              <span>Godkjent:</span>
                              <span className="font-mono">
                                {formValues.rigg_vurdering === 'godkjent'
                                  ? riggBelop?.toLocaleString('nb-NO') || 0
                                  : formValues.rigg_vurdering === 'delvis'
                                    ? formValues.rigg_godkjent_belop?.toLocaleString('nb-NO') || 0
                                    : 0}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Produktivitet card */}
                    {harProduktivitetKrav && (
                      <div className="p-3 border border-pkt-border-subtle rounded-none">
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                          <span className="font-medium">Produktivitetstap</span>
                          {produktivitetPrekludert ? (
                            <Badge variant="danger">Prekludert</Badge>
                          ) : formValues.produktivitet_vurdering === 'godkjent' ? (
                            <Badge variant="success">Godkjent</Badge>
                          ) : formValues.produktivitet_vurdering === 'delvis' ? (
                            <Badge variant="warning">Delvis</Badge>
                          ) : (
                            <Badge variant="danger">Avvist</Badge>
                          )}
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-pkt-text-body-subtle">Krevd:</span>
                          <span className="font-mono">
                            {produktivitetBelop?.toLocaleString('nb-NO') || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-pkt-text-body-subtle">Godkjent:</span>
                          <span className="font-mono">
                            {produktivitetPrekludert
                              ? 0
                              : formValues.produktivitet_vurdering === 'godkjent'
                                ? produktivitetBelop?.toLocaleString('nb-NO') || 0
                                : formValues.produktivitet_vurdering === 'delvis'
                                  ? formValues.produktivitet_godkjent_belop?.toLocaleString('nb-NO') || 0
                                  : 0}
                          </span>
                        </div>
                        {/* Subsidiært på mobil */}
                        {produktivitetPrekludert && (
                          <div className="mt-2 pt-2 border-t border-pkt-border-subtle text-pkt-text-body-subtle">
                            <div className="flex justify-between items-center mb-1">
                              <span className="italic">↳ Hvis varslet i tide:</span>
                              {formValues.produktivitet_vurdering === 'godkjent' ? (
                                <Badge variant="success">Godkjent</Badge>
                              ) : formValues.produktivitet_vurdering === 'delvis' ? (
                                <Badge variant="warning">Delvis</Badge>
                              ) : (
                                <Badge variant="danger">Avvist</Badge>
                              )}
                            </div>
                            <div className="flex justify-between">
                              <span>Godkjent:</span>
                              <span className="font-mono">
                                {formValues.produktivitet_vurdering === 'godkjent'
                                  ? produktivitetBelop?.toLocaleString('nb-NO') || 0
                                  : formValues.produktivitet_vurdering === 'delvis'
                                    ? formValues.produktivitet_godkjent_belop?.toLocaleString('nb-NO') || 0
                                    : 0}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Totalt card */}
                    <div className="p-3 border border-pkt-border-default rounded-none bg-pkt-surface-subtle">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold">TOTALT</span>
                        {computed.totalKrevdInklPrekludert > 0 && (
                          <span className="text-sm font-medium">
                            {((computed.totalGodkjent / computed.totalKrevdInklPrekludert) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-pkt-text-body-subtle">Krevd:</span>
                        <span className="font-mono font-bold">{computed.totalKrevdInklPrekludert.toLocaleString('nb-NO')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-pkt-text-body-subtle">Godkjent:</span>
                        <span className="font-mono font-bold">{computed.totalGodkjent.toLocaleString('nb-NO')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resultatoppsummering - enkel tekst */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium">Resultat:</span>
                    <span className="font-bold">{getResultatLabel(prinsipaltResultat)}</span>
                    <span className="text-pkt-text-body-subtle">–</span>
                    <span className="font-mono">
                      kr {computed.totalGodkjent.toLocaleString('nb-NO')} av {computed.totalKrevdInklPrekludert.toLocaleString('nb-NO')}
                    </span>
                    {computed.totalKrevdInklPrekludert > 0 && (
                      <span className="text-pkt-text-body-subtle">
                        ({((computed.totalGodkjent / computed.totalKrevdInklPrekludert) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  {visSubsidiaertResultat && (
                    <div className="mt-2 text-pkt-text-body-subtle">
                      <span>↳ Subsidiært: </span>
                      <span className="font-mono">
                        kr {computed.totalGodkjentInklPrekludert.toLocaleString('nb-NO')}
                      </span>
                      <span> dersom kravene hadde vært varslet i tide</span>
                    </div>
                  )}
                </div>

                {/* UPDATE MODE: Warnings and change summary */}
                {isUpdateMode && (
                  <>
                    {/* Warning: Claim revised after previous response */}
                    {kravRevidertEtterSvar && (
                      <Alert variant="warning" title="Kravet er revidert">
                        Entreprenøren har revidert vederlagskravet etter ditt forrige svar.
                        Gjeldende krav er nå Rev. {vederlagTilstand?.antall_versjoner ?? 1}.
                      </Alert>
                    )}

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
                        <div className="space-y-1 text-sm">
                          {formValues.aksepterer_metode !== lastResponseEvent?.aksepterer_metode && (
                            <div className="flex gap-2">
                              <Badge variant="warning">Endret</Badge>
                              <span>Metodeaksept: {lastResponseEvent?.aksepterer_metode ? 'Akseptert' : 'Avvist'} → {formValues.aksepterer_metode ? 'Akseptert' : 'Avvist'}</span>
                            </div>
                          )}
                          {harRiggKrav && formValues.rigg_varslet_i_tide !== lastResponseEvent?.rigg_varslet_i_tide && (
                            <div className="flex gap-2">
                              <Badge variant="warning">Endret</Badge>
                              <span>Rigg varsling: {lastResponseEvent?.rigg_varslet_i_tide ? 'I tide' : 'Prekludert'} → {formValues.rigg_varslet_i_tide ? 'I tide' : 'Prekludert'}</span>
                            </div>
                          )}
                          {harProduktivitetKrav && formValues.produktivitet_varslet_i_tide !== lastResponseEvent?.produktivitet_varslet_i_tide && (
                            <div className="flex gap-2">
                              <Badge variant="warning">Endret</Badge>
                              <span>Produktivitet varsling: {lastResponseEvent?.produktivitet_varslet_i_tide ? 'I tide' : 'Prekludert'} → {formValues.produktivitet_varslet_i_tide ? 'I tide' : 'Prekludert'}</span>
                            </div>
                          )}
                          {computed.totalGodkjent !== (lastResponseEvent?.godkjent_belop ?? 0) && (
                            <div className="flex gap-2">
                              <Badge variant="warning">Endret</Badge>
                              <span>
                                Godkjent beløp: kr {(lastResponseEvent?.godkjent_belop ?? 0).toLocaleString('nb-NO')},- → kr {computed.totalGodkjent.toLocaleString('nb-NO')},-
                                {computed.totalGodkjent > (lastResponseEvent?.godkjent_belop ?? 0) ? (
                                  <span className="text-pkt-brand-dark-green-1000 ml-2">
                                    (↑ +{(computed.totalGodkjent - (lastResponseEvent?.godkjent_belop ?? 0)).toLocaleString('nb-NO')})
                                  </span>
                                ) : (
                                  <span className="text-pkt-brand-red-1000 ml-2">
                                    (↓ -{((lastResponseEvent?.godkjent_belop ?? 0) - computed.totalGodkjent).toLocaleString('nb-NO')})
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </SectionContainer>
                    )}
                  </>
                )}

                {/* Begrunnelse (redigerbar, pre-populert med auto-generert) */}
                <FormField
                  label="Begrunnelse"
                  error={errors.begrunnelse?.message}
                  helpText="Automatisk generert basert på valgene dine. Du kan redigere teksten fritt."
                >
                  <div className="space-y-2">
                    <Textarea
                      {...register('begrunnelse')}
                      rows={12}
                      fullWidth
                      error={!!errors.begrunnelse}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRegenerBegrunnelse}
                      >
                        Regenerer fra valg
                      </Button>
                    </div>
                  </div>
                </FormField>

                {/* Vedlegg */}
                <FormField
                  label="Vedlegg"
                  optional
                  helpText="Last opp dokumentasjon som støtter vurderingen (fakturaer, timelister, etc.)"
                >
                  <Controller
                    name="vedlegg"
                    control={control}
                    render={({ field }) => (
                      <AttachmentUpload
                        value={field.value || []}
                        onChange={field.onChange}
                        multiple
                        maxFiles={10}
                        acceptedFormatsText="PDF, bilder, Excel, Word (maks 10 MB per fil)"
                      />
                    )}
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

          {/* Navigation Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-4 pt-6 border-t-2 border-pkt-border-subtle">
            <div className="flex gap-2">
              {currentPort > startPort && (
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
              {/* Tilbakestill (kun synlig i update mode når isDirty) */}
              {isUpdateMode && isDirty && (
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
        </form>

        <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
      </div>
    </Modal>
  );
}
