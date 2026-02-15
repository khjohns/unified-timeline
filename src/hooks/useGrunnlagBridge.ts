import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { differenceInDays } from 'date-fns';
import type { GrunnlagResponsResultat, SakState } from '../types/timeline';
import { getConsequence } from '../components/bento/consequenceCallout';
import { useSubmitEvent } from './useSubmitEvent';
import { useFormBackup } from './useFormBackup';
import { useCatendaStatusHandler } from './useCatendaStatusHandler';
import { useToast } from '../components/primitives';

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
  verdictOptions: VerdictOption[];

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

export interface VerdictOption {
  value: string;
  label: string;
  description: string;
  icon: 'check' | 'cross' | 'undo';
  colorScheme: 'green' | 'red' | 'gray';
}

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

  // ========== STATE (consolidated per L1 — now includes begrunnelse) ==========

  interface FormState {
    varsletITide: boolean;
    resultat: string | undefined;
    resultatError: boolean;
    begrunnelse: string;
    begrunnelseValidationError: string | undefined;
  }

  const getDefaults = useCallback((): FormState => {
    if (isUpdateMode && lastResponseEvent) {
      return {
        varsletITide: true,
        resultat: lastResponseEvent.resultat,
        resultatError: false,
        begrunnelse: '',
        begrunnelseValidationError: undefined,
      };
    }
    return {
      varsletITide: true,
      resultat: undefined,
      resultatError: false,
      begrunnelse: '',
      begrunnelseValidationError: undefined,
    };
  }, [isUpdateMode, lastResponseEvent]);

  const [formState, setFormState] = useState<FormState>(getDefaults);

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

  // ========== DERIVED VALUES ==========

  const erEndringMed32_2 = useMemo(() => {
    return grunnlagEvent?.hovedkategori === 'ENDRING' &&
      grunnlagEvent?.underkategori !== 'EO';
  }, [grunnlagEvent?.hovedkategori, grunnlagEvent?.underkategori]);

  const erPaalegg = useMemo(() => {
    return grunnlagEvent?.hovedkategori === 'ENDRING' &&
      (grunnlagEvent?.underkategori === 'IRREG' || grunnlagEvent?.underkategori === 'VALGRETT');
  }, [grunnlagEvent?.hovedkategori, grunnlagEvent?.underkategori]);

  const erForceMajeure = grunnlagEvent?.hovedkategori === 'FORCE_MAJEURE';

  const erPrekludert = erEndringMed32_2 && varsletITide === false;

  // BH passivity (§32.3)
  const dagerSidenVarsel = grunnlagEvent?.dato_varslet
    ? differenceInDays(new Date(), new Date(grunnlagEvent.dato_varslet))
    : 0;

  const erPassiv = erEndringMed32_2 && dagerSidenVarsel > 10;

  // Show varslet toggle: ENDRING except EO
  const showVarsletToggle = erEndringMed32_2;

  // Snuoperasjon detection (update mode)
  const forrigeResultat = lastResponseEvent?.resultat;
  const varAvvist = forrigeResultat === 'avslatt';
  const harSubsidiaereSvar = !!(sakState?.er_subsidiaert_vederlag || sakState?.er_subsidiaert_frist);

  const erSnuoperasjon = useMemo(() => {
    if (!isUpdateMode || !varAvvist) return false;
    return resultat === 'godkjent';
  }, [isUpdateMode, varAvvist, resultat]);

  // ========== VERDICT OPTIONS ==========

  const verdictOptions = useMemo((): VerdictOption[] => {
    const opts: VerdictOption[] = [
      { value: 'godkjent', label: 'Godkjent', description: 'Grunnlag anerkjent', icon: 'check', colorScheme: 'green' },
      { value: 'avslatt', label: 'Avslått', description: 'Grunnlag avvist', icon: 'cross', colorScheme: 'red' },
    ];
    if (erPaalegg) {
      opts.push({ value: 'frafalt', label: 'Frafalt', description: 'Pålegget frafalles', icon: 'undo', colorScheme: 'gray' });
    }
    return opts;
  }, [erPaalegg]);

  // ========== CONSEQUENCE (L3 — in card, not form) ==========

  const consequence = useMemo(() => getConsequence({
    resultat,
    erEndringMed32_2,
    varsletITide,
    erForceMajeure,
    erSnuoperasjon,
    harSubsidiaereSvar,
  }), [resultat, erEndringMed32_2, varsletITide, erForceMajeure, erSnuoperasjon, harSubsidiaereSvar]);

  // ========== DYNAMIC PLACEHOLDER ==========

  const dynamicPlaceholder = useMemo(() => {
    if (!resultat) return 'Velg resultat i kortet til venstre, deretter skriv begrunnelse...';
    if (erPrekludert && resultat === 'godkjent') return 'Begrunn din preklusjonsinnsigelse og din subsidiære godkjenning...';
    if (erPrekludert && resultat === 'avslatt') return 'Begrunn din preklusjonsinnsigelse og ditt subsidiære avslag...';
    if (resultat === 'godkjent') return 'Begrunn din vurdering av ansvarsgrunnlaget...';
    if (resultat === 'avslatt') return 'Forklar hvorfor forholdet ikke gir grunnlag for krav...';
    if (resultat === 'frafalt') return 'Begrunn hvorfor pålegget frafalles...';
    return 'Begrunn din vurdering...';
  }, [resultat, erPrekludert]);

  // ========== AUTO-BEGRUNNELSE (L5 — placeholder ready) ==========

  const autoBegrunnelse = useMemo(() => {
    // Grunnlag has simpler reasoning than frist — auto-begrunnelse is a stub
    // ready for future implementation. The bridge owns the slot per L5.
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

  // ========== BUILD EVENT DATA (L12 — internal) ==========

  const buildEventData = useCallback((): Record<string, unknown> => {
    if (isUpdateMode && lastResponseEvent) {
      return {
        original_respons_id: lastResponseEvent.event_id,
        resultat,
        begrunnelse,
        dato_endret: new Date().toISOString().split('T')[0],
      };
    }

    return {
      grunnlag_event_id: grunnlagEventId,
      resultat,
      begrunnelse,
      grunnlag_varslet_i_tide: erEndringMed32_2 ? varsletITide : undefined,
      dager_siden_varsel: dagerSidenVarsel > 0 ? dagerSidenVarsel : undefined,
    };
  }, [isUpdateMode, lastResponseEvent, resultat, begrunnelse, grunnlagEventId, erEndringMed32_2, varsletITide, dagerSidenVarsel]);

  // ========== VALIDATE + SUBMIT ==========

  const canSubmit = !!resultat && begrunnelse.length >= 10 && !mutation.isPending;

  const handleSubmit = useCallback(() => {
    // Validate resultat
    if (!resultat) {
      setFormState(prev => ({ ...prev, resultatError: true }));
      return;
    }
    // Validate begrunnelse
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

    mutation.mutate({
      eventType,
      data: buildEventData(),
    });
  }, [resultat, begrunnelse, isUpdateMode, eventType, buildEventData, mutation, toast]);

  const handleSaveDraft = useCallback(() => {
    if (!onSaveDraft || !resultat) return;
    if (begrunnelse.length < 10) {
      setFormState(prev => ({
        ...prev,
        begrunnelseValidationError: 'Begrunnelse må være minst 10 tegn',
      }));
      return;
    }

    onSaveDraft({
      resultat,
      begrunnelse,
      formData: buildEventData(),
    });

    clearBackup();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på ansvarsgrunnlaget er lagret som utkast.');
  }, [onSaveDraft, resultat, begrunnelse, buildEventData, clearBackup, onSuccess, toast]);

  // ========== SUBMIT LABEL + VARIANT ==========
  const submitLabel = useMemo(() => {
    if (mutation.isPending) return 'Sender...';
    if (isUpdateMode) return erSnuoperasjon ? 'Godkjenn ansvarsgrunnlag' : 'Lagre endring';
    return 'Send svar';
  }, [mutation.isPending, isUpdateMode, erSnuoperasjon]);

  const submitVariant = (resultat === 'avslatt' || erPrekludert) ? 'danger' as const : 'primary' as const;

  // ========== RETURN ==========

  return {
    cardProps: {
      // Existing controls
      varsletITide,
      onVarsletITideChange: handleVarsletITideChange,
      showVarsletToggle,

      resultat,
      onResultatChange: handleResultatChange,
      resultatError,

      verdictOptions,

      erPrekludert,
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
      erPassiv,
      dagerSidenVarsel,
      isUpdateMode,
      erSnuoperasjon,
      snuoperasjon: erSnuoperasjon && harSubsidiaereSvar ? {
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
