import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { FristBeregningResultat } from '../types/timeline';
import {
  generateFristResponseBegrunnelse,
  type FristResponseInput,
} from '../utils/begrunnelseGenerator';
import { useSubmitEvent } from './useSubmitEvent';
import { useFormBackup } from './useFormBackup';
import { useCatendaStatusHandler } from './useCatendaStatusHandler';
import { useToast } from '../components/primitives';
import * as fristDomain from '../domain/fristDomain';

// ============================================================================
// TYPES
// ============================================================================

export interface UseFristBridgeConfig {
  isOpen: boolean;
  sakId: string;
  fristKravId: string;
  krevdDager: number;
  varselType?: 'varsel' | 'spesifisert' | 'begrunnelse_utsatt';
  grunnlagStatus?: string;
  grunnlagVarsletForSent?: boolean;
  fristTilstand?: Partial<{
    frist_varsel_ok: boolean;
    spesifisert_krav_ok: boolean;
    foresporsel_svar_ok: boolean;
    vilkar_oppfylt: boolean;
    har_bh_foresporsel: boolean;
    frist_varsel: unknown;
  }>;
  lastResponseEvent?: {
    event_id: string;
    resultat: FristBeregningResultat;
    godkjent_dager?: number;
    begrunnelse?: string;
  };
  // Callbacks
  onSuccess: () => void;
  onCatendaWarning?: () => void;
  // Approval
  approvalEnabled?: boolean;
  onSaveDraft?: (draftData: Record<string, unknown>) => void;
}

export interface FristEditState {
  // Port 1: Varsling
  fristVarselOk: boolean;
  onFristVarselOkChange: (v: boolean) => void;
  showFristVarselOk: boolean;

  spesifisertKravOk: boolean;
  onSpesifisertKravOkChange: (v: boolean) => void;
  showSpesifisertKravOk: boolean;

  foresporselSvarOk: boolean;
  onForesporselSvarOkChange: (v: boolean) => void;
  showForesporselSvarOk: boolean;

  sendForesporsel: boolean;
  onSendForesporselChange: (v: boolean) => void;
  showSendForesporsel: boolean;

  // Port 2: Vilkår
  vilkarOppfylt: boolean;
  onVilkarOppfyltChange: (v: boolean) => void;

  // Port 3: Beregning
  godkjentDager: number;
  onGodkjentDagerChange: (v: number) => void;
  showGodkjentDager: boolean;

  // Computed display flags
  erPrekludert: boolean;
  erRedusert: boolean;
  port2ErSubsidiaer: boolean;
  port3ErSubsidiaer: boolean;
  erSvarPaForesporsel: boolean;
  erGrunnlagSubsidiaer: boolean;
  beregningsResultat: string | undefined;
  visSubsidiaertResultat: boolean;
  subsidiaertResultat: string | undefined;
  krevdDager: number;

  // Card actions
  onClose: () => void;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  submitError: string | null;
  submitLabel: string;
  showTokenExpired: boolean;
  onTokenExpiredClose: () => void;

  // Context alert
  sendForesporselInfo: boolean;
}

export interface FristEditorProps {
  begrunnelse: string;
  onBegrunnelseChange: (value: string) => void;
  begrunnelseError?: string;
  placeholder: string;
  autoBegrunnelse: string;
  onRegenerate: () => void;
  showRegenerate: boolean;
}

export interface FristBridgeReturn {
  cardProps: FristEditState;
  editorProps: FristEditorProps;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFristBridge(config: UseFristBridgeConfig): FristBridgeReturn {
  const {
    isOpen,
    sakId,
    fristKravId,
    krevdDager,
    varselType,
    grunnlagStatus,
    grunnlagVarsletForSent,
    fristTilstand,
    lastResponseEvent,
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
  const harTidligereFristVarsel = !!fristTilstand?.frist_varsel;
  const harTidligereVarselITide = harTidligereFristVarsel && fristTilstand?.frist_varsel_ok === true;
  const erSvarPaForesporsel = fristTilstand?.har_bh_foresporsel === true && varselType === 'spesifisert';
  const erHelFristSubsidiaerPgaGrunnlag = grunnlagVarsletForSent === true;
  const erGrunnlagSubsidiaer = grunnlagStatus === 'avslatt' || erHelFristSubsidiaerPgaGrunnlag;

  const domainConfig = useMemo((): fristDomain.FristDomainConfig => ({
    varselType,
    krevdDager,
    erSvarPaForesporsel,
    harTidligereVarselITide,
    erGrunnlagSubsidiaer,
    erHelFristSubsidiaerPgaGrunnlag,
  }), [varselType, krevdDager, erSvarPaForesporsel, harTidligereVarselITide, erGrunnlagSubsidiaer, erHelFristSubsidiaerPgaGrunnlag]);

  // ========== STATE ==========
  const getDefaults = useCallback(
    () => fristDomain.getDefaults({
      krevdDager,
      isUpdateMode,
      lastResponseEvent,
      fristTilstand,
    }),
    [isUpdateMode, lastResponseEvent, fristTilstand, krevdDager],
  );

  const [formState, setFormState] = useState<fristDomain.FristFormState>(getDefaults);

  // ========== FORM BACKUP ==========
  const backupData = useMemo(
    () => ({ begrunnelse: formState.begrunnelse }),
    [formState.begrunnelse]
  );
  const begrunnelseIsDirty = formState.begrunnelse.length > 0;
  const { clearBackup, getBackup } = useFormBackup(
    sakId, 'respons_frist', backupData, begrunnelseIsDirty
  );

  // ========== RESET (state-during-render per L2) ==========
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const restoredBackupRef = useRef(false);
  const userHasEditedBegrunnelseRef = useRef(false);

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

  // Show toast after backup restore
  useEffect(() => {
    if (restoredBackupRef.current) {
      restoredBackupRef.current = false;
      toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
    }
  }, [isOpen, toast]);

  const { fristVarselOk, spesifisertKravOk, foresporselSvarOk, vilkarOppfylt, sendForesporsel, godkjentDager, begrunnelse, begrunnelseValidationError } = formState;

  // ========== DOMAIN COMPUTATIONS (pure TypeScript, memoized) ==========
  const computed = useMemo(
    () => fristDomain.beregnAlt(formState, domainConfig),
    [formState, domainConfig],
  );

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
      toast.success('Svar sendt', 'Ditt svar på fristkravet er registrert.');
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
  const handleFristVarselOkChange = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, fristVarselOk: v, ...(v === false ? { sendForesporsel: false } : {}) }));
  }, []);
  const setSpesifisertKravOk = useCallback((v: boolean) => setFormState(prev => ({ ...prev, spesifisertKravOk: v })), []);
  const setForesporselSvarOk = useCallback((v: boolean) => setFormState(prev => ({ ...prev, foresporselSvarOk: v })), []);
  const setVilkarOppfylt = useCallback((v: boolean) => setFormState(prev => ({ ...prev, vilkarOppfylt: v })), []);
  const setSendForesporsel = useCallback((v: boolean) => setFormState(prev => ({ ...prev, sendForesporsel: v })), []);
  const setGodkjentDager = useCallback((v: number) => setFormState(prev => ({ ...prev, godkjentDager: v })), []);

  // ========== BEGRUNNELSE TRACKING (L5) ==========
  const handleBegrunnelseChange = useCallback((value: string) => {
    userHasEditedBegrunnelseRef.current = true;
    setFormState(prev => ({
      ...prev,
      begrunnelse: value,
      begrunnelseValidationError: undefined,
    }));
  }, []);

  // ========== AUTO-BEGRUNNELSE ==========
  const erForesporselSvarForSent = erSvarPaForesporsel && foresporselSvarOk === false;

  const autoBegrunnelse = useMemo(() => {
    if (!computed.prinsipaltResultat) return '';
    const input: FristResponseInput = {
      varselType,
      krevdDager,
      fristVarselOk,
      spesifisertKravOk,
      foresporselSvarOk,
      sendForesporsel,
      vilkarOppfylt,
      godkjentDager,
      erPrekludert: computed.erPrekludert,
      erForesporselSvarForSent,
      erRedusert_33_6_1: computed.erRedusert,
      harTidligereVarselITide,
      erGrunnlagSubsidiaer,
      erGrunnlagPrekludert: erHelFristSubsidiaerPgaGrunnlag,
      prinsipaltResultat: computed.prinsipaltResultat,
      subsidiaertResultat: computed.subsidiaertResultat,
      visSubsidiaertResultat: computed.visSubsidiaertResultat,
    };
    return generateFristResponseBegrunnelse(input, { useTokens: true });
  }, [
    varselType, krevdDager, fristVarselOk, spesifisertKravOk,
    foresporselSvarOk, sendForesporsel, vilkarOppfylt, godkjentDager,
    computed.prinsipaltResultat, computed.erPrekludert, erForesporselSvarForSent,
    computed.erRedusert, harTidligereVarselITide, erGrunnlagSubsidiaer,
    erHelFristSubsidiaerPgaGrunnlag, computed.subsidiaertResultat, computed.visSubsidiaertResultat,
  ]);

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
  const canSubmit = !!computed.prinsipaltResultat && begrunnelse.length >= 10 && !mutation.isPending;

  const handleSubmit = useCallback(() => {
    if (begrunnelse.length < 10) {
      setFormState(prev => ({
        ...prev,
        begrunnelseValidationError: 'Begrunnelse må være minst 10 tegn',
      }));
      return;
    }

    pendingToastId.current = toast.pending(
      'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    const eventData = fristDomain.buildEventData(formState, domainConfig, computed, fristKravId, autoBegrunnelse);
    mutation.mutate({
      eventType: 'respons_frist',
      data: eventData,
    });
  }, [begrunnelse, formState, domainConfig, computed, fristKravId, autoBegrunnelse, mutation, toast]);

  const handleSaveDraft = useCallback(() => {
    if (!onSaveDraft) return;
    if (begrunnelse.length < 10) {
      setFormState(prev => ({
        ...prev,
        begrunnelseValidationError: 'Begrunnelse må være minst 10 tegn',
      }));
      return;
    }

    onSaveDraft({
      dager: godkjentDager,
      resultat: computed.prinsipaltResultat,
      begrunnelse: begrunnelse || autoBegrunnelse,
    });
    clearBackup();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på fristkravet er lagret som utkast.');
  }, [onSaveDraft, godkjentDager, computed.prinsipaltResultat, begrunnelse, autoBegrunnelse, clearBackup, onSuccess, toast]);

  const submitLabel = mutation.isPending ? 'Sender...' : 'Send svar';

  // ========== RETURN ==========
  return {
    cardProps: {
      fristVarselOk,
      onFristVarselOkChange: handleFristVarselOkChange,
      showFristVarselOk: computed.visibility.showFristVarselOk,

      spesifisertKravOk,
      onSpesifisertKravOkChange: setSpesifisertKravOk,
      showSpesifisertKravOk: computed.visibility.showSpesifisertKravOk,

      foresporselSvarOk,
      onForesporselSvarOkChange: setForesporselSvarOk,
      showForesporselSvarOk: computed.visibility.showForesporselSvarOk,

      sendForesporsel,
      onSendForesporselChange: setSendForesporsel,
      showSendForesporsel: computed.visibility.showSendForesporsel,

      vilkarOppfylt,
      onVilkarOppfyltChange: setVilkarOppfylt,

      godkjentDager,
      onGodkjentDagerChange: setGodkjentDager,
      showGodkjentDager: computed.showGodkjentDager,

      erPrekludert: computed.erPrekludert,
      erRedusert: computed.erRedusert,
      port2ErSubsidiaer: computed.port2ErSubsidiaer,
      port3ErSubsidiaer: computed.port3ErSubsidiaer,
      erSvarPaForesporsel,
      erGrunnlagSubsidiaer,
      beregningsResultat: computed.prinsipaltResultat,
      visSubsidiaertResultat: computed.visSubsidiaertResultat,
      subsidiaertResultat: computed.subsidiaertResultat,
      krevdDager,

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
      showTokenExpired,
      onTokenExpiredClose: () => setShowTokenExpired(false),

      // Context alert
      sendForesporselInfo: sendForesporsel,
    },
    editorProps: {
      begrunnelse,
      onBegrunnelseChange: handleBegrunnelseChange,
      begrunnelseError: begrunnelseValidationError,
      placeholder: computed.dynamicPlaceholder,
      autoBegrunnelse,
      onRegenerate: handleRegenerate,
      showRegenerate: !!autoBegrunnelse,
    },
  };
}
