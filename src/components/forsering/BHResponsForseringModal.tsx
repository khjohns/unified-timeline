/**
 * BHResponsForseringModal Component
 *
 * Modal for BH to respond to a forsering (§33.8) claim.
 * Uses a 4-port wizard model based on NS 8407 requirements.
 *
 * WIZARD STRUCTURE:
 * - Port 1: Forseringsrett - Does TE have right to acceleration compensation?
 * - Port 2: 30%-regel - Is cost within 30% limit?
 * - Port 3: Beløpsvurdering - Amount evaluation (hovedkrav + særskilte krav)
 * - Port 4: Oppsummering - Summary with principal AND subsidiary results
 *
 * KEY RULES (§33.8):
 * - TE has right to accelerate if BH rejected deadline extension unjustly
 * - Max acceleration cost = rejected_days × daily_penalty × 1.3
 * - §34.1.3: Særskilte krav (rigg/drift/produktivitet) requires separate notice
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  Alert,
  Badge,
  Button,
  CurrencyInput,
  DataList,
  DataListItem,
  FormField,
  InlineDataList,
  InlineDataListItem,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  StepIndicator,
  Textarea,
  useToast,
} from '../primitives';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { forseringKeys } from '../../queries';
import {
  bhResponsForsering,
  validerForseringsgrunnlag,
  type BHResponsForseringRequest,
} from '../../api/forsering';
import { ApiError } from '../../api/client';
import type { ForseringData, SubsidiaerTrigger } from '../../types/timeline';
import {
  generateForseringResponseBegrunnelse,
  combineBegrunnelse,
  type ForseringResponseInput,
} from '../../utils/begrunnelseGenerator';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type BelopVurdering = 'godkjent' | 'delvis' | 'avslatt';

/** Per-sak data for avslåtte fristkrav */
interface RelatertSakMedAvslag {
  sak_id: string;
  tittel: string;
  avslatte_dager: number;
}

/** Per-sak vurdering av om avslaget var berettiget */
interface ForseringsrettVurdering {
  sak_id: string;
  avslag_berettiget: boolean;
}

interface BHResponsForseringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  forseringData: ForseringData;
  currentVersion?: number;
  /** Previous response data for update mode */
  lastResponse?: ForseringData['bh_respons'];
  onSuccess?: () => void;
  /** Called on 409 conflict to let parent refresh data */
  onConflict?: () => void;
  /** Per-sak data for avslåtte fristkrav (fra ForseringKontekst) */
  avslatteSaker?: RelatertSakMedAvslag[];
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const forseringsrettVurderingSchema = z.object({
  sak_id: z.string(),
  avslag_berettiget: z.boolean(),
});

const bhResponsForseringSchema = z.object({
  // Port 1: Per-sak vurdering av forseringsrett (§33.8)
  vurdering_per_sak: z.array(forseringsrettVurderingSchema).default([]),

  // Port 2: 30%-regel (auto-beregnet, ikke brukerstyrt)
  trettiprosent_overholdt: z.boolean().optional(),

  // Port 3: Beløpsvurdering
  hovedkrav_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']),
  godkjent_belop: z.number().min(0).optional(),

  // Port 3b: Særskilte krav (hvis TE har varslet)
  rigg_varslet_i_tide: z.boolean().optional(),
  godkjent_rigg_drift: z.number().min(0).optional(),
  rigg_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']).optional(),
  produktivitet_varslet_i_tide: z.boolean().optional(),
  godkjent_produktivitet: z.number().min(0).optional(),
  produktivitet_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']).optional(),

  // Port 4: Oppsummering
  tilleggs_begrunnelse: z.string().optional(),
});

type BHResponsForseringFormData = z.infer<typeof bhResponsForseringSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `kr ${amount.toLocaleString('nb-NO')},-`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Get status badge variant and label for a vurdering
 */
function getVurderingBadge(
  vurdering: BelopVurdering | undefined,
  prekludert?: boolean
): { variant: 'success' | 'warning' | 'danger'; label: string } {
  if (prekludert) {
    return { variant: 'danger', label: 'Prekludert' };
  }
  switch (vurdering) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'delvis':
      return { variant: 'warning', label: 'Delvis' };
    case 'avslatt':
    default:
      return { variant: 'danger', label: 'Avvist' };
  }
}

/**
 * Calculate approved amount for a krav based on vurdering
 */
function beregnGodkjentBelopForKrav(
  vurdering: BelopVurdering | undefined,
  krevdBelop: number,
  delvisGodkjentBelop: number | undefined,
  prekludert?: boolean
): number {
  if (prekludert) return 0;
  switch (vurdering) {
    case 'godkjent':
      return krevdBelop;
    case 'delvis':
      return delvisGodkjentBelop ?? 0;
    default:
      return 0;
  }
}

/**
 * Calculate total krevd amount from forsering data
 */
function beregnTotalKrevd(forseringData: ForseringData): number {
  let total = forseringData.estimert_kostnad ?? 0;

  // Add særskilte krav if present
  if (forseringData.vederlag?.saerskilt_krav) {
    total += forseringData.vederlag.saerskilt_krav.rigg_drift?.belop ?? 0;
    total += forseringData.vederlag.saerskilt_krav.produktivitet?.belop ?? 0;
  }

  return total;
}

/**
 * Calculate principal result based on wizard inputs
 */
function beregnPrinsipaltResultat(
  data: Partial<BHResponsForseringFormData>,
  computed: {
    harForseringsrett: boolean;
    trettiprosentOk: boolean;
    totalGodkjent: number;
    totalKrevd: number;
  }
): 'godkjent' | 'delvis_godkjent' | 'avslatt' {
  // If TE doesn't have acceleration right or 30% rule fails, reject
  if (!computed.harForseringsrett || !computed.trettiprosentOk) {
    return 'avslatt';
  }

  // Calculate approval percentage
  const godkjentProsent =
    computed.totalKrevd > 0 ? computed.totalGodkjent / computed.totalKrevd : 0;

  if (data.hovedkrav_vurdering === 'avslatt' && godkjentProsent === 0) {
    return 'avslatt';
  }

  if (godkjentProsent >= 0.99) {
    return 'godkjent';
  }

  return 'delvis_godkjent';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BHResponsForseringModal({
  open,
  onOpenChange,
  sakId,
  forseringData,
  currentVersion = 0,
  lastResponse,
  onSuccess,
  onConflict,
  avslatteSaker,
}: BHResponsForseringModalProps) {
  const isUpdateMode = !!lastResponse;
  const [currentPort, setCurrentPort] = useState(1);
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Scroll to top of modal content
  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Check if særskilte krav exists
  const harRiggKrav = (forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop ?? 0) > 0;
  const harProduktivitetKrav = (forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop ?? 0) > 0;
  const harSaerskiltKrav = harRiggKrav || harProduktivitetKrav;

  // Calculate total ports (4 steps - Oversikt fjernet)
  const totalPorts = 4;

  // Fetch grunnlag validation status when modal opens
  const { data: grunnlagValidering, isLoading: isLoadingGrunnlag } = useQuery({
    queryKey: forseringKeys.validerGrunnlag(sakId),
    queryFn: () => validerForseringsgrunnlag(sakId),
    enabled: open,
    staleTime: 30000,
  });

  // Compute defaultValues based on mode
  const computedDefaultValues = useMemo((): Partial<BHResponsForseringFormData> => {
    if (isUpdateMode && lastResponse) {
      // Restore per-sak vurdering from lastResponse
      // If lastResponse has vurdering_per_sak, use it directly
      // Otherwise, convert from old grunnlag_fortsatt_gyldig field
      let vurderingPerSak: ForseringsrettVurdering[] = [];

      if (lastResponse.vurdering_per_sak && lastResponse.vurdering_per_sak.length > 0) {
        // Use existing per-sak vurdering
        vurderingPerSak = lastResponse.vurdering_per_sak;
      } else if (avslatteSaker && avslatteSaker.length > 0) {
        // Convert from old binary field - all saker get same vurdering
        // grunnlag_fortsatt_gyldig=true meant "rejection was justified" (TE has NO right)
        // grunnlag_fortsatt_gyldig=false meant "rejection was unjustified" (TE HAS right)
        const avslagBerettiget = lastResponse.grunnlag_fortsatt_gyldig ?? true;
        vurderingPerSak = avslatteSaker.map(sak => ({
          sak_id: sak.sak_id,
          avslag_berettiget: avslagBerettiget,
        }));
      }

      return {
        vurdering_per_sak: vurderingPerSak,
        // Auto-settes fra forseringData, ikke fra skjema
        trettiprosent_overholdt: forseringData.kostnad_innenfor_grense ?? true,
        hovedkrav_vurdering: lastResponse.aksepterer ? 'godkjent' : 'avslatt',
        godkjent_belop: lastResponse.godkjent_belop,
        rigg_varslet_i_tide: lastResponse.rigg_varslet_i_tide ?? true,
        godkjent_rigg_drift: lastResponse.godkjent_rigg_drift,
        produktivitet_varslet_i_tide: lastResponse.produktivitet_varslet_i_tide ?? true,
        godkjent_produktivitet: lastResponse.godkjent_produktivitet,
        tilleggs_begrunnelse: '',
      };
    }
    return {
      // Default: empty array - user must choose for each sak
      vurdering_per_sak: [],
      // Auto-settes fra forseringData
      trettiprosent_overholdt: forseringData.kostnad_innenfor_grense ?? true,
      hovedkrav_vurdering: 'godkjent',
      rigg_varslet_i_tide: true,
      produktivitet_varslet_i_tide: true,
    };
  }, [isUpdateMode, lastResponse, avslatteSaker, forseringData.kostnad_innenfor_grense]);

  // Form setup
  const {
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    control,
    setValue,
  } = useForm<BHResponsForseringFormData>({
    resolver: zodResolver(bhResponsForseringSchema),
    mode: 'onTouched',
    defaultValues: computedDefaultValues,
  });

  // Reset form when opening in update mode
  useEffect(() => {
    if (open && isUpdateMode && lastResponse) {
      reset(computedDefaultValues);
    }
  }, [open, isUpdateMode, lastResponse, reset, computedDefaultValues]);

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'bh_respons_forsering', formData, isDirty);

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

  // Compute derived values
  const computed = useMemo(() => {
    const totalKrevd = beregnTotalKrevd(forseringData);

    // Calculate total avslåtte dager (from avslatteSaker or fallback to forseringData)
    const totalAvslatteDager = avslatteSaker?.reduce(
      (sum, sak) => sum + sak.avslatte_dager, 0
    ) ?? forseringData.avslatte_dager;

    // Calculate dager med uberettiget avslag (from per-sak vurdering)
    const dagerUberettiget = (formData.vurdering_per_sak ?? [])
      .filter(v => v.avslag_berettiget === false)
      .reduce((sum, v) => {
        const sak = avslatteSaker?.find(s => s.sak_id === v.sak_id);
        return sum + (sak?.avslatte_dager ?? 0);
      }, 0);

    // TE has forseringsrett if any rejection was unjustified
    const harForseringsrett = dagerUberettiget > 0;

    // Calculate godkjent based on vurdering
    let hovedkravGodkjent = 0;
    if (formData.hovedkrav_vurdering === 'godkjent') {
      hovedkravGodkjent = forseringData.estimert_kostnad ?? 0;
    } else if (formData.hovedkrav_vurdering === 'delvis') {
      hovedkravGodkjent = formData.godkjent_belop ?? 0;
    }

    // Særskilte krav - only count if not precluded
    let riggGodkjent = 0;
    let produktivitetGodkjent = 0;

    if (harRiggKrav && formData.rigg_varslet_i_tide !== false) {
      if (formData.rigg_vurdering === 'godkjent') {
        riggGodkjent = forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop ?? 0;
      } else if (formData.rigg_vurdering === 'delvis') {
        riggGodkjent = formData.godkjent_rigg_drift ?? 0;
      }
    }

    if (harProduktivitetKrav && formData.produktivitet_varslet_i_tide !== false) {
      if (formData.produktivitet_vurdering === 'godkjent') {
        produktivitetGodkjent = forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop ?? 0;
      } else if (formData.produktivitet_vurdering === 'delvis') {
        produktivitetGodkjent = formData.godkjent_produktivitet ?? 0;
      }
    }

    const totalGodkjent = hovedkravGodkjent + riggGodkjent + produktivitetGodkjent;

    // Subsidiær calculation (ignores preclusion)
    let subsidiaerRigg = 0;
    let subsidiaerProduktivitet = 0;

    if (harRiggKrav) {
      if (formData.rigg_vurdering === 'godkjent') {
        subsidiaerRigg = forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop ?? 0;
      } else if (formData.rigg_vurdering === 'delvis') {
        subsidiaerRigg = formData.godkjent_rigg_drift ?? 0;
      }
    }

    if (harProduktivitetKrav) {
      if (formData.produktivitet_vurdering === 'godkjent') {
        subsidiaerProduktivitet = forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop ?? 0;
      } else if (formData.produktivitet_vurdering === 'delvis') {
        subsidiaerProduktivitet = formData.godkjent_produktivitet ?? 0;
      }
    }

    const subsidiaerGodkjent = hovedkravGodkjent + subsidiaerRigg + subsidiaerProduktivitet;

    // Preklusion triggers for særskilte krav
    const harPrekludertKrav =
      (harRiggKrav && formData.rigg_varslet_i_tide === false) ||
      (harProduktivitetKrav && formData.produktivitet_varslet_i_tide === false);

    // Flag for when BH believes TE has no forseringsrett (all rejections were justified)
    // Only triggered when user has made per-sak evaluations
    const harForseringsrettAvslag = !harForseringsrett &&
      (formData.vurdering_per_sak?.length ?? 0) > 0;

    // Any reason for subsidiary evaluation
    const harSubsidiaerGrunn = harForseringsrettAvslag || harPrekludertKrav;

    // Collect all subsidiary triggers
    const subsidiaerTriggers: SubsidiaerTrigger[] = [];
    if (harForseringsrettAvslag) {
      subsidiaerTriggers.push('forseringsrett_avslatt');
    }
    if (harRiggKrav && formData.rigg_varslet_i_tide === false) {
      subsidiaerTriggers.push('preklusjon_rigg');
    }
    if (harProduktivitetKrav && formData.produktivitet_varslet_i_tide === false) {
      subsidiaerTriggers.push('preklusjon_produktivitet');
    }

    return {
      totalKrevd,
      totalGodkjent,
      subsidiaerGodkjent,
      subsidiaerRigg,
      subsidiaerProduktivitet,
      harPrekludertKrav,
      harForseringsrettAvslag,
      harSubsidiaerGrunn,
      subsidiaerTriggers,
      // Per-sak vurdering computed values
      totalAvslatteDager,
      dagerUberettiget,
      harForseringsrett,
      // Bruker automatisk beregning direkte, ikke skjemafelt
      trettiprosentOk: forseringData.kostnad_innenfor_grense ?? true,
    };
  }, [formData, forseringData, harRiggKrav, harProduktivitetKrav, avslatteSaker]);

  // Generate auto-begrunnelse
  const autoBegrunnelse = useMemo(() => {
    // Build per-sak vurdering with titles and dager for begrunnelse
    const vurderingPerSakMedDetaljer = (formData.vurdering_per_sak ?? []).map(v => {
      const sak = avslatteSaker?.find(s => s.sak_id === v.sak_id);
      return {
        ...v,
        sakTittel: sak?.tittel,
        avslatteDager: sak?.avslatte_dager,
      };
    });

    const input: ForseringResponseInput = {
      avslatteDager: forseringData.avslatte_dager,
      dagmulktsats: forseringData.dagmulktsats,
      maksForseringskostnad: forseringData.maks_forseringskostnad,
      estimertKostnad: forseringData.estimert_kostnad,
      // New per-sak vurdering fields
      vurderingPerSak: vurderingPerSakMedDetaljer,
      dagerMedForseringsrett: computed.dagerUberettiget,
      teHarForseringsrett: computed.harForseringsrett,
      // Bruker automatisk beregning
      trettiprosentOverholdt: forseringData.kostnad_innenfor_grense ?? true,
      hovedkravVurdering: formData.hovedkrav_vurdering ?? 'godkjent',
      hovedkravBelop: forseringData.estimert_kostnad,
      godkjentBelop: formData.hovedkrav_vurdering === 'godkjent'
        ? forseringData.estimert_kostnad
        : formData.godkjent_belop,
      harRiggKrav,
      riggBelop: forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop,
      riggVarsletITide: formData.rigg_varslet_i_tide,
      riggVurdering: formData.rigg_vurdering,
      godkjentRiggDrift: formData.godkjent_rigg_drift,
      harProduktivitetKrav,
      produktivitetBelop: forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop,
      produktivitetVarsletITide: formData.produktivitet_varslet_i_tide,
      produktivitetVurdering: formData.produktivitet_vurdering,
      godkjentProduktivitet: formData.godkjent_produktivitet,
      totalKrevd: computed.totalKrevd,
      totalGodkjent: computed.totalGodkjent,
      harPrekludertKrav: computed.harPrekludertKrav,
      subsidiaerGodkjentBelop: computed.subsidiaerGodkjent,
    };
    return generateForseringResponseBegrunnelse(input);
  }, [formData, forseringData, harRiggKrav, harProduktivitetKrav, computed, avslatteSaker]);

  // Submit handler
  const onSubmit = async (data: BHResponsForseringFormData) => {
    // Guard: Ikke tillat submit før vi er på siste steg (oppsummering)
    if (currentPort !== totalPorts) {
      return;
    }

    setIsSubmitting(true);

    try {
      const finalBegrunnelse = combineBegrunnelse(autoBegrunnelse, data.tilleggs_begrunnelse);
      const prinsipaltResultat = beregnPrinsipaltResultat(data, computed);

      const request: BHResponsForseringRequest = {
        forsering_sak_id: sakId,
        aksepterer: prinsipaltResultat !== 'avslatt',
        godkjent_kostnad: computed.totalGodkjent,
        begrunnelse: finalBegrunnelse,
        expected_version: currentVersion,
        // New: Per-sak vurdering
        vurdering_per_sak: data.vurdering_per_sak,
        dager_med_forseringsrett: computed.dagerUberettiget,
        // Backward compatibility: old field (inverted semantics)
        // grunnlag_fortsatt_gyldig=true means "rejection was justified" (TE has NO right)
        grunnlag_fortsatt_gyldig: !computed.harForseringsrett,
        // Bruker automatisk beregning
        trettiprosent_overholdt: forseringData.kostnad_innenfor_grense ?? true,
        rigg_varslet_i_tide: data.rigg_varslet_i_tide,
        produktivitet_varslet_i_tide: data.produktivitet_varslet_i_tide,
        godkjent_rigg_drift: data.godkjent_rigg_drift,
        godkjent_produktivitet: data.godkjent_produktivitet,
        subsidiaer_triggers: computed.subsidiaerTriggers.length > 0 ? computed.subsidiaerTriggers : undefined,
        subsidiaer_godkjent_belop: computed.harSubsidiaerGrunn ? computed.subsidiaerGodkjent : undefined,
      };

      const response = await bhResponsForsering(request);

      if (response.success) {
        clearBackup();
        reset();
        setCurrentPort(1);
        onOpenChange(false);
        toast.success(
          isUpdateMode ? 'Standpunkt oppdatert' : 'Standpunkt registrert',
          'Ditt standpunkt til forseringskravet er lagret.'
        );
        onSuccess?.();
      }
    } catch (error) {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      } else if (error instanceof ApiError && error.status === 409) {
        toast.error('Versjonskonflikt', 'Saken ble endret av en annen bruker. Prøv igjen.');
        onConflict?.();
        onOpenChange(false);
      } else {
        const err = error as Error;
        toast.error('Feil ved lagring', err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Port navigation (Oversikt fjernet - port 1 er nå Forseringsrett)
  const canProceed = useMemo(() => {
    switch (currentPort) {
      case 1:
        // Forseringsrett - All saker must be evaluated
        if (!avslatteSaker || avslatteSaker.length === 0) {
          // Fallback: if no avslatteSaker data, allow proceeding (will use forseringData.avslatte_dager)
          return true;
        }
        // Check that every sak has been evaluated
        const alleVurdert = avslatteSaker.every(
          sak => formData.vurdering_per_sak?.some(
            v => v.sak_id === sak.sak_id && v.avslag_berettiget !== undefined
          )
        );
        return alleVurdert;
      case 2:
        // 30%-regel er kun informativ - beregnes automatisk
        return true;
      case 3:
        // Beløp - hovedkrav må vurderes
        return formData.hovedkrav_vurdering !== undefined;
      default:
        return true;
    }
  }, [currentPort, formData, avslatteSaker]);

  const handleNext = () => {
    if (canProceed && currentPort < totalPorts) {
      setCurrentPort(currentPort + 1);
      scrollToTop();
    }
  };

  const handlePrevious = () => {
    if (currentPort > 1) {
      setCurrentPort(currentPort - 1);
      scrollToTop();
    }
  };

  // Step configuration (Oversikt fjernet)
  const steps = [
    { label: 'Forseringsrett' },
    { label: '30%-regel' },
    { label: 'Beløp' },
    { label: 'Oppsummering' },
  ];

  // Calculate prinsipalt resultat for display
  const prinsipaltResultat = beregnPrinsipaltResultat(formData, computed);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Byggherrens standpunkt til forsering"
        size="lg"
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          onKeyDown={(e) => {
            // Prevent Enter from submitting form while navigating through wizard steps
            if (e.key === 'Enter' && currentPort < totalPorts) {
              e.preventDefault();
            }
          }}
          className="space-y-4 sm:space-y-6"
        >
          <div ref={topRef} />

          {/* Step Indicator */}
          <StepIndicator
            currentStep={currentPort}
            steps={steps}
            onStepClick={(step) => setCurrentPort(step)}
          />

          {/* Token Expired Alert */}
          <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />

          {/* PORT 1: Forseringsrett (§33.8) - Per-sak vurdering */}
          {currentPort === 1 && (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg font-semibold">Forseringsrett (§33.8)</h3>
              <p className="text-sm text-pkt-text-body-subtle">
                Etter NS 8407 §33.8 har entreprenøren rett til forseringsvederlag dersom byggherren
                har avslått fristforlengelse uten berettiget grunn.
              </p>

              {/* Info about the forsering */}
              <SectionContainer title="Avslåtte fristkrav" variant="subtle">
                <InlineDataList>
                  <InlineDataListItem label="Antall saker" mono bold>
                    {avslatteSaker?.length ?? forseringData.avslatte_fristkrav?.length ?? 0}
                  </InlineDataListItem>
                  <InlineDataListItem label="Sum avslåtte dager" mono bold>
                    {computed.totalAvslatteDager}
                  </InlineDataListItem>
                </InlineDataList>
              </SectionContainer>

              {/* Grunnlag validation warning (informational only, not blocking) */}
              {!isLoadingGrunnlag && grunnlagValidering && !grunnlagValidering.er_gyldig && (
                <Alert variant="warning" title="Merknad">
                  BH har tidligere endret standpunkt på en av de underliggende sakene.
                  Dette påvirker ikke din vurdering her - forseringsvurderingen registreres som en separat hendelse.
                </Alert>
              )}

              {/* Per-sak vurdering */}
              {avslatteSaker && avslatteSaker.length > 0 ? (
                <>
                  <p className="text-sm font-medium">
                    Vurder om avslaget på fristforlengelse var berettiget for hver sak:
                  </p>

                  {/* Hjelpetekst for berettiget/uberettiget */}
                  <div className="p-3 bg-pkt-surface-subtle border-l-4 border-pkt-border-default text-sm space-y-2">
                    <p>
                      <strong>Berettiget avslag:</strong> Entreprenøren hadde ikke krav på
                      fristforlengelse etter NS 8407 §33.1-33.3 (f.eks. forholdet var ikke en
                      hindring, entreprenøren burde ha tatt høyde for det, eller varslet for sent).
                    </p>
                    <p>
                      <strong>Uberettiget avslag:</strong> Entreprenøren hadde krav på fristforlengelse,
                      men byggherren avslo feilaktig. Dette gir forseringsrett.
                    </p>
                  </div>

                  {avslatteSaker.map((sak, index) => {
                    const currentVurdering = formData.vurdering_per_sak?.find(v => v.sak_id === sak.sak_id);

                    return (
                      <SectionContainer
                        key={sak.sak_id}
                        title={sak.sak_id}
                        description={`${sak.tittel} (${sak.avslatte_dager} avslåtte dager)`}
                      >
                        <Controller
                          name="vurdering_per_sak"
                          control={control}
                          render={({ field }) => (
                            <RadioGroup
                              value={
                                currentVurdering?.avslag_berettiget === true ? 'berettiget' :
                                currentVurdering?.avslag_berettiget === false ? 'uberettiget' : undefined
                              }
                              onValueChange={(v) => {
                                const newVurdering: ForseringsrettVurdering = {
                                  sak_id: sak.sak_id,
                                  avslag_berettiget: v === 'berettiget',
                                };
                                // Update or add vurdering for this sak
                                const existingVurderinger = field.value ?? [];
                                const filtered = existingVurderinger.filter(vur => vur.sak_id !== sak.sak_id);
                                field.onChange([...filtered, newVurdering]);
                              }}
                            >
                              <RadioItem
                                value="berettiget"
                                label="Avslaget var berettiget"
                                description="Entreprenøren hadde ikke krav på fristforlengelse"
                              />
                              <RadioItem
                                value="uberettiget"
                                label="Avslaget var uberettiget"
                                description="Entreprenøren hadde krav på fristforlengelse"
                              />
                            </RadioGroup>
                          )}
                        />
                      </SectionContainer>
                    );
                  })}

                  {/* Summary of per-sak evaluation */}
                  <InlineDataList title="Oppsummering">
                    <InlineDataListItem label="Totalt avslått" mono bold>
                      {computed.totalAvslatteDager} dager
                    </InlineDataListItem>
                    <InlineDataListItem label="Uberettiget" mono bold>
                      {computed.dagerUberettiget} dager
                    </InlineDataListItem>
                    <InlineDataListItem label="">
                      <Badge variant={computed.harForseringsrett ? 'warning' : 'info'}>
                        {computed.harForseringsrett
                          ? `Forseringsrett for ${computed.dagerUberettiget} dager`
                          : 'Ingen forseringsrett'}
                      </Badge>
                    </InlineDataListItem>
                  </InlineDataList>
                </>
              ) : (
                /* Loading state when avslatteSaker not available */
                <div className="flex items-center gap-3 py-4 text-pkt-text-body-muted">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm">Henter saksinformasjon...</span>
                </div>
              )}
            </div>
          )}

          {/* PORT 2: 30%-regel */}
          {currentPort === 2 && (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg font-semibold">30%-regelen (§33.8)</h3>
              <p className="text-sm text-pkt-text-body-subtle">
                Entreprenøren har ikke valgrett til forsering dersom forseringskostnadene
                overstiger dagmulkten med tillegg av 30%.
              </p>

              {/* Calculation and comparison */}
              <SectionContainer title="Beregning av 30%-grensen" variant="subtle">
                <div className="space-y-1 text-sm font-mono">
                  <div>Avslåtte dager: {forseringData.avslatte_dager}</div>
                  <div>Dagmulktsats: {formatCurrency(forseringData.dagmulktsats)}</div>
                  <div className="border-t border-pkt-border-subtle pt-1 mt-1">
                    Maks kostnad: {forseringData.avslatte_dager} × {formatCurrency(forseringData.dagmulktsats)} × 1,3 = <strong>{formatCurrency(forseringData.maks_forseringskostnad)}</strong>
                  </div>
                </div>
                <div className="border-t border-pkt-border-subtle pt-3 mt-3">
                  <InlineDataList>
                    <InlineDataListItem label="Entreprenørens estimat" mono bold>
                      {formatCurrency(forseringData.estimert_kostnad)}
                    </InlineDataListItem>
                    <InlineDataListItem label="Maks (30%)" mono bold>
                      {formatCurrency(forseringData.maks_forseringskostnad)}
                    </InlineDataListItem>
                  </InlineDataList>
                </div>
              </SectionContainer>

              {/* Konklusjon basert på automatisk beregning */}
              {forseringData.kostnad_innenfor_grense ? (
                <Alert variant="info" title="Valgrett bekreftet">
                  Entreprenøren hadde valgrett til å forsere fordi estimert kostnad er innenfor 30%-grensen.
                </Alert>
              ) : (
                <Alert variant="warning" title="Ingen valgrett">
                  Entreprenøren hadde ikke valgrett til forsering fordi estimert kostnad overstiger 30%-grensen.
                  Kravet avslås på dette grunnlaget.
                </Alert>
              )}
            </div>
          )}

          {/* PORT 3: Beløpsvurdering */}
          {currentPort === 3 && (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg font-semibold">Beløpsvurdering</h3>
              <p className="text-sm text-pkt-text-body-subtle">
                Vurder forseringskostnadene. Forsering dekkes etter regningsarbeid (§34.4).
              </p>

              {/* Info when evaluating subsidiarily (TE has no forseringsrett) */}
              {computed.harForseringsrettAvslag && (
                <Alert variant="warning" title="Subsidiær vurdering">
                  Du har vurdert at entreprenøren ikke har forseringsrett. Dine beløpsvurderinger
                  nedenfor gjelder derfor <strong>subsidiært</strong> - det vil si for det tilfellet
                  at du ikke får medhold i avvisningen.
                </Alert>
              )}

              {/* Hovedkrav */}
              <SectionContainer title="Forseringskostnader (hovedkrav)">
                <div className="text-sm mb-4">
                  Krevd beløp: <strong>{formatCurrency(forseringData.estimert_kostnad)}</strong>
                </div>

                <Controller
                  name="hovedkrav_vurdering"
                  control={control}
                  render={({ field }) => (
                    <FormField label="Din vurdering" required>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <RadioItem value="godkjent" label="Godkjenner" description="Full dekning" />
                        <RadioItem value="delvis" label="Delvis godkjenning" description="Redusert beløp" />
                        <RadioItem value="avslatt" label="Avslår" description="Ingen dekning" />
                      </RadioGroup>
                    </FormField>
                  )}
                />

                {formData.hovedkrav_vurdering === 'delvis' && (
                  <Controller
                    name="godkjent_belop"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        label="Godkjent beløp"
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        helperText={`Maks: ${formatCurrency(forseringData.estimert_kostnad)}`}
                      />
                    )}
                  />
                )}
              </SectionContainer>

              {/* Særskilte krav - Rigg/drift */}
              {harRiggKrav && (
                <SectionContainer title="Økte rigg- og driftskostnader (§34.1.3)">
                  <div className="text-sm mb-4">
                    Krevd beløp: <strong>{formatCurrency(forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop)}</strong>
                  </div>

                  <p className="text-sm text-pkt-text-body-subtle">
                    Etter NS 8407 §34.1.3 må krav på særskilt justering for rigg/drift varsles
                    «uten ugrunnet opphold» etter at entreprenøren ble klar over at utgifter ville påløpe.
                  </p>

                  <Controller
                    name="rigg_varslet_i_tide"
                    control={control}
                    render={({ field }) => (
                      <FormField label="Varslet i tide?" required>
                        <RadioGroup
                          value={field.value === true ? 'ja' : field.value === false ? 'nei' : undefined}
                          onValueChange={(v) => field.onChange(v === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja" description="Varslet «uten ugrunnet opphold»" />
                          <RadioItem value="nei" label="Nei" description="Prekludert (varslet for sent)" />
                        </RadioGroup>
                      </FormField>
                    )}
                  />

                  {formData.rigg_varslet_i_tide === false && (
                    <Alert variant="warning" title="Prekludert">
                      Kravet prekluderes fordi det ikke ble varslet i tide.
                      Byggherren tar likevel subsidiært standpunkt til beløpet.
                    </Alert>
                  )}

                  {/* Show vurdering even if precluded (for subsidiary) */}
                  <Controller
                    name="rigg_vurdering"
                    control={control}
                    render={({ field }) => (
                      <FormField
                        label={formData.rigg_varslet_i_tide === false ? 'Subsidiær vurdering' : 'Din vurdering'}
                      >
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <RadioItem value="godkjent" label="Godkjenner" />
                          <RadioItem value="delvis" label="Delvis" />
                          <RadioItem value="avslatt" label="Avslår" />
                        </RadioGroup>
                      </FormField>
                    )}
                  />

                  {formData.rigg_vurdering === 'delvis' && (
                    <Controller
                      name="godkjent_rigg_drift"
                      control={control}
                      render={({ field }) => (
                        <CurrencyInput
                          label="Godkjent beløp"
                          value={field.value ?? null}
                          onChange={(v) => field.onChange(v ?? undefined)}
                        />
                      )}
                    />
                  )}
                </SectionContainer>
              )}

              {/* Særskilte krav - Produktivitet */}
              {harProduktivitetKrav && (
                <SectionContainer title="Produktivitetstap (§34.1.3)">
                  <div className="text-sm mb-4">
                    Krevd beløp: <strong>{formatCurrency(forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop)}</strong>
                  </div>

                  <p className="text-sm text-pkt-text-body-subtle">
                    Etter NS 8407 §34.1.3 annet ledd må krav på produktivitetstap varsles
                    «uten ugrunnet opphold».
                  </p>

                  <Controller
                    name="produktivitet_varslet_i_tide"
                    control={control}
                    render={({ field }) => (
                      <FormField label="Varslet i tide?" required>
                        <RadioGroup
                          value={field.value === true ? 'ja' : field.value === false ? 'nei' : undefined}
                          onValueChange={(v) => field.onChange(v === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja" description="Varslet «uten ugrunnet opphold»" />
                          <RadioItem value="nei" label="Nei" description="Prekludert (varslet for sent)" />
                        </RadioGroup>
                      </FormField>
                    )}
                  />

                  {formData.produktivitet_varslet_i_tide === false && (
                    <Alert variant="warning" title="Prekludert">
                      Kravet prekluderes fordi det ikke ble varslet i tide.
                      Byggherren tar likevel subsidiært standpunkt til beløpet.
                    </Alert>
                  )}

                  <Controller
                    name="produktivitet_vurdering"
                    control={control}
                    render={({ field }) => (
                      <FormField
                        label={formData.produktivitet_varslet_i_tide === false ? 'Subsidiær vurdering' : 'Din vurdering'}
                      >
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <RadioItem value="godkjent" label="Godkjenner" />
                          <RadioItem value="delvis" label="Delvis" />
                          <RadioItem value="avslatt" label="Avslår" />
                        </RadioGroup>
                      </FormField>
                    )}
                  />

                  {formData.produktivitet_vurdering === 'delvis' && (
                    <Controller
                      name="godkjent_produktivitet"
                      control={control}
                      render={({ field }) => (
                        <CurrencyInput
                          label="Godkjent beløp"
                          value={field.value ?? null}
                          onChange={(v) => field.onChange(v ?? undefined)}
                        />
                      )}
                    />
                  )}
                </SectionContainer>
              )}
            </div>
          )}

          {/* PORT 4: Oppsummering */}
          {currentPort === 4 && (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg font-semibold">Oppsummering</h3>

              {/* Per-sak forseringsrett oppsummering - tabell-layout */}
              {avslatteSaker && avslatteSaker.length > 0 && (
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-3">Forseringsrett-vurdering</h5>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pkt-border-subtle">
                        <th className="text-left py-1.5 font-medium">Sak</th>
                        <th className="text-right py-1.5 font-medium w-16">Dager</th>
                        <th className="text-right py-1.5 font-medium w-32">Avslaget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {avslatteSaker.map((sak) => {
                        const vurdering = formData.vurdering_per_sak?.find(v => v.sak_id === sak.sak_id);
                        const erUberettiget = vurdering?.avslag_berettiget === false;
                        return (
                          <tr key={sak.sak_id} className="border-b border-pkt-border-subtle last:border-b-0">
                            <td className="py-2">
                              <span className="font-medium">{sak.tittel}</span>
                            </td>
                            <td className="text-right py-2 font-mono">{sak.avslatte_dager}</td>
                            <td className="text-right py-2">
                              <Badge variant={erUberettiget ? 'success' : 'danger'}>
                                {erUberettiget ? 'Uberettiget' : 'Berettiget'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-pkt-border-default">
                        <td className="py-2 font-bold">Konklusjon</td>
                        <td className="text-right py-2 font-mono font-bold">
                          {computed.dagerUberettiget}/{computed.totalAvslatteDager}
                        </td>
                        <td className="text-right py-2">
                          <Badge variant={computed.harForseringsrett ? 'success' : 'danger'}>
                            {computed.harForseringsrett ? 'Har rett' : 'Ingen rett'}
                          </Badge>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Beløpsoversikt tabell */}
              <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                <h5 className="font-medium text-sm mb-3">Beløpsvurdering</h5>

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
                      <td className="py-2">Forseringskostnader</td>
                      <td className="text-right font-mono">
                        {formatCurrency(forseringData.estimert_kostnad)}
                      </td>
                      <td className="text-right font-mono">
                        {formData.hovedkrav_vurdering === 'godkjent'
                          ? formatCurrency(forseringData.estimert_kostnad)
                          : formData.hovedkrav_vurdering === 'delvis'
                            ? formatCurrency(formData.godkjent_belop)
                            : formatCurrency(0)}
                      </td>
                      <td className="text-right">
                        {formData.hovedkrav_vurdering === 'godkjent' && <Badge variant="success">Godkjent</Badge>}
                        {formData.hovedkrav_vurdering === 'delvis' && <Badge variant="warning">Delvis</Badge>}
                        {formData.hovedkrav_vurdering === 'avslatt' && <Badge variant="danger">Avvist</Badge>}
                      </td>
                    </tr>

                    {/* Rigg/Drift */}
                    {harRiggKrav && (
                      <>
                        <tr className="border-b border-pkt-border-subtle">
                          <td className="py-2">
                            Rigg/Drift
                            {formData.rigg_varslet_i_tide === false && (
                              <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>
                            )}
                          </td>
                          <td className={`text-right font-mono ${formData.rigg_varslet_i_tide === false ? 'line-through text-pkt-grays-gray-400' : ''}`}>
                            {formatCurrency(forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop)}
                          </td>
                          <td className="text-right font-mono">
                            {formData.rigg_varslet_i_tide === false
                              ? formatCurrency(0)
                              : formData.rigg_vurdering === 'godkjent'
                                ? formatCurrency(forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop)
                                : formData.rigg_vurdering === 'delvis'
                                  ? formatCurrency(formData.godkjent_rigg_drift)
                                  : formatCurrency(0)}
                          </td>
                          <td className="text-right">
                            {formData.rigg_varslet_i_tide === false ? (
                              <Badge variant="danger">Prekludert</Badge>
                            ) : formData.rigg_vurdering === 'godkjent' ? (
                              <Badge variant="success">Godkjent</Badge>
                            ) : formData.rigg_vurdering === 'delvis' ? (
                              <Badge variant="warning">Delvis</Badge>
                            ) : (
                              <Badge variant="danger">Avvist</Badge>
                            )}
                          </td>
                        </tr>
                        {/* Subsidiær rad for prekludert rigg */}
                        {formData.rigg_varslet_i_tide === false && (
                          <tr className="border-b border-pkt-border-subtle bg-alert-warning-bg text-alert-warning-text">
                            <td className="py-2 italic">↳ Subsidiært</td>
                            <td className="text-right font-mono">
                              ({formatCurrency(forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop)})
                            </td>
                            <td className="text-right font-mono">
                              {formData.rigg_vurdering === 'godkjent'
                                ? formatCurrency(forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop)
                                : formData.rigg_vurdering === 'delvis'
                                  ? formatCurrency(formData.godkjent_rigg_drift)
                                  : formatCurrency(0)}
                            </td>
                            <td className="text-right">
                              {formData.rigg_vurdering === 'godkjent' ? (
                                <Badge variant="success">Godkjent</Badge>
                              ) : formData.rigg_vurdering === 'delvis' ? (
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
                          <td className="py-2">
                            Produktivitet
                            {formData.produktivitet_varslet_i_tide === false && (
                              <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>
                            )}
                          </td>
                          <td className={`text-right font-mono ${formData.produktivitet_varslet_i_tide === false ? 'line-through text-pkt-grays-gray-400' : ''}`}>
                            {formatCurrency(forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop)}
                          </td>
                          <td className="text-right font-mono">
                            {formData.produktivitet_varslet_i_tide === false
                              ? formatCurrency(0)
                              : formData.produktivitet_vurdering === 'godkjent'
                                ? formatCurrency(forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop)
                                : formData.produktivitet_vurdering === 'delvis'
                                  ? formatCurrency(formData.godkjent_produktivitet)
                                  : formatCurrency(0)}
                          </td>
                          <td className="text-right">
                            {formData.produktivitet_varslet_i_tide === false ? (
                              <Badge variant="danger">Prekludert</Badge>
                            ) : formData.produktivitet_vurdering === 'godkjent' ? (
                              <Badge variant="success">Godkjent</Badge>
                            ) : formData.produktivitet_vurdering === 'delvis' ? (
                              <Badge variant="warning">Delvis</Badge>
                            ) : (
                              <Badge variant="danger">Avvist</Badge>
                            )}
                          </td>
                        </tr>
                        {/* Subsidiær rad for prekludert produktivitet */}
                        {formData.produktivitet_varslet_i_tide === false && (
                          <tr className="border-b border-pkt-border-subtle bg-alert-warning-bg text-alert-warning-text">
                            <td className="py-2 italic">↳ Subsidiært</td>
                            <td className="text-right font-mono">
                              ({formatCurrency(forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop)})
                            </td>
                            <td className="text-right font-mono">
                              {formData.produktivitet_vurdering === 'godkjent'
                                ? formatCurrency(forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop)
                                : formData.produktivitet_vurdering === 'delvis'
                                  ? formatCurrency(formData.godkjent_produktivitet)
                                  : formatCurrency(0)}
                            </td>
                            <td className="text-right">
                              {formData.produktivitet_vurdering === 'godkjent' ? (
                                <Badge variant="success">Godkjent</Badge>
                              ) : formData.produktivitet_vurdering === 'delvis' ? (
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
                      <td className="text-right font-mono">{formatCurrency(computed.totalKrevd)}</td>
                      <td className="text-right font-mono">{formatCurrency(computed.totalGodkjent)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>

                {/* Mobile: kompakt liste */}
                <div className="sm:hidden space-y-2 text-sm">
                  {/* Hovedkrav */}
                  {(() => {
                    const badge = getVurderingBadge(formData.hovedkrav_vurdering);
                    const godkjent = beregnGodkjentBelopForKrav(
                      formData.hovedkrav_vurdering,
                      forseringData.estimert_kostnad ?? 0,
                      formData.godkjent_belop
                    );
                    return (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium min-w-[100px]">Forsering:</span>
                        <span className="font-mono">{formatCurrency(godkjent)}</span>
                        <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                      </div>
                    );
                  })()}

                  {/* Rigg/Drift */}
                  {harRiggKrav && (() => {
                    const riggPrekludert = formData.rigg_varslet_i_tide === false;
                    const badge = getVurderingBadge(formData.rigg_vurdering, riggPrekludert);
                    const godkjent = beregnGodkjentBelopForKrav(
                      formData.rigg_vurdering,
                      forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop ?? 0,
                      formData.godkjent_rigg_drift,
                      riggPrekludert
                    );
                    return (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium min-w-[100px]">Rigg/drift:</span>
                        <span className="font-mono">{formatCurrency(godkjent)}</span>
                        <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                      </div>
                    );
                  })()}

                  {/* Produktivitet */}
                  {harProduktivitetKrav && (() => {
                    const produktivitetPrekludert = formData.produktivitet_varslet_i_tide === false;
                    const badge = getVurderingBadge(formData.produktivitet_vurdering, produktivitetPrekludert);
                    const godkjent = beregnGodkjentBelopForKrav(
                      formData.produktivitet_vurdering,
                      forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop ?? 0,
                      formData.godkjent_produktivitet,
                      produktivitetPrekludert
                    );
                    return (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium min-w-[100px]">Produktivitet:</span>
                        <span className="font-mono">{formatCurrency(godkjent)}</span>
                        <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                      </div>
                    );
                  })()}

                  {/* Totalt */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 border-t border-pkt-border-subtle font-bold">
                    <span className="min-w-[100px]">TOTALT:</span>
                    <span className="font-mono">{formatCurrency(computed.totalGodkjent)}</span>
                    <span className="text-pkt-text-body-subtle font-normal text-xs">
                      av {formatCurrency(computed.totalKrevd)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resultat */}
              <SectionContainer title="Prinsipalt standpunkt">
                <div className="flex justify-between items-center">
                  <span>Resultat:</span>
                  <Badge
                    variant={
                      prinsipaltResultat === 'godkjent' ? 'success' :
                      prinsipaltResultat === 'delvis_godkjent' ? 'warning' : 'danger'
                    }
                  >
                    {prinsipaltResultat === 'godkjent' ? 'Godkjent' :
                     prinsipaltResultat === 'delvis_godkjent' ? 'Delvis godkjent' : 'Avslått'}
                  </Badge>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Krevd totalt:</span>
                  <strong>{formatCurrency(computed.totalKrevd)}</strong>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Godkjent totalt:</span>
                  <strong>{formatCurrency(computed.totalGodkjent)}</strong>
                </div>
              </SectionContainer>

              {/* Auto-generated begrunnelse */}
              <SectionContainer title="Generert begrunnelse" variant="subtle">
                <div className="text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {autoBegrunnelse}
                </div>
              </SectionContainer>

              {/* Additional comments */}
              <Controller
                name="tilleggs_begrunnelse"
                control={control}
                render={({ field }) => (
                  <FormField label="Tilleggskommentar" optional>
                    <Textarea
                      {...field}
                      placeholder="Legg til ytterligere kommentarer hvis ønskelig..."
                      rows={3}
                      fullWidth
                    />
                  </FormField>
                )}
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between pt-4 border-t-2 border-pkt-border-subtle">
            <div>
              {currentPort > 1 && (
                <Button variant="ghost" type="button" onClick={handlePrevious}>
                  Forrige
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              {currentPort < totalPorts ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNext();
                  }}
                  disabled={!canProceed}
                >
                  Neste
                </Button>
              ) : (
                <Button
                  variant={prinsipaltResultat === 'avslatt' ? 'danger' : 'primary'}
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sender...' : isUpdateMode ? 'Oppdater standpunkt' : 'Send standpunkt'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
