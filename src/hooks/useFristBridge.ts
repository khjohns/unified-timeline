import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { FristBeregningResultat, SubsidiaerTrigger } from '../types/timeline';
import {
  generateFristResponseBegrunnelse,
  type FristResponseInput,
} from '../utils/begrunnelseGenerator';
import { useSubmitEvent } from './useSubmitEvent';
import { useFormBackup } from './useFormBackup';
import { useCatendaStatusHandler } from './useCatendaStatusHandler';
import { useToast } from '../components/primitives';

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
// HELPER FUNCTIONS (ported from RespondFristModal)
// ============================================================================

function beregnPrinsipaltResultat(data: {
  erPrekludert: boolean;
  sendForesporsel: boolean;
  harHindring: boolean;
  krevdDager: number;
  godkjentDager: number;
}): FristBeregningResultat {
  if (data.sendForesporsel) return 'avslatt';
  if (data.erPrekludert) return 'avslatt';
  if (!data.harHindring) return 'avslatt';

  if (data.krevdDager === 0) return 'godkjent';

  const godkjentProsent = data.godkjentDager / data.krevdDager;
  if (godkjentProsent >= 0.99) return 'godkjent';

  return 'delvis_godkjent';
}

function beregnSubsidiaertResultat(data: {
  harHindring: boolean;
  krevdDager: number;
  godkjentDager: number;
}): FristBeregningResultat {
  if (!data.harHindring) return 'avslatt';

  if (data.krevdDager === 0) return 'godkjent';

  const godkjentProsent = data.godkjentDager / data.krevdDager;
  if (godkjentProsent >= 0.99) return 'godkjent';

  return 'delvis_godkjent';
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

  // Derived: har tidligere varsel i tide
  const harTidligereFristVarsel = !!fristTilstand?.frist_varsel;
  const harTidligereVarselITide = harTidligereFristVarsel && fristTilstand?.frist_varsel_ok === true;

  // Derived: er svar på forespørsel
  const erSvarPaForesporsel = fristTilstand?.har_bh_foresporsel === true && varselType === 'spesifisert';

  // Grunnlag subsidiary
  const erHelFristSubsidiaerPgaGrunnlag = grunnlagVarsletForSent === true;
  const erGrunnlagSubsidiaer = grunnlagStatus === 'avslatt' || erHelFristSubsidiaerPgaGrunnlag;

  // ========== STATE (now includes begrunnelse) ==========
  const getDefaults = useCallback(() => {
    if (isUpdateMode && lastResponseEvent && fristTilstand) {
      return {
        fristVarselOk: fristTilstand.frist_varsel_ok ?? true,
        spesifisertKravOk: fristTilstand.spesifisert_krav_ok ?? true,
        foresporselSvarOk: fristTilstand.foresporsel_svar_ok ?? true,
        vilkarOppfylt: fristTilstand.vilkar_oppfylt ?? true,
        sendForesporsel: false,
        godkjentDager: lastResponseEvent.godkjent_dager ?? krevdDager,
        begrunnelse: '',
        begrunnelseValidationError: undefined as string | undefined,
      };
    }
    return {
      fristVarselOk: true,
      spesifisertKravOk: true,
      foresporselSvarOk: true,
      vilkarOppfylt: true,
      sendForesporsel: false,
      godkjentDager: krevdDager,
      begrunnelse: '',
      begrunnelseValidationError: undefined as string | undefined,
    };
  }, [isUpdateMode, lastResponseEvent, fristTilstand, krevdDager]);

  // Consolidated form state
  interface FormState {
    fristVarselOk: boolean;
    spesifisertKravOk: boolean;
    foresporselSvarOk: boolean;
    vilkarOppfylt: boolean;
    sendForesporsel: boolean;
    godkjentDager: number;
    begrunnelse: string;
    begrunnelseValidationError: string | undefined;
  }

  const [formState, setFormState] = useState<FormState>(getDefaults);

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

  // ========== VISIBILITY FLAGS ==========
  const erBegrunnelseUtsatt = varselType === 'begrunnelse_utsatt';

  const showFristVarselOk = useMemo(() => {
    if (erBegrunnelseUtsatt) return false;
    if (varselType === 'varsel') return true;
    if (varselType === 'spesifisert' && !harTidligereVarselITide && !erSvarPaForesporsel) return true;
    return false;
  }, [varselType, erBegrunnelseUtsatt, harTidligereVarselITide, erSvarPaForesporsel]);

  const showSpesifisertKravOk = useMemo(() => {
    if (erBegrunnelseUtsatt) return false;
    if (varselType !== 'spesifisert') return false;
    if (erSvarPaForesporsel) return false;
    return true;
  }, [varselType, erBegrunnelseUtsatt, erSvarPaForesporsel]);

  const showForesporselSvarOk = useMemo(() => {
    if (erBegrunnelseUtsatt) return false;
    return erSvarPaForesporsel;
  }, [erBegrunnelseUtsatt, erSvarPaForesporsel]);

  const showSendForesporsel = useMemo(() => {
    if (erBegrunnelseUtsatt) return false;
    return varselType === 'varsel' && fristVarselOk === true;
  }, [varselType, erBegrunnelseUtsatt, fristVarselOk]);

  // ========== PRECLUSION ==========
  const erForesporselSvarForSent = erSvarPaForesporsel && foresporselSvarOk === false;

  const erPrekludert = useMemo(() => {
    if (erForesporselSvarForSent) return true;
    if (varselType === 'varsel') return fristVarselOk === false;
    if (varselType === 'spesifisert' && !harTidligereVarselITide) return fristVarselOk === false;
    return false;
  }, [fristVarselOk, varselType, harTidligereVarselITide, erForesporselSvarForSent]);

  const erRedusert = useMemo(() => {
    if (erSvarPaForesporsel) return false;
    if (varselType === 'spesifisert' && harTidligereVarselITide) return spesifisertKravOk === false;
    if (varselType === 'spesifisert' && !harTidligereVarselITide) {
      return fristVarselOk === true && spesifisertKravOk === false;
    }
    return false;
  }, [fristVarselOk, spesifisertKravOk, varselType, erSvarPaForesporsel, harTidligereVarselITide]);

  // ========== COMPUTED RESULTS ==========
  const harHindring = vilkarOppfylt === true;

  const prinsipaltResultat = useMemo(
    () => beregnPrinsipaltResultat({
      erPrekludert,
      sendForesporsel,
      harHindring,
      krevdDager,
      godkjentDager,
    }),
    [erPrekludert, sendForesporsel, harHindring, krevdDager, godkjentDager]
  );

  const subsidiaertResultat = useMemo(
    () => beregnSubsidiaertResultat({ harHindring, krevdDager, godkjentDager }),
    [harHindring, krevdDager, godkjentDager]
  );

  const visSubsidiaertResultat = prinsipaltResultat === 'avslatt';

  const showGodkjentDager = !sendForesporsel;

  // Port-level subsidiary flags (for card badge display)
  const port2ErSubsidiaer = (erPrekludert || erGrunnlagSubsidiaer) && !sendForesporsel;
  const port3ErSubsidiaer = (erPrekludert || !harHindring || erGrunnlagSubsidiaer) && !sendForesporsel;

  // Subsidiary triggers
  const subsidiaerTriggers = useMemo((): SubsidiaerTrigger[] => {
    const triggers: SubsidiaerTrigger[] = [];
    if (erGrunnlagSubsidiaer) triggers.push('grunnlag_avslatt');
    if (erPrekludert) triggers.push('preklusjon_varsel');
    if (!harHindring) triggers.push('ingen_hindring');
    return triggers;
  }, [erGrunnlagSubsidiaer, erPrekludert, harHindring]);

  // ========== AUTO-BEGRUNNELSE ==========
  const autoBegrunnelse = useMemo(() => {
    if (!prinsipaltResultat) return '';
    const input: FristResponseInput = {
      varselType,
      krevdDager,
      fristVarselOk,
      spesifisertKravOk,
      foresporselSvarOk,
      sendForesporsel,
      vilkarOppfylt,
      godkjentDager,
      erPrekludert,
      erForesporselSvarForSent,
      erRedusert_33_6_1: erRedusert,
      harTidligereVarselITide,
      erGrunnlagSubsidiaer,
      erGrunnlagPrekludert: erHelFristSubsidiaerPgaGrunnlag,
      prinsipaltResultat,
      subsidiaertResultat,
      visSubsidiaertResultat,
    };
    return generateFristResponseBegrunnelse(input, { useTokens: true });
  }, [
    varselType, krevdDager, fristVarselOk, spesifisertKravOk,
    foresporselSvarOk, sendForesporsel, vilkarOppfylt, godkjentDager,
    prinsipaltResultat, erPrekludert, erForesporselSvarForSent,
    erRedusert, harTidligereVarselITide, erGrunnlagSubsidiaer,
    erHelFristSubsidiaerPgaGrunnlag, subsidiaertResultat, visSubsidiaertResultat,
  ]);

  const dynamicPlaceholder = useMemo(() => {
    if (!prinsipaltResultat) return 'Gjør valgene i kortet, deretter skriv begrunnelse...';
    if (prinsipaltResultat === 'godkjent') return 'Begrunn din godkjenning av fristforlengelsen...';
    if (prinsipaltResultat === 'delvis_godkjent') return 'Forklar hvorfor du kun godkjenner deler av fristforlengelsen...';
    return 'Begrunn ditt avslag på fristforlengelsen...';
  }, [prinsipaltResultat]);

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

  // ========== BUILD EVENT DATA (internal) ==========
  const buildEventData = useCallback((): Record<string, unknown> => {
    const effectiveGodkjentDager = prinsipaltResultat !== 'avslatt' ? godkjentDager : 0;
    return {
      frist_krav_id: fristKravId,
      frist_varsel_ok: fristVarselOk,
      spesifisert_krav_ok: spesifisertKravOk,
      foresporsel_svar_ok: foresporselSvarOk,
      send_foresporsel: sendForesporsel,
      vilkar_oppfylt: vilkarOppfylt,
      godkjent_dager: effectiveGodkjentDager,
      begrunnelse: begrunnelse || autoBegrunnelse,
      auto_begrunnelse: autoBegrunnelse,
      beregnings_resultat: prinsipaltResultat,
      krevd_dager: krevdDager,
      subsidiaer_triggers: subsidiaerTriggers.length > 0 ? subsidiaerTriggers : undefined,
      subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
      subsidiaer_godkjent_dager: visSubsidiaertResultat && subsidiaertResultat !== 'avslatt' ? effectiveGodkjentDager : undefined,
      subsidiaer_begrunnelse: visSubsidiaertResultat ? (begrunnelse || autoBegrunnelse) : undefined,
    };
  }, [
    fristKravId, fristVarselOk, spesifisertKravOk, foresporselSvarOk, sendForesporsel,
    vilkarOppfylt, godkjentDager, begrunnelse, prinsipaltResultat, krevdDager,
    autoBegrunnelse, subsidiaerTriggers, visSubsidiaertResultat, subsidiaertResultat,
  ]);

  // ========== VALIDATE + SUBMIT ==========
  const canSubmit = !!prinsipaltResultat && begrunnelse.length >= 10 && !mutation.isPending;

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

    mutation.mutate({
      eventType: 'respons_frist',
      data: buildEventData(),
    });
  }, [begrunnelse, buildEventData, mutation, toast]);

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
      resultat: prinsipaltResultat,
      begrunnelse: begrunnelse || autoBegrunnelse,
    });
    clearBackup();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på fristkravet er lagret som utkast.');
  }, [onSaveDraft, godkjentDager, prinsipaltResultat, begrunnelse, autoBegrunnelse, clearBackup, onSuccess, toast]);

  const submitLabel = mutation.isPending ? 'Sender...' : 'Send svar';

  // ========== RETURN ==========
  return {
    cardProps: {
      fristVarselOk,
      onFristVarselOkChange: handleFristVarselOkChange,
      showFristVarselOk,

      spesifisertKravOk,
      onSpesifisertKravOkChange: setSpesifisertKravOk,
      showSpesifisertKravOk,

      foresporselSvarOk,
      onForesporselSvarOkChange: setForesporselSvarOk,
      showForesporselSvarOk,

      sendForesporsel,
      onSendForesporselChange: setSendForesporsel,
      showSendForesporsel,

      vilkarOppfylt,
      onVilkarOppfyltChange: setVilkarOppfylt,

      godkjentDager,
      onGodkjentDagerChange: setGodkjentDager,
      showGodkjentDager,

      erPrekludert,
      erRedusert,
      port2ErSubsidiaer,
      port3ErSubsidiaer,
      erSvarPaForesporsel,
      erGrunnlagSubsidiaer,
      beregningsResultat: prinsipaltResultat,
      visSubsidiaertResultat,
      subsidiaertResultat,
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
      placeholder: dynamicPlaceholder,
      autoBegrunnelse,
      onRegenerate: handleRegenerate,
      showRegenerate: !!autoBegrunnelse,
    },
  };
}
