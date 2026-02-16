/**
 * useVederlagBridge — Bridge between VederlagCard (controls) and BentoRespondVederlag (editor).
 *
 * Follows useFristBridge pattern:
 * 1. Config → mottar sak/krav-data, callbacks, approval-config
 * 2. State → consolidated useState<VederlagFormState>
 * 3. Domain → beregnAlt(formState, domainConfig) for all computed values
 * 4. Auto-begrunnelse → generateVederlagResponseBegrunnelse() with token-format
 * 5. Submit → buildEventData() → mutation.mutate()
 * 6. Return → { cardProps: VederlagEditState, editorProps: VederlagEditorProps }
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type {
  VederlagsMetode,
  VederlagBeregningResultat,
  SubsidiaerTrigger,
} from '../types/timeline';
import * as vederlagDomain from '../domain/vederlagDomain';
import type { BelopVurdering, VederlagFormState, VederlagDomainConfig, VederlagComputedValues } from '../domain/vederlagDomain';
import {
  generateVederlagResponseBegrunnelse,
  type VederlagResponseInput,
} from '../utils/begrunnelseGenerator';
import { useSubmitEvent } from './useSubmitEvent';
import { useFormBackup } from './useFormBackup';
import { useCatendaStatusHandler } from './useCatendaStatusHandler';
import { useToast } from '../components/primitives';

// ============================================================================
// TYPES
// ============================================================================

export interface KravLinjeEditState {
  label: string;
  paragraf: string;
  krevdBelop: number;
  godkjentBelop: number;
  onGodkjentBelopChange: (v: number) => void;
  showVarsling: boolean;
  varsletDato?: string;
  varsletITide: boolean;
  onVarsletITideChange: (v: boolean) => void;
  vurdering: BelopVurdering;
  erPrekludert: boolean;
  subsidiaertGodkjentBelop: number;
}

export interface VederlagEditState {
  // Metode
  teMetode: VederlagsMetode;
  bhMetode: VederlagsMetode;
  onBhMetodeChange: (m: VederlagsMetode) => void;
  harMetodeendring: boolean;

  // EP-justering
  showEpJustering: boolean;
  epJusteringVarsletITide?: boolean;
  onEpJusteringVarsletITideChange: (v: boolean) => void;
  epJusteringAkseptert?: boolean;
  onEpJusteringAkseptertChange: (v: boolean) => void;

  // Tilbakeholdelse
  showTilbakeholdelse: boolean;
  holdTilbake: boolean;
  onHoldTilbakeChange: (v: boolean) => void;

  // Krav-linjer
  hovedkrav: KravLinjeEditState;
  rigg?: KravLinjeEditState;
  produktivitet?: KravLinjeEditState;

  // Resultat
  prinsipaltResultat: VederlagBeregningResultat;
  subsidiaertResultat: VederlagBeregningResultat;
  visSubsidiaertResultat: boolean;
  totalKrevd: number;
  totalGodkjent: number;
  totalGodkjentInklPrekludert: number;
  godkjenningsgradProsent: number;

  // Subsidiær kontekst
  erSubsidiaer: boolean;
  subsidiaerTriggers: SubsidiaerTrigger[];

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
}

export interface VederlagEditorProps {
  begrunnelse: string;
  onBegrunnelseChange: (value: string) => void;
  begrunnelseError?: string;
  placeholder: string;
  autoBegrunnelse: string;
  onRegenerate: () => void;
  showRegenerate: boolean;
}

export interface VederlagBridgeReturn {
  cardProps: VederlagEditState;
  editorProps: VederlagEditorProps;
}

export interface UseVederlagBridgeConfig {
  isOpen: boolean;
  sakId: string;
  vederlagKravId: string;
  // TE claim data
  teMetode?: VederlagsMetode;
  hovedkravBelop: number;
  riggBelop?: number;
  produktivitetBelop?: number;
  harRiggKrav: boolean;
  harProduktivitetKrav: boolean;
  kreverJustertEp: boolean;
  kostnadsOverslag?: number;
  hovedkategori?: 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE';
  // Varseldatoer for krav-linjer
  riggVarsletDato?: string;
  produktivitetVarsletDato?: string;
  hovedkravVarsletDato?: string;
  // Grunnlag context
  grunnlagStatus?: 'godkjent' | 'avslatt' | 'frafalt';
  grunnlagVarsletForSent: boolean;
  // Update mode
  lastResponseEvent?: vederlagDomain.VederlagLastResponseData;
  // Callbacks
  onSuccess: () => void;
  onCatendaWarning?: () => void;
  // Approval
  approvalEnabled?: boolean;
  onSaveDraft?: (draftData: Record<string, unknown>) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useVederlagBridge(config: UseVederlagBridgeConfig): VederlagBridgeReturn {
  const {
    isOpen,
    sakId,
    vederlagKravId,
    teMetode = 'ENHETSPRISER',
    hovedkravBelop,
    riggBelop,
    produktivitetBelop,
    harRiggKrav,
    harProduktivitetKrav,
    kreverJustertEp,
    kostnadsOverslag,
    hovedkategori,
    riggVarsletDato,
    produktivitetVarsletDato,
    hovedkravVarsletDato,
    grunnlagStatus,
    grunnlagVarsletForSent,
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

  // ========== DOMAIN CONFIG ==========
  const domainConfig = useMemo((): VederlagDomainConfig => ({
    metode: teMetode,
    hovedkravBelop,
    riggBelop,
    produktivitetBelop,
    harRiggKrav,
    harProduktivitetKrav,
    kreverJustertEp,
    kostnadsOverslag,
    hovedkategori,
    grunnlagVarsletForSent,
    grunnlagStatus,
  }), [teMetode, hovedkravBelop, riggBelop, produktivitetBelop, harRiggKrav, harProduktivitetKrav, kreverJustertEp, kostnadsOverslag, hovedkategori, grunnlagVarsletForSent, grunnlagStatus]);

  // ========== STATE ==========
  const getDefaults = useCallback(
    () => vederlagDomain.getDefaults({
      isUpdateMode,
      lastResponseEvent,
    }),
    [isUpdateMode, lastResponseEvent],
  );

  const [formState, setFormState] = useState<VederlagFormState>(getDefaults);

  // ========== BH METODE (card-anchored: separate from akseptererMetode) ==========
  // In card-anchored mode, bhMetode is direct — akseptererMetode is derived.
  const [bhMetode, setBhMetode] = useState<VederlagsMetode>(
    lastResponseEvent?.oensketMetode ?? teMetode,
  );

  // Sync akseptererMetode in form state when bhMetode changes
  const handleBhMetodeChange = useCallback((m: VederlagsMetode) => {
    setBhMetode(m);
    setFormState(prev => ({
      ...prev,
      akseptererMetode: m === teMetode,
      oensketMetode: m !== teMetode ? m : undefined,
    }));
  }, [teMetode]);

  // ========== FORM BACKUP ==========
  const backupData = useMemo(
    () => ({ begrunnelse: formState.begrunnelse }),
    [formState.begrunnelse]
  );
  const begrunnelseIsDirty = formState.begrunnelse.length > 0;
  const { clearBackup, getBackup } = useFormBackup(
    sakId, 'respons_vederlag', backupData, begrunnelseIsDirty
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
      setBhMetode(lastResponseEvent?.oensketMetode ?? teMetode);
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

  // ========== DOMAIN COMPUTATIONS ==========
  const computed = useMemo(
    () => vederlagDomain.beregnAlt(formState, domainConfig),
    [formState, domainConfig],
  );

  // ========== INDIVIDUAL SETTERS ==========
  // Beløp changes need to derive vurdering
  const setHovedkravGodkjentBelop = useCallback((v: number) => {
    setFormState(prev => ({
      ...prev,
      hovedkravGodkjentBelop: v,
      hovedkravVurdering: deriveVurdering(v, hovedkravBelop),
    }));
  }, [hovedkravBelop]);

  const setRiggGodkjentBelop = useCallback((v: number) => {
    setFormState(prev => ({
      ...prev,
      riggGodkjentBelop: v,
      riggVurdering: deriveVurdering(v, riggBelop ?? 0),
    }));
  }, [riggBelop]);

  const setProduktivitetGodkjentBelop = useCallback((v: number) => {
    setFormState(prev => ({
      ...prev,
      produktivitetGodkjentBelop: v,
      produktivitetVurdering: deriveVurdering(v, produktivitetBelop ?? 0),
    }));
  }, [produktivitetBelop]);

  const setHovedkravVarsletITide = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, hovedkravVarsletITide: v }));
  }, []);

  const setRiggVarsletITide = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, riggVarsletITide: v }));
  }, []);

  const setProduktivitetVarsletITide = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, produktivitetVarsletITide: v }));
  }, []);

  const setEpJusteringVarsletITide = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, epJusteringVarsletITide: v }));
  }, []);

  const setEpJusteringAkseptert = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, epJusteringAkseptert: v }));
  }, []);

  const setHoldTilbake = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, holdTilbake: v }));
  }, []);

  // ========== BEGRUNNELSE ==========
  const handleBegrunnelseChange = useCallback((value: string) => {
    userHasEditedBegrunnelseRef.current = true;
    setFormState(prev => ({ ...prev, begrunnelse: value }));
  }, []);

  // ========== AUTO-BEGRUNNELSE ==========
  const autoBegrunnelse = useMemo(() => {
    if (!computed.prinsipaltResultat) return '';
    const input: VederlagResponseInput = {
      metode: teMetode,
      hovedkravBelop,
      riggBelop,
      produktivitetBelop,
      harRiggKrav,
      harProduktivitetKrav,
      erGrunnlagPrekludert: grunnlagVarsletForSent,
      erGrunnlagAvslatt: grunnlagStatus === 'avslatt',
      hovedkravVarsletITide: formState.hovedkravVarsletITide,
      riggVarsletITide: formState.riggVarsletITide,
      produktivitetVarsletITide: formState.produktivitetVarsletITide,
      akseptererMetode: formState.akseptererMetode,
      oensketMetode: formState.oensketMetode,
      epJusteringVarsletITide: formState.epJusteringVarsletITide,
      epJusteringAkseptert: formState.epJusteringAkseptert,
      kreverJustertEp: kreverJustertEp,
      holdTilbake: formState.holdTilbake,
      hovedkravVurdering: formState.hovedkravVurdering,
      hovedkravGodkjentBelop: formState.hovedkravGodkjentBelop,
      riggVurdering: formState.riggVurdering,
      riggGodkjentBelop: formState.riggGodkjentBelop,
      produktivitetVurdering: formState.produktivitetVurdering,
      produktivitetGodkjentBelop: formState.produktivitetGodkjentBelop,
      totalKrevd: computed.totalKrevdInklPrekludert,
      totalGodkjent: computed.totalGodkjent,
      totalGodkjentSubsidiaer: computed.totalGodkjentInklPrekludert,
      harPrekludertKrav: computed.harPrekludertKrav,
    };
    return generateVederlagResponseBegrunnelse(input, { useTokens: true });
  }, [
    teMetode, hovedkravBelop, riggBelop, produktivitetBelop,
    harRiggKrav, harProduktivitetKrav, grunnlagVarsletForSent, grunnlagStatus,
    formState, computed, kreverJustertEp,
  ]);

  // Auto-populate when not manually edited
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
      toast.success('Svar sendt', 'Ditt svar på vederlagskravet er registrert.');
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

  // ========== VALIDATE + SUBMIT ==========
  const { begrunnelse } = formState;
  const canSubmit = !!computed.prinsipaltResultat && begrunnelse.length >= 10 && !mutation.isPending;

  const handleSubmit = useCallback(() => {
    if (begrunnelse.length < 10) return;

    pendingToastId.current = toast.pending(
      'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    const event = vederlagDomain.buildEventData(
      formState,
      domainConfig,
      computed,
      {
        vederlagKravId,
        lastResponseEventId: lastResponseEvent?.eventId,
        isUpdateMode,
      },
      autoBegrunnelse,
      computed.subsidiaerTriggers,
    );
    mutation.mutate({
      eventType: event.eventType as import('../types/timeline').EventType,
      data: event.data,
    });
  }, [begrunnelse, formState, domainConfig, computed, vederlagKravId, lastResponseEvent, isUpdateMode, autoBegrunnelse, mutation, toast]);

  const handleSaveDraft = useCallback(() => {
    if (!onSaveDraft) return;
    if (begrunnelse.length < 10) return;

    onSaveDraft({
      belop: computed.totalGodkjent,
      resultat: computed.prinsipaltResultat,
      begrunnelse: begrunnelse || autoBegrunnelse,
      formData: {
        hovedkrav_varslet_i_tide: formState.hovedkravVarsletITide,
        rigg_varslet_i_tide: formState.riggVarsletITide,
        produktivitet_varslet_i_tide: formState.produktivitetVarsletITide,
        aksepterer_metode: formState.akseptererMetode,
        oensket_metode: formState.oensketMetode,
        ep_justering_varslet_i_tide: formState.epJusteringVarsletITide,
        ep_justering_akseptert: formState.epJusteringAkseptert,
        hold_tilbake: formState.holdTilbake,
        hovedkrav_vurdering: formState.hovedkravVurdering,
        hovedkrav_godkjent_belop: formState.hovedkravGodkjentBelop,
        rigg_vurdering: formState.riggVurdering,
        rigg_godkjent_belop: formState.riggGodkjentBelop,
        produktivitet_vurdering: formState.produktivitetVurdering,
        produktivitet_godkjent_belop: formState.produktivitetGodkjentBelop,
        begrunnelse: begrunnelse || autoBegrunnelse,
      },
    });
    clearBackup();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på vederlagskravet er lagret som utkast.');
  }, [onSaveDraft, computed, begrunnelse, autoBegrunnelse, formState, clearBackup, onSuccess, toast]);

  const submitLabel = mutation.isPending ? 'Sender...' : 'Send svar';

  // ========== KRAV-LINJE BUILDERS ==========
  const godkjentHovedkravBelop = getGodkjentForInput(formState.hovedkravVurdering, hovedkravBelop, formState.hovedkravGodkjentBelop);
  const godkjentRiggBelop = getGodkjentForInput(formState.riggVurdering, riggBelop ?? 0, formState.riggGodkjentBelop);
  const godkjentProduktivitetBelop = getGodkjentForInput(formState.produktivitetVurdering, produktivitetBelop ?? 0, formState.produktivitetGodkjentBelop);

  const showHovedkravVarsling = computed.har34_1_2_Preklusjon;

  const hovedkravLine: KravLinjeEditState = useMemo(() => ({
    label: 'Hovedkrav',
    paragraf: showHovedkravVarsling ? '§34.1.2' : '',
    krevdBelop: hovedkravBelop,
    godkjentBelop: godkjentHovedkravBelop,
    onGodkjentBelopChange: setHovedkravGodkjentBelop,
    showVarsling: showHovedkravVarsling,
    varsletDato: hovedkravVarsletDato,
    varsletITide: formState.hovedkravVarsletITide,
    onVarsletITideChange: setHovedkravVarsletITide,
    vurdering: computed.hovedkravPrekludert ? 'avslatt' : formState.hovedkravVurdering,
    erPrekludert: computed.hovedkravPrekludert,
    subsidiaertGodkjentBelop: godkjentHovedkravBelop,
  }), [
    showHovedkravVarsling, hovedkravBelop, godkjentHovedkravBelop, hovedkravVarsletDato,
    formState.hovedkravVarsletITide, formState.hovedkravVurdering,
    computed.hovedkravPrekludert, setHovedkravGodkjentBelop, setHovedkravVarsletITide,
  ]);

  const riggLine: KravLinjeEditState | undefined = useMemo(() => {
    if (!harRiggKrav) return undefined;
    return {
      label: 'Rigg/drift',
      paragraf: '§34.1.3',
      krevdBelop: riggBelop ?? 0,
      godkjentBelop: godkjentRiggBelop,
      onGodkjentBelopChange: setRiggGodkjentBelop,
      showVarsling: true,
      varsletDato: riggVarsletDato,
      varsletITide: formState.riggVarsletITide,
      onVarsletITideChange: setRiggVarsletITide,
      vurdering: computed.riggPrekludert ? 'avslatt' : (formState.riggVurdering ?? 'godkjent'),
      erPrekludert: computed.riggPrekludert,
      subsidiaertGodkjentBelop: godkjentRiggBelop,
    };
  }, [
    harRiggKrav, riggBelop, godkjentRiggBelop, riggVarsletDato,
    formState.riggVarsletITide, formState.riggVurdering,
    computed.riggPrekludert, setRiggGodkjentBelop, setRiggVarsletITide,
  ]);

  const produktivitetLine: KravLinjeEditState | undefined = useMemo(() => {
    if (!harProduktivitetKrav) return undefined;
    return {
      label: 'Produktivitet',
      paragraf: '§34.1.3',
      krevdBelop: produktivitetBelop ?? 0,
      godkjentBelop: godkjentProduktivitetBelop,
      onGodkjentBelopChange: setProduktivitetGodkjentBelop,
      showVarsling: true,
      varsletDato: produktivitetVarsletDato,
      varsletITide: formState.produktivitetVarsletITide,
      onVarsletITideChange: setProduktivitetVarsletITide,
      vurdering: computed.produktivitetPrekludert ? 'avslatt' : (formState.produktivitetVurdering ?? 'godkjent'),
      erPrekludert: computed.produktivitetPrekludert,
      subsidiaertGodkjentBelop: godkjentProduktivitetBelop,
    };
  }, [
    harProduktivitetKrav, produktivitetBelop, godkjentProduktivitetBelop, produktivitetVarsletDato,
    formState.produktivitetVarsletITide, formState.produktivitetVurdering,
    computed.produktivitetPrekludert, setProduktivitetGodkjentBelop, setProduktivitetVarsletITide,
  ]);

  // ========== COMPUTED DISPLAY VALUES ==========
  const godkjenningsgradProsent = computed.totalKrevdInklPrekludert > 0
    ? Math.round((computed.totalGodkjent / computed.totalKrevdInklPrekludert) * 100)
    : 0;

  // ========== RETURN ==========
  return {
    cardProps: {
      teMetode,
      bhMetode,
      onBhMetodeChange: handleBhMetodeChange,
      harMetodeendring: computed.harMetodeendring,

      showEpJustering: computed.maSvarePaJustering,
      epJusteringVarsletITide: formState.epJusteringVarsletITide,
      onEpJusteringVarsletITideChange: setEpJusteringVarsletITide,
      epJusteringAkseptert: formState.epJusteringAkseptert,
      onEpJusteringAkseptertChange: setEpJusteringAkseptert,

      showTilbakeholdelse: computed.kanHoldeTilbake,
      holdTilbake: formState.holdTilbake,
      onHoldTilbakeChange: setHoldTilbake,

      hovedkrav: hovedkravLine,
      rigg: riggLine,
      produktivitet: produktivitetLine,

      prinsipaltResultat: computed.prinsipaltResultat,
      subsidiaertResultat: computed.subsidiaertResultat,
      visSubsidiaertResultat: computed.visSubsidiaertResultat,
      totalKrevd: computed.totalKrevdInklPrekludert,
      totalGodkjent: computed.totalGodkjent,
      totalGodkjentInklPrekludert: computed.totalGodkjentInklPrekludert,
      godkjenningsgradProsent,

      erSubsidiaer: computed.erSubsidiaer,
      subsidiaerTriggers: computed.subsidiaerTriggers,

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
    },
    editorProps: {
      begrunnelse: formState.begrunnelse,
      onBegrunnelseChange: handleBegrunnelseChange,
      placeholder: computed.dynamicPlaceholder,
      autoBegrunnelse,
      onRegenerate: handleRegenerate,
      showRegenerate: !!autoBegrunnelse,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/** D2: Derive vurdering from godkjent vs krevd beløp */
function deriveVurdering(godkjent: number, krevd: number): BelopVurdering {
  if (godkjent >= krevd && krevd > 0) return 'godkjent';
  if (godkjent > 0) return 'delvis';
  return 'avslatt';
}

/** Get display value for input based on vurdering */
function getGodkjentForInput(
  vurdering: BelopVurdering | undefined,
  krevdBelop: number,
  godkjentBelop: number | undefined,
): number {
  if (vurdering === 'godkjent' || vurdering === undefined) return krevdBelop;
  if (vurdering === 'delvis') return godkjentBelop ?? 0;
  return 0;
}
