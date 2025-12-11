/**
 * RespondVederlagModal Component
 *
 * Action modal for BH (client) to respond to a vederlag (compensation) claim.
 * Uses a 4-port wizard model based on NS 8407 requirements.
 *
 * WIZARD STRUCTURE:
 * - Port 1: Særskilte krav - Preklusjon (§34.1.3) - Only for rigg/drift/produktivitet
 * - Port 2: Metode & Svarplikt - Method acceptance, EP-justering, tilbakeholdelse
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

import { useState, useMemo, useCallback } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { CurrencyInput } from '../primitives/CurrencyInput';
import { Textarea } from '../primitives/Textarea';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { StepIndicator } from '../primitives/StepIndicator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/Select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import {
  VEDERLAGSMETODER_OPTIONS,
  getVederlagsmetodeLabel,
  VEDERLAGSMETODE_DESCRIPTIONS,
  type VederlagsMetode,
} from '../../constants';
import { differenceInDays } from 'date-fns';
import type { SubsidiaerTrigger } from '../../types/timeline';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// Vurdering options for beløp
type BelopVurdering = 'godkjent' | 'delvis' | 'avvist';

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
  grunnlagStatus?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent';
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const respondVederlagSchema = z.object({
  // Port 1: Særskilte krav preklusjon (kun §34.1.3)
  rigg_varslet_i_tide: z.boolean().optional(),
  produktivitet_varslet_i_tide: z.boolean().optional(),
  begrunnelse_preklusjon: z.string().optional(),

  // Port 2: Metode & Svarplikt
  aksepterer_metode: z.boolean(),
  oensket_metode: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD']).optional(),
  ep_justering_akseptert: z.boolean().optional(),
  hold_tilbake: z.boolean().optional(),
  begrunnelse_metode: z.string().optional(),

  // Port 3: Beløpsvurdering - Hovedkrav
  hovedkrav_vurdering: z.enum(['godkjent', 'delvis', 'avvist']),
  hovedkrav_godkjent_belop: z.number().min(0).optional(),
  hovedkrav_begrunnelse: z.string().optional(),

  // Port 3: Beløpsvurdering - Særskilte (kun hvis ikke prekludert)
  rigg_vurdering: z.enum(['godkjent', 'delvis', 'avvist']).optional(),
  rigg_godkjent_belop: z.number().min(0).optional(),
  produktivitet_vurdering: z.enum(['godkjent', 'delvis', 'avvist']).optional(),
  produktivitet_godkjent_belop: z.number().min(0).optional(),

  // Port 4: Oppsummering
  begrunnelse_samlet: z.string().min(10, 'Samlet begrunnelse må være minst 10 tegn'),
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
    totalKrevd: number;
    totalGodkjent: number;
    harMetodeendring: boolean;
    holdTilbake: boolean;
  }
): string {
  // 1. Tilbakeholdelse (§30.2) has priority
  if (computed.holdTilbake) {
    return 'hold_tilbake';
  }

  // 2. Calculate approval percentage
  const godkjentProsent =
    computed.totalKrevd > 0 ? computed.totalGodkjent / computed.totalKrevd : 0;

  // 3. Total rejection (only for calculation errors, not grunnlag disputes)
  if (godkjentProsent === 0 && data.hovedkrav_vurdering === 'avvist') {
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
  if (godkjentProsent === 0 && data.hovedkrav_vurdering === 'avvist') {
    return 'avslatt';
  }

  // Full approval
  if (godkjentProsent >= 0.99 && !computed.harMetodeendring) {
    return 'godkjent';
  }

  // Method change or partial approval
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
    hold_tilbake: 'Hold tilbake betaling (§30.2)',
  };
  return labels[resultat] || resultat;
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
}: RespondVederlagModalProps) {
  const [currentPort, setCurrentPort] = useState(1);

  // Determine if särskilda krav exists (affects which ports to show)
  const harRiggKrav = vederlagEvent?.saerskilt_krav?.rigg_drift !== undefined;
  const harProduktivitetKrav = vederlagEvent?.saerskilt_krav?.produktivitet !== undefined;
  const harSaerskiltKrav = harRiggKrav || harProduktivitetKrav;

  // Calculate total ports (skip Port 1 if no särskilda krav)
  const startPort = harSaerskiltKrav ? 1 : 2;
  const totalPorts = 4;

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
  } = useForm<RespondVederlagFormData>({
    resolver: zodResolver(respondVederlagSchema),
    defaultValues: {
      aksepterer_metode: true,
      hovedkrav_vurdering: 'godkjent',
      rigg_varslet_i_tide: true,
      produktivitet_varslet_i_tide: true,
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: () => {
      reset();
      setCurrentPort(startPort);
    },
    onClose: () => onOpenChange(false),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      setCurrentPort(startPort);
      onOpenChange(false);
    },
  });

  // Watch all form values for conditional rendering and calculations
  const formValues = watch();

  // Derived state
  const erSubsidiaer = grunnlagStatus === 'avvist_uenig';
  const kanHoldeTilbake =
    vederlagEvent?.metode === 'REGNINGSARBEID' && !vederlagEvent?.kostnads_overslag;
  const maSvarePaJustering =
    vederlagEvent?.metode === 'ENHETSPRISER' && vederlagEvent?.krever_justert_ep;
  const erFastprisTilbud = vederlagEvent?.metode === 'FASTPRIS_TILBUD';

  // Get amounts for display
  const metodeLabel = vederlagEvent?.metode
    ? getVederlagsmetodeLabel(vederlagEvent.metode)
    : undefined;
  const hovedkravBelop =
    vederlagEvent?.metode === 'REGNINGSARBEID'
      ? vederlagEvent?.kostnads_overslag
      : vederlagEvent?.belop_direkte;
  const riggBelop = vederlagEvent?.saerskilt_krav?.rigg_drift?.belop;
  const produktivitetBelop = vederlagEvent?.saerskilt_krav?.produktivitet?.belop;

  // Calculate BH response time for warning
  const dagerSidenKrav = vederlagEvent?.dato_krav_mottatt
    ? differenceInDays(new Date(), new Date(vederlagEvent.dato_krav_mottatt))
    : 0;
  const bhSvarpliktAdvarsel = dagerSidenKrav > 7;

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

    // Hovedkrav
    if (formValues.hovedkrav_vurdering === 'godkjent') {
      totalGodkjent += hovedkravBelop || 0;
    } else if (formValues.hovedkrav_vurdering === 'delvis') {
      totalGodkjent += formValues.hovedkrav_godkjent_belop || 0;
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

    // Subsidiary godkjent (includes precluded særskilte krav evaluations)
    let totalGodkjentInklPrekludert = totalGodkjent;

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
      harPrekludertKrav: riggPrekludert || produktivitetPrekludert,
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

  // Steps configuration
  const steps = useMemo(() => {
    const allSteps = [
      { label: 'Port 1', description: 'Særskilte krav' },
      { label: 'Port 2', description: 'Metode' },
      { label: 'Port 3', description: 'Beløp' },
      { label: 'Port 4', description: 'Oppsummering' },
    ];
    // If no særskilte krav, remove Port 1 from display
    return harSaerskiltKrav ? allSteps : allSteps.slice(1);
  }, [harSaerskiltKrav]);

  // Navigation
  const goToNextPort = useCallback(async () => {
    let isValid = true;

    // Validate current port
    if (currentPort === 1) {
      isValid = await trigger([
        'rigg_varslet_i_tide',
        'produktivitet_varslet_i_tide',
        'begrunnelse_preklusjon',
      ]);
    } else if (currentPort === 2) {
      isValid = await trigger([
        'aksepterer_metode',
        'oensket_metode',
        'ep_justering_akseptert',
        'hold_tilbake',
        'begrunnelse_metode',
      ]);
    } else if (currentPort === 3) {
      isValid = await trigger([
        'hovedkrav_vurdering',
        'hovedkrav_godkjent_belop',
        'rigg_vurdering',
        'rigg_godkjent_belop',
        'produktivitet_vurdering',
        'produktivitet_godkjent_belop',
      ]);
    }

    if (isValid && currentPort < totalPorts) {
      setCurrentPort(currentPort + 1);
    }
  }, [currentPort, totalPorts, trigger]);

  const goToPrevPort = useCallback(() => {
    if (currentPort > startPort) {
      setCurrentPort(currentPort - 1);
    }
  }, [currentPort, startPort]);

  // Submit handler
  const onSubmit = (data: RespondVederlagFormData) => {
    // Beregn subsidiære triggere basert på Port 1 og 2 valg
    const triggers: SubsidiaerTrigger[] = [];
    if (riggPrekludert) triggers.push('preklusjon_rigg');
    if (produktivitetPrekludert) triggers.push('preklusjon_produktivitet');
    // §34.3.3: EP-justering prekludert hvis TE krevde det men BH avviser varselet
    if (vederlagEvent?.krever_justert_ep && data.ep_justering_akseptert === false) {
      triggers.push('preklusjon_ep_justering');
    }
    if (!data.aksepterer_metode) triggers.push('metode_avvist');

    mutation.mutate({
      eventType: 'respons_vederlag',
      data: {
        vederlag_krav_id: vederlagKravId,

        // Port 1: Preklusjon
        rigg_varslet_i_tide: data.rigg_varslet_i_tide,
        produktivitet_varslet_i_tide: data.produktivitet_varslet_i_tide,
        begrunnelse_preklusjon: data.begrunnelse_preklusjon,

        // Port 2: Metode
        aksepterer_metode: data.aksepterer_metode,
        oensket_metode: data.oensket_metode,
        ep_justering_akseptert: data.ep_justering_akseptert,
        hold_tilbake: data.hold_tilbake,
        begrunnelse_metode: data.begrunnelse_metode,

        // Port 3: Beløp
        hovedkrav_vurdering: data.hovedkrav_vurdering,
        hovedkrav_godkjent_belop:
          data.hovedkrav_vurdering === 'godkjent'
            ? hovedkravBelop
            : data.hovedkrav_vurdering === 'delvis'
              ? data.hovedkrav_godkjent_belop
              : 0,
        hovedkrav_begrunnelse: data.hovedkrav_begrunnelse,

        rigg_vurdering: riggPrekludert ? 'prekludert' : data.rigg_vurdering,
        rigg_godkjent_belop: riggPrekludert
          ? 0
          : data.rigg_vurdering === 'godkjent'
            ? riggBelop
            : data.rigg_vurdering === 'delvis'
              ? data.rigg_godkjent_belop
              : 0,

        produktivitet_vurdering: produktivitetPrekludert
          ? 'prekludert'
          : data.produktivitet_vurdering,
        produktivitet_godkjent_belop: produktivitetPrekludert
          ? 0
          : data.produktivitet_vurdering === 'godkjent'
            ? produktivitetBelop
            : data.produktivitet_vurdering === 'delvis'
              ? data.produktivitet_godkjent_belop
              : 0,

        // Port 4: Oppsummering
        begrunnelse: data.begrunnelse_samlet,

        // Automatisk beregnet (prinsipalt)
        resultat: prinsipaltResultat,
        total_godkjent_belop: computed.totalGodkjent,
        total_krevd_belop: computed.totalKrevd,

        // Subsidiært standpunkt (kun når relevant)
        subsidiaer_triggers: triggers.length > 0 ? triggers : undefined,
        subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
        subsidiaer_godkjent_belop: visSubsidiaertResultat
          ? computed.totalGodkjentInklPrekludert
          : undefined,
        subsidiaer_begrunnelse: visSubsidiaertResultat
          ? data.begrunnelse_samlet
          : undefined,
      },
    });
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
      title="Svar på vederlagskrav"
      size="lg"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <StepIndicator
          currentStep={harSaerskiltKrav ? currentPort : currentPort - 1}
          steps={steps}
        />

        {/* BH svarplikt warning */}
        {bhSvarpliktAdvarsel && (
          <Alert variant="danger" title="Svarplikt">
            Du har brukt <strong>{dagerSidenKrav} dager</strong> på å svare. Du skal svare
            &ldquo;uten ugrunnet opphold&rdquo;. Passivitet kan medføre at du taper innsigelser.
          </Alert>
        )}

        {/* Subsidiary treatment info */}
        {erSubsidiaer && (
          <Alert variant="info" title="Subsidiær behandling">
            Du har avvist ansvarsgrunnlaget. Dine svar gjelder derfor kun subsidiært.
          </Alert>
        )}


        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ================================================================
              PORT 1: SÆRSKILTE KRAV - PREKLUSJON (§34.1.3)
              Only shown if there are særskilte krav
              ================================================================ */}
          {currentPort === 1 && harSaerskiltKrav && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <Badge variant="info">Port 1</Badge>
                <h3 className="font-bold text-lg">Særskilte krav - Preklusjon (§34.1.3)</h3>
              </div>

              <Alert variant="warning">
                Disse postene krever særskilt varsel. Ved manglende varsel tapes kravet (§34.1.3).
              </Alert>

              {/* Rigg/Drift */}
              {harRiggKrav && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Rigg/Drift</Badge>
                      <span className="font-mono">
                        kr {riggBelop?.toLocaleString('nb-NO') || 0},-
                      </span>
                    </div>
                    {vederlagEvent?.saerskilt_krav?.rigg_drift?.dato_klar_over && (
                      <span className="text-xs text-pkt-grays-gray-500">
                        Entreprenøren klar over: {vederlagEvent.saerskilt_krav.rigg_drift.dato_klar_over}
                      </span>
                    )}
                  </div>

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
                            label="Nei - varslet for sent → Kravet prekluderes"
                          />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}

              {/* Produktivitet */}
              {harProduktivitetKrav && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Produktivitetstap</Badge>
                      <span className="font-mono">
                        kr {produktivitetBelop?.toLocaleString('nb-NO') || 0},-
                      </span>
                    </div>
                    {vederlagEvent?.saerskilt_krav?.produktivitet?.dato_klar_over && (
                      <span className="text-xs text-pkt-grays-gray-500">
                        Entreprenøren klar over: {vederlagEvent.saerskilt_krav.produktivitet.dato_klar_over}
                      </span>
                    )}
                  </div>

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
                            label="Nei - varslet for sent → Kravet prekluderes"
                          />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}

              {/* Begrunnelse for preklusjon */}
              {(riggPrekludert || produktivitetPrekludert) && (
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
            </div>
          )}

          {/* ================================================================
              PORT 2: METODE & SVARPLIKT
              ================================================================ */}
          {currentPort === 2 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <Badge variant="info">Port 2</Badge>
                <h3 className="font-bold text-lg">Metode & Svarplikt</h3>
              </div>

              {/* Metode aksept */}
              <div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                <FormField
                  label="Aksepterer du den foreslåtte vederlagsmetoden?"
                  required
                  helpText={metodeLabel ? `Foreslått metode: ${metodeLabel}` : undefined}
                >
                  <Controller
                    name="aksepterer_metode"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ? 'ja' : 'nei'}
                        onValueChange={(val: string) => field.onChange(val === 'ja')}
                      >
                        <RadioItem value="ja" label="Ja - aksepterer metoden" />
                        <RadioItem value="nei" label="Nei - krever annen metode" />
                      </RadioGroup>
                    )}
                  />
                </FormField>

                {/* Regningsarbeid: varsling-info */}
                {vederlagEvent?.metode === 'REGNINGSARBEID' &&
                  vederlagEvent?.varslet_for_oppstart === false && (
                    <Alert variant="info" className="mt-3">
                      Entreprenøren har ikke varslet før oppstart – strengere bevisbyrde for
                      nødvendige kostnader (§34.4).
                    </Alert>
                  )}

                {/* Ønsket metode - show when rejecting */}
                {!formValues.aksepterer_metode && (
                  <div className="mt-4 ml-6 border-l-2 border-pkt-border-subtle pl-4">
                    <FormField label="Hvilken metode krever du?" required>
                      <Controller
                        name="oensket_metode"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Velg metode" />
                            </SelectTrigger>
                            <SelectContent>
                              {VEDERLAGSMETODER_OPTIONS.filter(
                                (opt) => opt.value !== '' && opt.value !== vederlagEvent?.metode
                              ).map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </FormField>

                    {/* Konsekvensvarsel for fastpristilbud */}
                    {erFastprisTilbud && (
                      <Alert variant="info" className="mt-3">
                        Ved å avslå fastpristilbudet (§34.2.1), faller oppgjøret tilbake på{' '}
                        <strong>regningsarbeid (§34.4)</strong>, med mindre dere blir enige om noe
                        annet.
                      </Alert>
                    )}

                    <FormField
                      label="Begrunnelse for metodeendring"
                      className="mt-3"
                      helpText="Begrunn hvorfor du krever en annen metode"
                    >
                      <Textarea
                        {...register('begrunnelse_metode')}
                        rows={3}
                        fullWidth
                      />
                    </FormField>
                  </div>
                )}
              </div>

              {/* §34.3.3 EP-justering - SVARPLIKT */}
              {maSvarePaJustering && (
                <div className="space-y-3">
                  <Alert variant="danger" title="Svarplikt: EP-justering (§34.3.3)">
                    Entreprenøren krever justerte enhetspriser. Du må ta stilling til dette nå.
                    Passivitet medfører at kravet anses akseptert.
                  </Alert>
                  <FormField label="Aksepterer du justering av enhetspriser?" required>
                    <Controller
                      name="ep_justering_akseptert"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={
                            field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                          }
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - aksepterer justering" />
                          <RadioItem value="nei" label="Nei - avviser justering" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}

              {/* §30.2 Tilbakeholdelse */}
              {kanHoldeTilbake && (
                <div className="space-y-3">
                  <Alert variant="warning" title="Tilbakeholdelse (§30.2)">
                    Entreprenøren har ikke levert kostnadsoverslag for regningsarbeidet. Du kan holde
                    tilbake betaling inntil overslag mottas.
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
            </div>
          )}

          {/* ================================================================
              PORT 3: BELØPSVURDERING
              ================================================================ */}
          {currentPort === 3 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <Badge variant="info">Port 3</Badge>
                <h3 className="font-bold text-lg">Beløpsvurdering</h3>
              </div>

              <p className="text-sm text-pkt-text-body-subtle mb-4">
                Vurder beløpet for hvert krav. Dette er ren utmåling - ansvarsvurdering håndteres i
                Grunnlag-sporet.
              </p>

              {/* HOVEDKRAV */}
              <div className="p-4 bg-pkt-surface-subtle rounded-none border-2 border-pkt-border-default">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <h4 className="font-bold">Hovedkrav</h4>
                  <div className="text-left sm:text-right">
                    <span className="text-sm text-pkt-text-body-subtle">Krevd: </span>
                    <span className="text-lg font-mono font-bold">
                      kr {hovedkravBelop?.toLocaleString('nb-NO') || 0},-
                    </span>
                  </div>
                </div>

                <FormField label="Din vurdering av beløpet" required>
                  <Controller
                    name="hovedkrav_vurdering"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup value={field.value} onValueChange={field.onChange}>
                        <RadioItem value="godkjent" label="Godkjent fullt ut" />
                        <RadioItem value="delvis" label="Delvis godkjent" />
                        <RadioItem value="avvist" label="Avvist" />
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

                {/* Begrunnelse - show when not godkjent */}
                {formValues.hovedkrav_vurdering !== 'godkjent' && (
                  <FormField label="Begrunnelse" className="mt-4">
                    <Textarea
                      {...register('hovedkrav_begrunnelse')}
                      rows={2}
                      fullWidth
                      placeholder="Begrunn din vurdering..."
                    />
                  </FormField>
                )}
              </div>

              {/* RIGG/DRIFT - alltid evaluerbar (subsidiært hvis prekludert) */}
              {harRiggKrav && (
                <div
                  className={`p-4 rounded-none border-2 ${
                    riggPrekludert
                      ? 'bg-pkt-surface-yellow border-pkt-border-yellow'
                      : 'bg-pkt-surface-subtle border-pkt-border-default'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold">Særskilt: Rigg/Drift</h4>
                      {riggPrekludert && (
                        <>
                          <Badge variant="danger">PREKLUDERT</Badge>
                          <Badge variant="warning">Subsidiært</Badge>
                        </>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-sm text-pkt-text-body-subtle">Krevd: </span>
                      <span
                        className={`text-lg font-mono font-bold ${riggPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}
                      >
                        kr {riggBelop?.toLocaleString('nb-NO') || 0},-
                      </span>
                    </div>
                  </div>

                  {riggPrekludert && (
                    <div className="mb-4 p-3 bg-pkt-surface-strong-yellow rounded-none">
                      <p className="text-sm text-pkt-text-body-dark">
                        <strong>Prinsipalt:</strong> Kravet er prekludert (for sen varsling §34.1.3).
                        Godkjent beløp: <strong>kr 0,-</strong>
                      </p>
                      <p className="text-sm text-pkt-text-body-dark mt-1">
                        <strong>Subsidiært:</strong> Evaluer beløpet dersom kravet hadde vært varslet
                        i tide.
                      </p>
                    </div>
                  )}

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
                          <RadioItem value="avvist" label="Avvist" />
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
                <div
                  className={`p-4 rounded-none border-2 ${
                    produktivitetPrekludert
                      ? 'bg-pkt-surface-yellow border-pkt-border-yellow'
                      : 'bg-pkt-surface-subtle border-pkt-border-default'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold">Særskilt: Produktivitetstap</h4>
                      {produktivitetPrekludert && (
                        <>
                          <Badge variant="danger">PREKLUDERT</Badge>
                          <Badge variant="warning">Subsidiært</Badge>
                        </>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-sm text-pkt-text-body-subtle">Krevd: </span>
                      <span
                        className={`text-lg font-mono font-bold ${produktivitetPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}
                      >
                        kr {produktivitetBelop?.toLocaleString('nb-NO') || 0},-
                      </span>
                    </div>
                  </div>

                  {produktivitetPrekludert && (
                    <div className="mb-4 p-3 bg-pkt-surface-strong-yellow rounded-none">
                      <p className="text-sm text-pkt-text-body-dark">
                        <strong>Prinsipalt:</strong> Kravet er prekludert (for sen varsling §34.1.3).
                        Godkjent beløp: <strong>kr 0,-</strong>
                      </p>
                      <p className="text-sm text-pkt-text-body-dark mt-1">
                        <strong>Subsidiært:</strong> Evaluer beløpet dersom kravet hadde vært varslet
                        i tide.
                      </p>
                    </div>
                  )}

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
                          <RadioItem value="avvist" label="Avvist" />
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
                {/* Metode */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-2">Metode (Port 2)</h5>
                  <div className="flex items-center gap-2">
                    {formValues.aksepterer_metode ? (
                      <Badge variant="success">Akseptert</Badge>
                    ) : (
                      <>
                        <Badge variant="warning">Endret</Badge>
                        <span className="text-sm">
                          → {formValues.oensket_metode && getVederlagsmetodeLabel(formValues.oensket_metode)}
                        </span>
                      </>
                    )}
                  </div>
                  {maSvarePaJustering && (
                    <div className="mt-2 text-sm">
                      EP-justering:{' '}
                      {formValues.ep_justering_akseptert ? (
                        <Badge variant="success">Akseptert</Badge>
                      ) : (
                        <Badge variant="danger">Avvist</Badge>
                      )}
                    </div>
                  )}
                  {formValues.hold_tilbake && (
                    <div className="mt-2">
                      <Badge variant="warning">Betaling holdes tilbake (§30.2)</Badge>
                    </div>
                  )}
                </div>

                {/* Beløpsoversikt */}
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                  <h5 className="font-medium text-sm mb-3">Beløpsvurdering (Port 3)</h5>

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
                          {formValues.hovedkrav_vurdering === 'godkjent'
                            ? hovedkravBelop?.toLocaleString('nb-NO') || 0
                            : formValues.hovedkrav_vurdering === 'delvis'
                              ? formValues.hovedkrav_godkjent_belop?.toLocaleString('nb-NO') || 0
                              : 0}
                        </td>
                        <td className="text-right">
                          {formValues.hovedkrav_vurdering === 'godkjent' && (
                            <Badge variant="success">Godkjent</Badge>
                          )}
                          {formValues.hovedkrav_vurdering === 'delvis' && (
                            <Badge variant="warning">Delvis</Badge>
                          )}
                          {formValues.hovedkrav_vurdering === 'avvist' && (
                            <Badge variant="danger">Avvist</Badge>
                          )}
                        </td>
                      </tr>

                      {/* Rigg/Drift */}
                      {harRiggKrav && (
                        <>
                          <tr className="border-b border-pkt-border-subtle">
                            <td className="py-2">
                              Rigg/Drift
                              {riggPrekludert && (
                                <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>
                              )}
                            </td>
                            <td
                              className={`text-right font-mono ${riggPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}
                            >
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
                          {/* Subsidiary row for precluded rigg */}
                          {riggPrekludert && (
                            <tr className="border-b border-pkt-border-subtle bg-pkt-surface-yellow">
                              <td className="py-2 text-pkt-text-body-dark italic">
                                ↳ Subsidiært
                              </td>
                              <td className="text-right font-mono text-pkt-text-body-dark">
                                ({riggBelop?.toLocaleString('nb-NO') || 0})
                              </td>
                              <td className="text-right font-mono text-pkt-text-body-dark">
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
                            <td className="py-2">
                              Produktivitet
                              {produktivitetPrekludert && (
                                <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>
                              )}
                            </td>
                            <td
                              className={`text-right font-mono ${produktivitetPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}
                            >
                              {produktivitetBelop?.toLocaleString('nb-NO') || 0}
                            </td>
                            <td className="text-right font-mono">
                              {produktivitetPrekludert
                                ? 0
                                : formValues.produktivitet_vurdering === 'godkjent'
                                  ? produktivitetBelop?.toLocaleString('nb-NO') || 0
                                  : formValues.produktivitet_vurdering === 'delvis'
                                    ? formValues.produktivitet_godkjent_belop?.toLocaleString(
                                        'nb-NO'
                                      ) || 0
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
                          {/* Subsidiary row for precluded produktivitet */}
                          {produktivitetPrekludert && (
                            <tr className="border-b border-pkt-border-subtle bg-pkt-surface-yellow">
                              <td className="py-2 text-pkt-text-body-dark italic">
                                ↳ Subsidiært
                              </td>
                              <td className="text-right font-mono text-pkt-text-body-dark">
                                ({produktivitetBelop?.toLocaleString('nb-NO') || 0})
                              </td>
                              <td className="text-right font-mono text-pkt-text-body-dark">
                                {formValues.produktivitet_vurdering === 'godkjent'
                                  ? produktivitetBelop?.toLocaleString('nb-NO') || 0
                                  : formValues.produktivitet_vurdering === 'delvis'
                                    ? formValues.produktivitet_godkjent_belop?.toLocaleString(
                                        'nb-NO'
                                      ) || 0
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
                          {computed.totalKrevd.toLocaleString('nb-NO')}
                        </td>
                        <td className="text-right font-mono">
                          {computed.totalGodkjent.toLocaleString('nb-NO')}
                        </td>
                        <td className="text-right">
                          {computed.totalKrevd > 0 && (
                            <span className="text-sm">
                              {((computed.totalGodkjent / computed.totalKrevd) * 100).toFixed(1)}%
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
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">Hovedkrav</span>
                        {formValues.hovedkrav_vurdering === 'godkjent' && (
                          <Badge variant="success">Godkjent</Badge>
                        )}
                        {formValues.hovedkrav_vurdering === 'delvis' && (
                          <Badge variant="warning">Delvis</Badge>
                        )}
                        {formValues.hovedkrav_vurdering === 'avvist' && (
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
                          {formValues.hovedkrav_vurdering === 'godkjent'
                            ? hovedkravBelop?.toLocaleString('nb-NO') || 0
                            : formValues.hovedkrav_vurdering === 'delvis'
                              ? formValues.hovedkrav_godkjent_belop?.toLocaleString('nb-NO') || 0
                              : 0}
                        </span>
                      </div>
                    </div>

                    {/* Rigg/Drift card */}
                    {harRiggKrav && (
                      <div className={`p-3 border rounded-none ${riggPrekludert ? 'border-pkt-border-yellow bg-pkt-surface-yellow' : 'border-pkt-border-subtle'}`}>
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                          <span className="font-medium">
                            Rigg/Drift
                            {riggPrekludert && <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>}
                          </span>
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
                          <span className={`font-mono ${riggPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}>
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
                          <div className="mt-2 pt-2 border-t border-pkt-border-yellow">
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span className="italic text-pkt-text-body-dark">↳ Subsidiært</span>
                              {formValues.rigg_vurdering === 'godkjent' ? (
                                <Badge variant="success">Godkjent</Badge>
                              ) : formValues.rigg_vurdering === 'delvis' ? (
                                <Badge variant="warning">Delvis</Badge>
                              ) : (
                                <Badge variant="danger">Avvist</Badge>
                              )}
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-pkt-text-body-dark">Subs. godkjent:</span>
                              <span className="font-mono text-pkt-text-body-dark">
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
                      <div className={`p-3 border rounded-none ${produktivitetPrekludert ? 'border-pkt-border-yellow bg-pkt-surface-yellow' : 'border-pkt-border-subtle'}`}>
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                          <span className="font-medium">
                            Produktivitet
                            {produktivitetPrekludert && <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>}
                          </span>
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
                          <span className={`font-mono ${produktivitetPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}>
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
                          <div className="mt-2 pt-2 border-t border-pkt-border-yellow">
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span className="italic text-pkt-text-body-dark">↳ Subsidiært</span>
                              {formValues.produktivitet_vurdering === 'godkjent' ? (
                                <Badge variant="success">Godkjent</Badge>
                              ) : formValues.produktivitet_vurdering === 'delvis' ? (
                                <Badge variant="warning">Delvis</Badge>
                              ) : (
                                <Badge variant="danger">Avvist</Badge>
                              )}
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-pkt-text-body-dark">Subs. godkjent:</span>
                              <span className="font-mono text-pkt-text-body-dark">
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
                    <div className="p-3 border-2 border-pkt-border-default rounded-none bg-pkt-surface-subtle">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold">TOTALT</span>
                        {computed.totalKrevd > 0 && (
                          <span className="text-sm font-medium">
                            {((computed.totalGodkjent / computed.totalKrevd) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-pkt-text-body-subtle">Krevd:</span>
                        <span className="font-mono font-bold">{computed.totalKrevd.toLocaleString('nb-NO')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-pkt-text-body-subtle">Godkjent:</span>
                        <span className="font-mono font-bold">{computed.totalGodkjent.toLocaleString('nb-NO')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Automatisk beregnet resultat - Prinsipalt */}
                <div className="p-4 bg-pkt-surface-strong-dark-blue text-white rounded-none">
                  <h5 className="font-medium text-sm mb-2 opacity-80">
                    {visSubsidiaertResultat ? 'PRINSIPALT RESULTAT' : 'AUTOMATISK BEREGNET RESULTAT'}
                  </h5>
                  <div className="text-xl font-bold">{getResultatLabel(prinsipaltResultat)}</div>
                  <div className="mt-2 text-lg font-mono">
                    Samlet godkjent: kr {computed.totalGodkjent.toLocaleString('nb-NO')},-
                  </div>
                </div>

                {/* Subsidiært resultat - kun når særskilte krav er prekludert */}
                {visSubsidiaertResultat && (
                  <div className="p-4 bg-pkt-surface-yellow border-2 border-pkt-surface-strong-yellow rounded-none">
                    <h5 className="font-medium text-sm mb-2 text-pkt-text-body-dark">
                      SUBSIDIÆRT RESULTAT
                    </h5>
                    <p className="text-sm text-pkt-text-body-dark mb-3">
                      Dersom de prekluderte særskilte kravene hadde vært varslet i tide:
                    </p>
                    <div className="text-xl font-bold text-pkt-text-body-dark">
                      {getResultatLabel(subsidiaertResultat)}
                    </div>
                    <div className="mt-2 text-lg font-mono text-pkt-text-body-dark">
                      Samlet godkjent (inkludert subsidiært):{' '}
                      kr {computed.totalGodkjentInklPrekludert.toLocaleString('nb-NO')},-
                    </div>
                    <p className="text-sm text-pkt-text-body-dark mt-3 italic">
                      «Byggherren er etter dette uenig i kravet, og kan dessuten under ingen
                      omstendigheter se at kr{' '}
                      {computed.totalGodkjentInklPrekludert.toLocaleString('nb-NO')},- er berettiget
                      å kreve.»
                    </p>
                  </div>
                )}

                {/* Samlet begrunnelse */}
                <FormField
                  label="Samlet begrunnelse"
                  required
                  error={errors.begrunnelse_samlet?.message}
                  helpText="Oppsummer din vurdering av kravet"
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
              {currentPort > startPort && (
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

              {currentPort < totalPorts ? (
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
