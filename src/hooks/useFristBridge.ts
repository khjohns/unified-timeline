import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { FristBeregningResultat, SubsidiaerTrigger } from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export interface UseFristBridgeConfig {
  isOpen: boolean;
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
}

export interface FristBridgeReturn {
  cardProps: FristEditState;
  formProps: {
    externalSelections: Record<string, unknown>;
    begrunnelseDefaults: { placeholder: string };
  };
  computed: {
    erPrekludert: boolean;
    erRedusert: boolean;
    erGrunnlagSubsidiaer: boolean;
    prinsipaltResultat: string | undefined;
    subsidiaertResultat: string | undefined;
    visSubsidiaertResultat: boolean;
    visForsering: boolean;
    avslatteDager: number;
    sendForesporsel: boolean;
    subsidiaerTriggers: SubsidiaerTrigger[];
  };
  validate: () => boolean;
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
    krevdDager,
    varselType,
    grunnlagStatus,
    grunnlagVarsletForSent,
    fristTilstand,
    lastResponseEvent,
  } = config;

  const isUpdateMode = !!lastResponseEvent;

  // Derived: har tidligere varsel i tide
  const harTidligereFristVarsel = !!fristTilstand?.frist_varsel;
  const harTidligereVarselITide = harTidligereFristVarsel && fristTilstand?.frist_varsel_ok === true;

  // Derived: er svar på forespørsel
  const erSvarPaForesporsel = fristTilstand?.har_bh_foresporsel === true && varselType === 'spesifisert';

  // Grunnlag subsidiary
  const erHelFristSubsidiaerPgaGrunnlag = grunnlagVarsletForSent === true;
  const erGrunnlagSubsidiaer = grunnlagStatus === 'avslatt' || erHelFristSubsidiaerPgaGrunnlag;

  // ========== STATE ==========
  // Default values: TE-favorable (matching RespondFristModal defaults)
  const getDefaults = useCallback(() => {
    if (isUpdateMode && lastResponseEvent && fristTilstand) {
      return {
        fristVarselOk: fristTilstand.frist_varsel_ok ?? true,
        spesifisertKravOk: fristTilstand.spesifisert_krav_ok ?? true,
        foresporselSvarOk: fristTilstand.foresporsel_svar_ok ?? true,
        vilkarOppfylt: fristTilstand.vilkar_oppfylt ?? true,
        sendForesporsel: false,
        godkjentDager: lastResponseEvent.godkjent_dager ?? krevdDager,
      };
    }
    return {
      fristVarselOk: true,
      spesifisertKravOk: true,
      foresporselSvarOk: true,
      vilkarOppfylt: true,
      sendForesporsel: false,
      godkjentDager: krevdDager,
    };
  }, [isUpdateMode, lastResponseEvent, fristTilstand, krevdDager]);

  const initialDefaults = getDefaults();
  const [fristVarselOk, setFristVarselOk] = useState(initialDefaults.fristVarselOk);
  const [spesifisertKravOk, setSpesifisertKravOk] = useState(initialDefaults.spesifisertKravOk);
  const [foresporselSvarOk, setForesporselSvarOk] = useState(initialDefaults.foresporselSvarOk);
  const [vilkarOppfylt, setVilkarOppfylt] = useState(initialDefaults.vilkarOppfylt);
  const [sendForesporsel, setSendForesporsel] = useState(initialDefaults.sendForesporsel);
  const [godkjentDager, setGodkjentDager] = useState(initialDefaults.godkjentDager);

  // Reset when isOpen transitions to true
  const prevIsOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      const defaults = getDefaults();
      setFristVarselOk(defaults.fristVarselOk);
      setSpesifisertKravOk(defaults.spesifisertKravOk);
      setForesporselSvarOk(defaults.foresporselSvarOk);
      setVilkarOppfylt(defaults.vilkarOppfylt);
      setSendForesporsel(defaults.sendForesporsel);
      setGodkjentDager(defaults.godkjentDager);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, getDefaults]);

  // Reset sendForesporsel when fristVarselOk becomes false
  useEffect(() => {
    if (fristVarselOk === false && sendForesporsel === true) {
      setSendForesporsel(false);
    }
  }, [fristVarselOk, sendForesporsel]);

  // ========== VISIBILITY FLAGS ==========
  const erBegrunnelseUtsatt = varselType === 'begrunnelse_utsatt';

  const showFristVarselOk = useMemo(() => {
    if (erBegrunnelseUtsatt) return false;
    if (varselType === 'varsel') return true;
    // spesifisert: show if no prior varsel i tide (need both §33.4 + §33.6.1)
    if (varselType === 'spesifisert' && !harTidligereVarselITide && !erSvarPaForesporsel) return true;
    return false;
  }, [varselType, erBegrunnelseUtsatt, harTidligereVarselITide, erSvarPaForesporsel]);

  const showSpesifisertKravOk = useMemo(() => {
    if (erBegrunnelseUtsatt) return false;
    if (varselType !== 'spesifisert') return false;
    if (erSvarPaForesporsel) return false;
    // Show when: prior varsel i tide (only §33.6.1 needed) OR no prior varsel (both needed)
    return true;
  }, [varselType, erBegrunnelseUtsatt, erSvarPaForesporsel]);

  const showForesporselSvarOk = useMemo(() => {
    if (erBegrunnelseUtsatt) return false;
    return erSvarPaForesporsel;
  }, [erBegrunnelseUtsatt, erSvarPaForesporsel]);

  const showSendForesporsel = useMemo(() => {
    if (erBegrunnelseUtsatt) return false;
    // Only for varsel type when fristVarselOk is true
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

  const visForsering = useMemo(() => {
    if (prinsipaltResultat === 'avslatt') return true;
    if (prinsipaltResultat === 'delvis_godkjent' && godkjentDager < krevdDager) return true;
    return false;
  }, [prinsipaltResultat, godkjentDager, krevdDager]);

  const avslatteDager = krevdDager - godkjentDager;

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

  // ========== RETURN ==========
  return {
    cardProps: {
      fristVarselOk,
      onFristVarselOkChange: setFristVarselOk,
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
    },
    formProps: {
      externalSelections: {
        frist_varsel_ok: fristVarselOk,
        spesifisert_krav_ok: spesifisertKravOk,
        foresporsel_svar_ok: foresporselSvarOk,
        vilkar_oppfylt: vilkarOppfylt,
        godkjent_dager: godkjentDager,
        send_foresporsel: sendForesporsel,
      },
      begrunnelseDefaults: {
        placeholder: 'Begrunn ditt svar på fristforlengelseskravet...',
      },
    },
    computed: {
      erPrekludert,
      erRedusert,
      erGrunnlagSubsidiaer,
      prinsipaltResultat,
      subsidiaertResultat,
      visSubsidiaertResultat,
      visForsering,
      avslatteDager,
      sendForesporsel,
      subsidiaerTriggers,
    },
    validate: () => {
      // Basic validation: resultat must be defined
      return prinsipaltResultat !== undefined;
    },
  };
}
