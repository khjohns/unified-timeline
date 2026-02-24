/**
 * useVederlagSubmissionBridge.ts — React adapter for TE vederlag submission.
 *
 * Bridge hook following ADR-003 pattern:
 * - Bridge owns all state, submit mutation, form backup
 * - Returns cardProps for VederlagCard's teEditState
 * - Wraps vederlagSubmissionDomain.ts (pure TS logic)
 *
 * Key differences from useVederlagBridge.ts (BH response):
 * - No auto-begrunnelse (TE writes their own)
 * - Method selection + amount inputs instead of vurdering controls
 * - Different event types (vederlag_krav_sendt / vederlag_krav_oppdatert)
 * - Card-internal two-column layout (L21)
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { EventType } from '../types/timeline';
import type { VederlagsMetode } from '../constants/paymentMethods';
import { useSubmitEvent } from './useSubmitEvent';
import { useFormBackup } from './useFormBackup';
import { useCatendaStatusHandler } from './useCatendaStatusHandler';
import { useToast } from '../components/primitives';
import * as domain from '../domain/vederlagSubmissionDomain';

// ============================================================================
// TYPES
// ============================================================================

export interface UseVederlagSubmissionBridgeConfig {
  isOpen: boolean;
  sakId: string;
  grunnlagEventId: string;
  scenario: domain.VederlagSubmissionScenario;
  datoOppdaget?: string;
  existing?: domain.VederlagSubmissionDefaultsConfig['existing'];
  originalEventId?: string;
  onSuccess: () => void;
  onCatendaWarning?: () => void;
}

export interface VederlagTeEditState {
  // Metode
  metode: VederlagsMetode | undefined;
  onMetodeChange: (v: VederlagsMetode) => void;

  // Beløp
  belopDirekte: number | undefined;
  onBelopDirekteChange: (v: number | undefined) => void;
  showBelopDirekte: boolean;

  kostnadsOverslag: number | undefined;
  onKostnadsOverslagChange: (v: number | undefined) => void;
  showKostnadsOverslag: boolean;

  // ENHETSPRISER-specific: justert EP (§34.3.3)
  kreverJustertEp: boolean;
  onKreverJustertEpChange: (v: boolean) => void;
  showJustertEp: boolean;

  // REGNINGSARBEID-specific: varslet for oppstart (§34.4)
  varsletForOppstart: boolean;
  onVarsletForOppstartChange: (v: boolean) => void;
  showVarsletForOppstart: boolean;

  // Særskilte krav (§34.1.3)
  harRiggKrav: boolean;
  onHarRiggKravChange: (v: boolean) => void;
  belopRigg: number | undefined;
  onBelopRiggChange: (v: number | undefined) => void;
  datoKlarOverRigg: string | undefined;
  onDatoKlarOverRiggChange: (v: string) => void;

  harProduktivitetKrav: boolean;
  onHarProduktivitetKravChange: (v: boolean) => void;
  belopProduktivitet: number | undefined;
  onBelopProduktivitetChange: (v: number | undefined) => void;
  datoKlarOverProduktivitet: string | undefined;
  onDatoKlarOverProduktivitetChange: (v: string) => void;

  // Computed
  statusSummary: string | null;

  // Begrunnelse (integrated in card — L21)
  begrunnelse: string;
  onBegrunnelseChange: (v: string) => void;
  begrunnelseError: string | undefined;
  begrunnelsePlaceholder: string;

  // Actions (L12)
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  submitError: string | null;
  submitLabel: string;
  showTokenExpired: boolean;
  onTokenExpiredClose: () => void;
}

export interface VederlagSubmissionBridgeReturn {
  cardProps: VederlagTeEditState;
}

// ============================================================================
// HOOK
// ============================================================================

export function useVederlagSubmissionBridge(
  config: UseVederlagSubmissionBridgeConfig,
): VederlagSubmissionBridgeReturn {
  const {
    isOpen,
    sakId,
    grunnlagEventId,
    scenario,
    datoOppdaget,
    existing,
    onSuccess,
    onCatendaWarning,
  } = config;

  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });

  // ========== TOKEN EXPIRED ==========
  const [showTokenExpired, setShowTokenExpired] = useState(false);

  // ========== DEFAULTS ==========
  const getDefaults = useCallback(
    () => domain.getDefaults({ scenario, existing }),
    [scenario, existing],
  );

  // ========== STATE (L1: consolidated FormState) ==========
  const [formState, setFormState] = useState<domain.VederlagSubmissionFormState>(getDefaults);

  // ========== FORM BACKUP ==========
  const backupData = useMemo(
    () => ({ begrunnelse: formState.begrunnelse }),
    [formState.begrunnelse],
  );
  const begrunnelseIsDirty = formState.begrunnelse.length > 0;
  const eventType = domain.getEventType({ scenario });
  const { clearBackup, getBackup } = useFormBackup(
    sakId, eventType, backupData, begrunnelseIsDirty,
  );

  // ========== RESET (state-during-render per L2) ==========
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const restoredBackupRef = useRef(false);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      const defaults = getDefaults();
      const backup = getBackup();
      if (backup?.begrunnelse) {
        setFormState({ ...defaults, begrunnelse: backup.begrunnelse });
        // eslint-disable-next-line react-hooks/refs -- L2 pattern: one-shot flag for post-render effect
        restoredBackupRef.current = true;
      } else {
        setFormState(defaults);
      }
      setShowTokenExpired(false);
    }
  }

  // Show toast after backup restore
  useEffect(() => {
    if (restoredBackupRef.current) {
      restoredBackupRef.current = false;
      toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
    }
  }, [isOpen, toast]);

  // ========== DESTRUCTURE ==========
  const {
    metode,
    belopDirekte,
    kostnadsOverslag,
    kreverJustertEp,
    varsletForOppstart,
    harRiggKrav,
    belopRigg,
    datoKlarOverRigg,
    harProduktivitetKrav,
    belopProduktivitet,
    datoKlarOverProduktivitet,
    begrunnelse,
    begrunnelseValidationError,
  } = formState;

  // ========== DOMAIN COMPUTATIONS (pure TS, memoized) ==========
  const visibility = useMemo(
    () => domain.beregnVisibility(formState),
    [formState],
  );

  const dynamicPlaceholder = useMemo(
    () => domain.getDynamicPlaceholder(metode),
    [metode],
  );

  const existingBelop = useMemo(() => {
    if (!existing) return undefined;
    if (existing.metode === 'REGNINGSARBEID') return existing.kostnads_overslag;
    return existing.belop_direkte;
  }, [existing]);

  const statusSummary = useMemo(
    () => domain.beregnTeStatusSummary(formState, { scenario, existingBelop }),
    [formState, scenario, existingBelop],
  );

  // ========== SUBMIT MUTATION (L12) ==========
  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      onSuccess();
      toast.success('Krav sendt', 'Vederlagskravet er registrert.');
      handleCatendaStatus(result);
    },
    onError: (error) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  // ========== canSubmit ==========
  const canSubmitFinal = useMemo(
    () => domain.beregnCanSubmit(formState) && !mutation.isPending,
    [formState, mutation.isPending],
  );

  // ========== INDIVIDUAL SETTERS (L1) ==========
  const handleMetodeChange = useCallback((v: VederlagsMetode) => {
    setFormState(prev => ({
      ...prev,
      metode: v,
      // Reset method-specific fields when changing method
      ...(v === 'REGNINGSARBEID' ? { belopDirekte: undefined, kreverJustertEp: false } : {}),
      ...(v !== 'REGNINGSARBEID' ? { kostnadsOverslag: undefined, varsletForOppstart: true } : {}),
      ...(v !== 'ENHETSPRISER' ? { kreverJustertEp: false } : {}),
    }));
  }, []);

  const handleBelopDirekteChange = useCallback((v: number | undefined) => {
    setFormState(prev => ({ ...prev, belopDirekte: v }));
  }, []);

  const handleKostnadsOverslagChange = useCallback((v: number | undefined) => {
    setFormState(prev => ({ ...prev, kostnadsOverslag: v }));
  }, []);

  const handleKreverJustertEpChange = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, kreverJustertEp: v }));
  }, []);

  const handleVarsletForOppstartChange = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, varsletForOppstart: v }));
  }, []);

  const handleHarRiggKravChange = useCallback((v: boolean) => {
    setFormState(prev => ({
      ...prev,
      harRiggKrav: v,
      ...(v === false ? { belopRigg: undefined, datoKlarOverRigg: undefined } : {}),
    }));
  }, []);

  const handleBelopRiggChange = useCallback((v: number | undefined) => {
    setFormState(prev => ({ ...prev, belopRigg: v }));
  }, []);

  const handleDatoKlarOverRiggChange = useCallback((v: string) => {
    setFormState(prev => ({ ...prev, datoKlarOverRigg: v }));
  }, []);

  const handleHarProduktivitetKravChange = useCallback((v: boolean) => {
    setFormState(prev => ({
      ...prev,
      harProduktivitetKrav: v,
      ...(v === false ? { belopProduktivitet: undefined, datoKlarOverProduktivitet: undefined } : {}),
    }));
  }, []);

  const handleBelopProduktivitetChange = useCallback((v: number | undefined) => {
    setFormState(prev => ({ ...prev, belopProduktivitet: v }));
  }, []);

  const handleDatoKlarOverProduktivitetChange = useCallback((v: string) => {
    setFormState(prev => ({ ...prev, datoKlarOverProduktivitet: v }));
  }, []);

  const handleBegrunnelseChange = useCallback((value: string) => {
    setFormState(prev => ({
      ...prev,
      begrunnelse: value,
      begrunnelseValidationError: undefined,
    }));
  }, []);

  // ========== VALIDATE + SUBMIT ==========
  const handleSubmit = useCallback(() => {
    // Validate begrunnelse
    if (begrunnelse.length < 10) {
      setFormState(prev => ({
        ...prev,
        begrunnelseValidationError: 'Begrunnelse må være minst 10 tegn',
      }));
      return;
    }

    pendingToastId.current = toast.pending(
      'Sender krav...',
      'Vennligst vent mens kravet behandles.',
    );

    const buildConfig: domain.VederlagSubmissionBuildConfig = {
      scenario,
      grunnlagEventId,
      datoOppdaget,
      originalEventId: config.originalEventId,
    };

    const eventData = domain.buildEventData(formState, buildConfig);
    mutation.mutate({
      eventType: eventType as EventType,
      data: eventData,
    });
  }, [
    begrunnelse, formState, scenario, grunnlagEventId,
    datoOppdaget, config.originalEventId, eventType, mutation, toast,
  ]);

  const submitLabel = (() => {
    if (mutation.isPending) return 'Sender...';
    if (scenario === 'edit') return 'Oppdater krav';
    return 'Send krav';
  })();

  // ========== RETURN (L11: unified cardProps) ==========
  return {
    cardProps: {
      // Metode
      metode,
      onMetodeChange: handleMetodeChange,

      // Beløp
      belopDirekte,
      onBelopDirekteChange: handleBelopDirekteChange,
      showBelopDirekte: visibility.showBelopDirekte,

      kostnadsOverslag,
      onKostnadsOverslagChange: handleKostnadsOverslagChange,
      showKostnadsOverslag: visibility.showKostnadsOverslag,

      // ENHETSPRISER: justert EP
      kreverJustertEp,
      onKreverJustertEpChange: handleKreverJustertEpChange,
      showJustertEp: visibility.showJustertEp,

      // REGNINGSARBEID: varslet for oppstart
      varsletForOppstart,
      onVarsletForOppstartChange: handleVarsletForOppstartChange,
      showVarsletForOppstart: visibility.showVarsletForOppstart,

      // Særskilte krav
      harRiggKrav,
      onHarRiggKravChange: handleHarRiggKravChange,
      belopRigg,
      onBelopRiggChange: handleBelopRiggChange,
      datoKlarOverRigg,
      onDatoKlarOverRiggChange: handleDatoKlarOverRiggChange,

      harProduktivitetKrav,
      onHarProduktivitetKravChange: handleHarProduktivitetKravChange,
      belopProduktivitet,
      onBelopProduktivitetChange: handleBelopProduktivitetChange,
      datoKlarOverProduktivitet,
      onDatoKlarOverProduktivitetChange: handleDatoKlarOverProduktivitetChange,

      // Computed
      statusSummary,

      // Begrunnelse
      begrunnelse,
      onBegrunnelseChange: handleBegrunnelseChange,
      begrunnelseError: begrunnelseValidationError,
      begrunnelsePlaceholder: dynamicPlaceholder,

      // Actions
      onClose: onSuccess,
      onSubmit: handleSubmit,
      isSubmitting: mutation.isPending,
      canSubmit: canSubmitFinal,
      submitError: mutation.isError
        ? (mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod')
        : null,
      submitLabel,
      showTokenExpired,
      onTokenExpiredClose: () => setShowTokenExpired(false),
    },
  };
}
