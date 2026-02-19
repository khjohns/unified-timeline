/**
 * useFristSubmissionBridge.ts — React adapter for TE frist submission.
 *
 * Bridge hook following ADR-003 pattern:
 * - Bridge owns all state, submit mutation, form backup
 * - Returns cardProps + editorProps for components
 * - Wraps fristSubmissionDomain.ts (pure TS logic)
 *
 * Key differences from useFristBridge.ts (BH response):
 * - No auto-begrunnelse (TE writes their own)
 * - Segmented control state instead of yes/no evaluations
 * - Different event types per scenario
 * - Simpler computed values (no resultat/subsidiaert)
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { EventType, FristVarselType } from '../types/timeline';
import { useSubmitEvent } from './useSubmitEvent';
import { useFormBackup } from './useFormBackup';
import { useCatendaStatusHandler } from './useCatendaStatusHandler';
import { useToast } from '../components/primitives';
import * as domain from '../domain/fristSubmissionDomain';

// ============================================================================
// TYPES
// ============================================================================

export interface UseFristSubmissionBridgeConfig {
  isOpen: boolean;
  sakId: string;
  grunnlagEventId: string;
  scenario: domain.SubmissionScenario;
  existingVarselDato?: string;
  existing?: domain.FristSubmissionDefaultsConfig['existing'];
  datoOppdaget?: string;
  harMottattForesporsel?: boolean;
  bhResponse?: {
    resultat: string;
    godkjent_dager?: number;
    begrunnelse?: string;
  };
  originalEventId?: string;
  fristForSpesifisering?: string;
  onSuccess: () => void;
  onCatendaWarning?: () => void;
}

export interface FristTeEditState {
  // Kravtype
  varselType: FristVarselType | undefined;
  onVarselTypeChange: (v: FristVarselType) => void;
  showSegmentedControl: boolean;
  segmentOptions: { value: string; label: string }[];

  // §33.4 Varsel
  tidligereVarslet: boolean;
  onTidligereVarsletChange: (v: boolean) => void;
  varselDato: string | undefined;
  onVarselDatoChange: (v: string) => void;
  showVarselSection: boolean;

  // §33.6.1 Krav
  antallDager: number;
  onAntallDagerChange: (v: number) => void;
  nySluttdato: string | undefined;
  onNySluttdatoChange: (v: string | undefined) => void;
  showKravSection: boolean;

  // Computed
  preklusjonsvarsel: { variant: 'warning' | 'danger'; dager: number } | null;
  showForesporselAlert: boolean;

  // Begrunnelse (integrated)
  begrunnelse: string;
  onBegrunnelseChange: (v: string) => void;
  begrunnelseError: string | undefined;
  begrunnelsePlaceholder: string;
  begrunnelseRequired: boolean;

  // Actions (L12)
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  submitError: string | null;
  submitLabel: string;
  showTokenExpired: boolean;
  onTokenExpiredClose: () => void;
  revisionContext: domain.RevisionContext | null;
}

export interface FristSubmissionBridgeReturn {
  cardProps: FristTeEditState;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFristSubmissionBridge(
  config: UseFristSubmissionBridgeConfig,
): FristSubmissionBridgeReturn {
  const {
    isOpen,
    sakId,
    grunnlagEventId,
    scenario,
    existingVarselDato,
    existing,
    datoOppdaget,
    harMottattForesporsel,
    onSuccess,
    onCatendaWarning,
  } = config;

  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });

  // ========== TOKEN EXPIRED ==========
  const [showTokenExpired, setShowTokenExpired] = useState(false);

  // ========== DEFAULTS ==========
  const getDefaults = useCallback(
    () => domain.getDefaults({ scenario, existingVarselDato, existing }),
    [scenario, existingVarselDato, existing],
  );

  // ========== STATE (L1: consolidated FormState) ==========
  const [formState, setFormState] = useState<domain.FristSubmissionFormState>(getDefaults);

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
  // Uses ref + state-during-render pattern matching useFristBridge.ts.
  // The ref write during render is intentional — it's a one-shot flag
  // consumed by the effect below and is part of the L2 pattern.
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
    varselType,
    tidligereVarslet,
    varselDato,
    antallDager,
    nySluttdato,
    begrunnelse,
    begrunnelseValidationError,
  } = formState;

  // ========== DOMAIN COMPUTATIONS (pure TS, memoized) ==========
  const visibilityConfig = useMemo(
    (): domain.FristSubmissionVisibilityConfig => ({ scenario }),
    [scenario],
  );

  const visibility = useMemo(
    () => domain.beregnVisibility(formState, visibilityConfig),
    [formState, visibilityConfig],
  );

  const preklusjonsvarsel = useMemo(
    () => domain.beregnPreklusjonsvarsel({ datoOppdaget }),
    [datoOppdaget],
  );

  const dynamicPlaceholder = useMemo(
    () => domain.getDynamicPlaceholder(varselType),
    [varselType],
  );

  const revisionContext = useMemo(
    () => domain.beregnRevisionContext({
      scenario,
      bhResponse: config.bhResponse,
      krevdDager: existing?.antall_dager,
      foresporselDeadline: config.fristForSpesifisering,
    }),
    [scenario, config.bhResponse, existing?.antall_dager, config.fristForSpesifisering],
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
      toast.success('Krav sendt', 'Fristkravet er registrert.');
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

  // ========== canSubmit (after mutation is defined) ==========
  const canSubmitFinal = useMemo(
    () => domain.beregnCanSubmit(formState, visibilityConfig) && !mutation.isPending,
    [formState, visibilityConfig, mutation.isPending],
  );

  // ========== INDIVIDUAL SETTERS (L1: useCallback with functional updates) ==========
  const handleVarselTypeChange = useCallback((v: FristVarselType) => {
    setFormState(prev => ({ ...prev, varselType: v }));
  }, []);

  const handleTidligereVarsletChange = useCallback((v: boolean) => {
    setFormState(prev => ({
      ...prev,
      tidligereVarslet: v,
      ...(v === false ? { varselDato: undefined } : {}),
    }));
  }, []);

  const handleVarselDatoChange = useCallback((v: string) => {
    setFormState(prev => ({ ...prev, varselDato: v }));
  }, []);

  const handleAntallDagerChange = useCallback((v: number) => {
    setFormState(prev => ({ ...prev, antallDager: v }));
  }, []);

  const handleNySluttdatoChange = useCallback((v: string | undefined) => {
    setFormState(prev => ({ ...prev, nySluttdato: v }));
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
    // Validate begrunnelse for types that require it
    if (visibility.begrunnelseRequired && begrunnelse.length < 10) {
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

    const buildConfig: domain.FristSubmissionBuildConfig = {
      scenario,
      grunnlagEventId,
      erSvarPaForesporsel: harMottattForesporsel,
      originalEventId: config.originalEventId,
    };

    const eventData = domain.buildEventData(formState, buildConfig);
    mutation.mutate({
      eventType: eventType as EventType,
      data: eventData,
    });
  }, [
    visibility.begrunnelseRequired, begrunnelse, formState,
    scenario, grunnlagEventId, harMottattForesporsel, config.originalEventId, eventType, mutation, toast,
  ]);

  const submitLabel = (() => {
    if (mutation.isPending) return 'Sender...';
    if (varselType === 'varsel') return 'Send varsel';
    if (scenario === 'foresporsel') return 'Send svar';
    if (scenario === 'edit') return 'Oppdater krav';
    return 'Send krav';
  })();

  // ========== RETURN (L11: unified cardProps) ==========
  return {
    cardProps: {
      // Kravtype
      varselType,
      onVarselTypeChange: handleVarselTypeChange,
      showSegmentedControl: visibility.showSegmentedControl,
      segmentOptions: visibility.segmentOptions,

      // §33.4 Varsel
      tidligereVarslet,
      onTidligereVarsletChange: handleTidligereVarsletChange,
      varselDato,
      onVarselDatoChange: handleVarselDatoChange,
      showVarselSection: visibility.showVarselSection,

      // §33.6.1 Krav
      antallDager,
      onAntallDagerChange: handleAntallDagerChange,
      nySluttdato,
      onNySluttdatoChange: handleNySluttdatoChange,
      showKravSection: visibility.showKravSection,

      // Begrunnelse
      begrunnelse,
      onBegrunnelseChange: handleBegrunnelseChange,
      begrunnelseError: begrunnelseValidationError,
      begrunnelsePlaceholder: dynamicPlaceholder,
      begrunnelseRequired: visibility.begrunnelseRequired,

      // Computed
      preklusjonsvarsel,
      showForesporselAlert: visibility.showForesporselAlert,

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
      revisionContext,
    },
  };
}
