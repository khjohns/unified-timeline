import { useState, useMemo, useCallback } from 'react';
import { differenceInDays } from 'date-fns';
import type { GrunnlagResponsResultat, SakState } from '../types/timeline';
import { getConsequence } from '../components/bento/consequenceCallout';

// ============================================================================
// TYPES
// ============================================================================

export interface UseGrunnlagBridgeConfig {
  isOpen: boolean;
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
}

export interface VerdictOption {
  value: string;
  label: string;
  description: string;
  icon: 'check' | 'cross' | 'undo';
  colorScheme: 'green' | 'red' | 'gray';
}

export interface GrunnlagBridgeComputed {
  erEndringMed32_2: boolean;
  erPrekludert: boolean;
  erPassiv: boolean;
  dagerSidenVarsel: number;
  erSnuoperasjon: boolean;
  prinsipaltResultat: string | undefined;
  consequence: { variant: 'success' | 'warning' | 'danger' | 'info'; text: string; snuoperasjonText?: string } | null;
  dynamicPlaceholder: string;
  autoBegrunnelse: string;
  isUpdateMode: boolean;
}

export interface GrunnlagBridgeReturn {
  cardProps: GrunnlagEditState;
  computed: GrunnlagBridgeComputed;
  buildEventData: (params: { grunnlagEventId: string; begrunnelse: string }) => Record<string, unknown>;
  validate: () => boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useGrunnlagBridge(config: UseGrunnlagBridgeConfig): GrunnlagBridgeReturn {
  const { isOpen, grunnlagEvent, lastResponseEvent, sakState } = config;

  const isUpdateMode = !!lastResponseEvent;

  // ========== STATE (consolidated per L1) ==========

  interface FormState {
    varsletITide: boolean;
    resultat: string | undefined;
    resultatError: boolean;
  }

  const getDefaults = useCallback((): FormState => {
    if (isUpdateMode && lastResponseEvent) {
      return {
        varsletITide: true,
        resultat: lastResponseEvent.resultat,
        resultatError: false,
      };
    }
    return {
      varsletITide: true,
      resultat: undefined,
      resultatError: false,
    };
  }, [isUpdateMode, lastResponseEvent]);

  const [formState, setFormState] = useState<FormState>(getDefaults);

  // Reset when isOpen transitions to true (state-during-render pattern per L2)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFormState(getDefaults());
    }
  }

  const { varsletITide, resultat, resultatError } = formState;

  // Individual setters for card controls
  const handleVarsletITideChange = useCallback((v: boolean) => {
    setFormState(prev => ({ ...prev, varsletITide: v }));
  }, []);

  const handleResultatChange = useCallback((v: string) => {
    setFormState(prev => ({ ...prev, resultat: v, resultatError: false }));
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
  const harSubsidiaereSvar = sakState?.er_subsidiaert_vederlag || sakState?.er_subsidiaert_frist;

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
    harSubsidiaereSvar: !!harSubsidiaereSvar,
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

  // ========== BUILD EVENT DATA (L12) ==========

  const buildEventData = useCallback((params: { grunnlagEventId: string; begrunnelse: string }): Record<string, unknown> => {
    if (isUpdateMode && lastResponseEvent) {
      return {
        original_respons_id: lastResponseEvent.event_id,
        resultat,
        begrunnelse: params.begrunnelse,
        dato_endret: new Date().toISOString().split('T')[0],
      };
    }

    return {
      grunnlag_event_id: params.grunnlagEventId,
      resultat,
      begrunnelse: params.begrunnelse,
      grunnlag_varslet_i_tide: erEndringMed32_2 ? varsletITide : undefined,
      dager_siden_varsel: dagerSidenVarsel > 0 ? dagerSidenVarsel : undefined,
    };
  }, [isUpdateMode, lastResponseEvent, resultat, erEndringMed32_2, varsletITide, dagerSidenVarsel]);

  // ========== VALIDATE ==========

  const validate = useCallback((): boolean => {
    if (!resultat) {
      setFormState(prev => ({ ...prev, resultatError: true }));
      return false;
    }
    return true;
  }, [resultat]);

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

      erPrekludert,
      consequence,
    },
    computed: {
      erEndringMed32_2,
      erPrekludert,
      erPassiv,
      dagerSidenVarsel,
      erSnuoperasjon,
      prinsipaltResultat: resultat,
      consequence,
      dynamicPlaceholder,
      autoBegrunnelse,
      isUpdateMode,
    },
    buildEventData,
    validate,
  };
}
