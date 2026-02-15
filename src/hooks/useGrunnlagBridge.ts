import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { GrunnlagResponsResultat, SakState } from '../types/timeline';
import { getConsequence } from '../components/bento/consequenceCallout';
import { useSubmitEvent } from './useSubmitEvent';
import { useFormBackup } from './useFormBackup';
import { useCatendaStatusHandler } from './useCatendaStatusHandler';
import { useToast } from '../components/primitives';
import * as grunnlagDomain from '../domain/grunnlagDomain';

// ============================================================================
// TYPES
// ============================================================================

export interface UseGrunnlagBridgeConfig {
  isOpen: boolean;
  sakId: string;
  grunnlagEventId: string;
  grunnlagEvent?: {
    hovedkategori?: string;
    underkategori?: string;
    beskrivelse?: string;
    dato_oppdaget?: string;
    dato_varslet?: string;
  };
  lastResponseEvent?: {
    event_id: string;
    resultat: GrunnlagResponsResultat;
  };
  sakState?: SakState;
  // Callbacks
  onSuccess: () => void;
  onCatendaWarning?: () => void;
  // Approval
  approvalEnabled?: boolean;
  onSaveDraft?: (draftData: {
    resultat: string;
    begrunnelse: string;
    formData: Record<string, unknown>;
  }) => void;
}

export interface GrunnlagEditState {
  // §32.2 Varsling
  varsletITide: boolean;
  onVarsletITideChange: (v: boolean) => void;
  showVarsletToggle: boolean;

  // Resultat verdict
  resultat: string | undefined;
  onResultatChange: (v: string) => void;
  resultatError: boolean;

  // Verdict options
  verdictOptions: grunnlagDomain.VerdictOption[];

  // Computed display
  erPrekludert: boolean;
  consequence: { variant: 'success' | 'warning' | 'danger' | 'info'; text: string; snuoperasjonText?: string } | null;

  // Card actions
  onClose: () => void;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  submitError: string | null;
  submitLabel: string;
  submitVariant: 'primary' | 'danger';
  showTokenExpired: boolean;
  onTokenExpiredClose: () => void;

  // Context alerts
  erPassiv: boolean;
  dagerSidenVarsel: number;
  isUpdateMode: boolean;
  erSnuoperasjon: boolean;
  snuoperasjon?: {
    erSubsidiaertVederlag: boolean;
    erSubsidiaertFrist: boolean;
    visningsstatusVederlag?: string;
    visningsstatusFrist?: string;
  };

  // Update mode context
  updateContext?: {
    forrigeResultat: GrunnlagResponsResultat;
    forrigeBegrunnelse?: string;
    harSubsidiaereSvar: boolean;
  };
}

export type { VerdictOption } from '../domain/grunnlagDomain';

export interface GrunnlagEditorProps {
  begrunnelse: string;
  onBegrunnelseChange: (value: string) => void;
  begrunnelseError?: string;
  placeholder: string;
  autoBegrunnelse: string;
  onRegenerate: () => void;
  showRegenerate: boolean;
}

export interface GrunnlagBridgeReturn {
  cardProps: GrunnlagEditState;
  editorProps: GrunnlagEditorProps;
}

// ============================================================================
// HOOK
// ============================================================================

export function useGrunnlagBridge(config: UseGrunnlagBridgeConfig): GrunnlagBridgeReturn {
  const {
    isOpen,
    sakId,
    grunnlagEventId,
    grunnlagEvent,
    lastResponseEvent,
    sakState,
    onSuccess,
    onCatendaWarning,
    approvalEnabled = false,
    onSaveDraft,
  } = config;

  const isUpdateMode = !!lastResponseEvent;
  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });

  // ========== TOKEN EXPIRED ==========
  const [showTokenExpired, setShowTokenExpired] = useState(false);

  // ========== DERIVED CONFIG (for domain functions) ==========
  const forrigeResultat = lastResponseEvent?.resultat;
  const harSubsidiaereSvar = !!(sakState?.er_subsidiaert_vederlag || sakState?.er_subsidiaert_frist);

  const domainConfig = useMemo((): grunnlagDomain.GrunnlagDomainConfig => ({
    grunnlagEvent,
    isUpdateMode,
    forrigeResultat,
    harSubsidiaereSvar,
  }), [grunnlagEvent, isUpdateMode, forrigeResultat, harSubsidiaereSvar]);

  // ========== STATE ==========
  const getDefaults = useCallback(
    () => grunnlagDomain.getDefaults({ isUpdateMode, lastResponseEvent }),
    [isUpdateMode, lastResponseEvent],
  );

  const [formState, setFormState] = useState<grunnlagDomain.GrunnlagFormState>(getDefaults);

  // ========== BEGRUNNELSE TRACKING (L5 — declared early for reset block) ==========
  const userHasEditedBegrunnelseRef = useRef(false);

  // ========== FORM BACKUP ==========
  const eventType = isUpdateMode ? 'respons_grunnlag_oppdatert' : 'respons_grunnlag';
  const backupData = useMemo(
    () => ({ begrunnelse: formState.begrunnelse }),
    [formState.begrunnelse]
  );
  const begrunnelseIsDirty = formState.begrunnelse.length > 0;
  const { clearBackup, getBackup } = useFormBackup(
    sakId, eventType, backupData, begrunnelseIsDirty
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
        restoredBackupRef.current = true;
      } else {
        setFormState(defaults);
      }
      setShowTokenExpired(false);
      userHasEditedBegrunnelseRef.current = !!backup?.begrunnelse;
    }
  }

  // Show toast after backup restore (can't toast during render)
  useEffect(() => {
    if (restoredBackupRef.current) {
      restoredBackupRef.current = false;
      toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
    }
  }, [isOpen, toast]);

  const { varsletITide, resultat, resultatError, begrunnelse, begrunnelseValidationError } = formState;

  // ========== DOMAIN COMPUTATIONS (pure TypeScript) ==========
  const isEndring = grunnlagDomain.erEndringMed32_2(grunnlagEvent);
  const isPrekludert = grunnlagDomain.erPrekludert(formState, domainConfig);
  const passivitet = useMemo(
    () => grunnlagDomain.beregnPassivitet(grunnlagEvent),
    [grunnlagEvent],
  );
  const isSnuoperasjon = grunnlagDomain.erSnuoperasjon(formState, domainConfig);
  const verdictOptions = useMemo(
    () => grunnlagDomain.getVerdictOptions(domainConfig),
    [domainConfig],
  );
  const dynamicPlaceholder = useMemo(
    () => grunnlagDomain.getDynamicPlaceholder(resultat, isPrekludert),
    [resultat, isPrekludert],
  );

  const isForceMajeure = grunnlagDomain.erForceMajeure(grunnlagEvent);
  const showVarsletToggle = isEndring;

  // ========== CONSEQUENCE (uses existing consequenceCallout.ts) ==========
  const consequence = useMemo(() => getConsequence({
    resultat,
    erEndringMed32_2: isEndring,
    varsletITide,
    erForceMajeure: isForceMajeure,
    erSnuoperasjon: isSnuoperasjon,
    harSubsidiaereSvar,
  }), [resultat, isEndring, varsletITide, isForceMajeure, isSnuoperasjon, harSubsidiaereSvar]);

  // ========== SUBMIT MUTATION ==========
  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      onSuccess();
      toast.success(
        isUpdateMode ? 'Svar oppdatert' : 'Svar sendt',
        isUpdateMode
          ? 'Din endring av svaret på ansvarsgrunnlaget er registrert.'
          : 'Ditt svar på ansvarsgrunnlaget er registrert.'
      );
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

  // ========== INDIVIDUAL SETTERS ==========
  const handleVarsletITideChange = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, varsletITide: v }));
  }, []);

  const handleResultatChange = useCallback((v: string) => {
    setFormState(prev => ({ ...prev, resultat: v, resultatError: false }));
  }, []);

  const handleBegrunnelseChange = useCallback((value: string) => {
    userHasEditedBegrunnelseRef.current = true;
    setFormState(prev => ({
      ...prev,
      begrunnelse: value,
      begrunnelseValidationError: undefined,
    }));
  }, []);

  // ========== AUTO-BEGRUNNELSE (L5 — placeholder ready) ==========
  const autoBegrunnelse = useMemo(() => {
    return '';
  }, []);

  // Auto-populate begrunnelse when auto-begrunnelse changes (if not manually edited)
  useEffect(() => {
    if (autoBegrunnelse && !userHasEditedBegrunnelseRef.current) {
      setFormState(prev => ({ ...prev, begrunnelse: autoBegrunnelse }));
    }
  }, [autoBegrunnelse]);

  const handleRegenerate = useCallback(() => {
    if (autoBegrunnelse) {
      setFormState(prev => ({ ...prev, begrunnelse: autoBegrunnelse }));
      userHasEditedBegrunnelseRef.current = false;
    }
  }, [autoBegrunnelse]);

  // ========== VALIDATE + SUBMIT ==========
  const canSubmit = !!resultat && begrunnelse.length >= 10 && !mutation.isPending;

  const handleSubmit = useCallback(() => {
    if (!resultat) {
      setFormState(prev => ({ ...prev, resultatError: true }));
      return;
    }
    if (begrunnelse.length < 10) {
      setFormState(prev => ({
        ...prev,
        begrunnelseValidationError: 'Begrunnelse må være minst 10 tegn',
      }));
      return;
    }

    pendingToastId.current = toast.pending(
      isUpdateMode ? 'Lagrer endringer...' : 'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    const eventData = grunnlagDomain.buildEventData(formState, {
      ...domainConfig,
      grunnlagEventId,
      lastResponseEventId: lastResponseEvent?.event_id,
    });
    mutation.mutate({ eventType, data: eventData });
  }, [resultat, begrunnelse, isUpdateMode, eventType, formState, domainConfig, grunnlagEventId, lastResponseEvent, mutation, toast]);

  const handleSaveDraft = useCallback(() => {
    if (!onSaveDraft || !resultat) return;
    if (begrunnelse.length < 10) {
      setFormState(prev => ({
        ...prev,
        begrunnelseValidationError: 'Begrunnelse må være minst 10 tegn',
      }));
      return;
    }

    const eventData = grunnlagDomain.buildEventData(formState, {
      ...domainConfig,
      grunnlagEventId,
      lastResponseEventId: lastResponseEvent?.event_id,
    });
    onSaveDraft({ resultat, begrunnelse, formData: eventData });

    clearBackup();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på ansvarsgrunnlaget er lagret som utkast.');
  }, [onSaveDraft, resultat, begrunnelse, formState, domainConfig, grunnlagEventId, lastResponseEvent, clearBackup, onSuccess, toast]);

  // ========== SUBMIT LABEL + VARIANT ==========
  const submitLabel = useMemo(() => {
    if (mutation.isPending) return 'Sender...';
    if (isUpdateMode) return isSnuoperasjon ? 'Godkjenn ansvarsgrunnlag' : 'Lagre endring';
    return 'Send svar';
  }, [mutation.isPending, isUpdateMode, isSnuoperasjon]);

  const submitVariant = (resultat === 'avslatt' || isPrekludert) ? 'danger' as const : 'primary' as const;

  // ========== RETURN ==========
  return {
    cardProps: {
      varsletITide,
      onVarsletITideChange: handleVarsletITideChange,
      showVarsletToggle,

      resultat,
      onResultatChange: handleResultatChange,
      resultatError,

      verdictOptions,

      erPrekludert: isPrekludert,
      consequence,

      // Card actions
      onClose: onSuccess,
      onSubmit: handleSubmit,
      onSaveDraft: approvalEnabled && onSaveDraft ? handleSaveDraft : undefined,
      isSubmitting: mutation.isPending,
      canSubmit,
      submitError: mutation.isError
        ? (mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod')
        : null,
      submitLabel,
      submitVariant,
      showTokenExpired,
      onTokenExpiredClose: () => setShowTokenExpired(false),

      // Context alerts
      erPassiv: passivitet.erPassiv,
      dagerSidenVarsel: passivitet.dagerSidenVarsel,
      isUpdateMode,
      erSnuoperasjon: isSnuoperasjon,
      snuoperasjon: isSnuoperasjon && harSubsidiaereSvar ? {
        erSubsidiaertVederlag: !!sakState?.er_subsidiaert_vederlag,
        erSubsidiaertFrist: !!sakState?.er_subsidiaert_frist,
        visningsstatusVederlag: sakState?.visningsstatus_vederlag,
        visningsstatusFrist: sakState?.visningsstatus_frist,
      } : undefined,

      // Update mode context
      updateContext: isUpdateMode && forrigeResultat ? {
        forrigeResultat,
        forrigeBegrunnelse: sakState?.grunnlag?.bh_begrunnelse,
        harSubsidiaereSvar,
      } : undefined,
    },
    editorProps: {
      begrunnelse,
      onBegrunnelseChange: handleBegrunnelseChange,
      begrunnelseError: begrunnelseValidationError,
      placeholder: dynamicPlaceholder,
      autoBegrunnelse,
      onRegenerate: handleRegenerate,
      showRegenerate: !!autoBegrunnelse,
    },
  };
}
