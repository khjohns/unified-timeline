/**
 * fristDomain.ts — Ren NS 8407 domenelogikk for fristforlengelse.
 *
 * Ingen React-avhengigheter. Alle funksjoner er rene (input → output).
 * Importeres av useFristBridge.ts som tynn React-adapter.
 *
 * Ref: ADR-003 L14, §33 NS 8407:2011
 */

import type { FristBeregningResultat, SubsidiaerTrigger } from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export interface FristFormState {
  fristVarselOk: boolean;
  spesifisertKravOk: boolean;
  foresporselSvarOk: boolean;
  vilkarOppfylt: boolean;
  sendForesporsel: boolean;
  godkjentDager: number;
  begrunnelse: string;
  begrunnelseValidationError: string | undefined;
}

export interface FristDomainConfig {
  varselType?: 'varsel' | 'spesifisert' | 'begrunnelse_utsatt';
  krevdDager: number;
  erSvarPaForesporsel: boolean;
  harTidligereVarselITide: boolean;
  erGrunnlagSubsidiaer: boolean;
  erHelFristSubsidiaerPgaGrunnlag: boolean;
}

export interface FristVisibilityFlags {
  showFristVarselOk: boolean;
  showSpesifisertKravOk: boolean;
  showForesporselSvarOk: boolean;
  showSendForesporsel: boolean;
}

export interface FristComputedValues {
  erPrekludert: boolean;
  erRedusert: boolean;
  prinsipaltResultat: FristBeregningResultat;
  subsidiaertResultat: FristBeregningResultat;
  visSubsidiaertResultat: boolean;
  showGodkjentDager: boolean;
  port2ErSubsidiaer: boolean;
  port3ErSubsidiaer: boolean;
  subsidiaerTriggers: SubsidiaerTrigger[];
  dynamicPlaceholder: string;
  visibility: FristVisibilityFlags;
}

export interface FristDefaultsConfig {
  krevdDager: number;
  isUpdateMode: boolean;
  lastResponseEvent?: {
    godkjent_dager?: number;
  };
  fristTilstand?: Partial<{
    frist_varsel_ok: boolean;
    spesifisert_krav_ok: boolean;
    foresporsel_svar_ok: boolean;
    vilkar_oppfylt: boolean;
  }>;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export function getDefaults(config: FristDefaultsConfig): FristFormState {
  if (config.isUpdateMode && config.lastResponseEvent && config.fristTilstand) {
    return {
      fristVarselOk: config.fristTilstand.frist_varsel_ok ?? true,
      spesifisertKravOk: config.fristTilstand.spesifisert_krav_ok ?? true,
      foresporselSvarOk: config.fristTilstand.foresporsel_svar_ok ?? true,
      vilkarOppfylt: config.fristTilstand.vilkar_oppfylt ?? true,
      sendForesporsel: false,
      godkjentDager: config.lastResponseEvent.godkjent_dager ?? config.krevdDager,
      begrunnelse: '',
      begrunnelseValidationError: undefined,
    };
  }
  return {
    fristVarselOk: true,
    spesifisertKravOk: true,
    foresporselSvarOk: true,
    vilkarOppfylt: true,
    sendForesporsel: false,
    godkjentDager: config.krevdDager,
    begrunnelse: '',
    begrunnelseValidationError: undefined,
  };
}

// ============================================================================
// VISIBILITY
// ============================================================================

export function beregnVisibility(
  state: Pick<FristFormState, 'fristVarselOk'>,
  config: FristDomainConfig,
): FristVisibilityFlags {
  const erBegrunnelseUtsatt = config.varselType === 'begrunnelse_utsatt';

  const showFristVarselOk = (() => {
    if (erBegrunnelseUtsatt) return false;
    if (config.varselType === 'varsel') return true;
    if (config.varselType === 'spesifisert' && !config.harTidligereVarselITide && !config.erSvarPaForesporsel) return true;
    return false;
  })();

  const showSpesifisertKravOk = (() => {
    if (erBegrunnelseUtsatt) return false;
    if (config.varselType !== 'spesifisert') return false;
    if (config.erSvarPaForesporsel) return false;
    return true;
  })();

  const showForesporselSvarOk = (() => {
    if (erBegrunnelseUtsatt) return false;
    return config.erSvarPaForesporsel;
  })();

  const showSendForesporsel = (() => {
    if (erBegrunnelseUtsatt) return false;
    return config.varselType === 'varsel' && state.fristVarselOk === true;
  })();

  return { showFristVarselOk, showSpesifisertKravOk, showForesporselSvarOk, showSendForesporsel };
}

// ============================================================================
// PRECLUSION & REDUCTION
// ============================================================================

export function beregnPreklusjon(
  state: Pick<FristFormState, 'fristVarselOk' | 'foresporselSvarOk'>,
  config: FristDomainConfig,
): boolean {
  const erForesporselSvarForSent = config.erSvarPaForesporsel && state.foresporselSvarOk === false;
  if (erForesporselSvarForSent) return true;
  if (config.varselType === 'varsel') return state.fristVarselOk === false;
  if (config.varselType === 'spesifisert' && !config.harTidligereVarselITide) return state.fristVarselOk === false;
  return false;
}

export function beregnReduksjon(
  state: Pick<FristFormState, 'fristVarselOk' | 'spesifisertKravOk'>,
  config: FristDomainConfig,
): boolean {
  if (config.erSvarPaForesporsel) return false;
  if (config.varselType === 'spesifisert' && config.harTidligereVarselITide) return state.spesifisertKravOk === false;
  if (config.varselType === 'spesifisert' && !config.harTidligereVarselITide) {
    return state.fristVarselOk === true && state.spesifisertKravOk === false;
  }
  return false;
}

// ============================================================================
// RESULT COMPUTATION
// ============================================================================

export function beregnPrinsipaltResultat(data: {
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

export function beregnSubsidiaertResultat(data: {
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
// SUBSIDIARY TRIGGERS
// ============================================================================

export function beregnSubsidiaerTriggers(data: {
  erGrunnlagSubsidiaer: boolean;
  erPrekludert: boolean;
  harHindring: boolean;
}): SubsidiaerTrigger[] {
  const triggers: SubsidiaerTrigger[] = [];
  if (data.erGrunnlagSubsidiaer) triggers.push('grunnlag_avslatt');
  if (data.erPrekludert) triggers.push('preklusjon_varsel');
  if (!data.harHindring) triggers.push('ingen_hindring');
  return triggers;
}

// ============================================================================
// DYNAMIC PLACEHOLDER
// ============================================================================

export function getDynamicPlaceholder(resultat: FristBeregningResultat | undefined): string {
  if (!resultat) return 'Gjør valgene i kortet, deretter skriv begrunnelse...';
  if (resultat === 'godkjent') return 'Begrunn din godkjenning av fristforlengelsen...';
  if (resultat === 'delvis_godkjent') return 'Forklar hvorfor du kun godkjenner deler av fristforlengelsen...';
  return 'Begrunn ditt avslag på fristforlengelsen...';
}

// ============================================================================
// BUILD EVENT DATA
// ============================================================================

export function buildEventData(
  state: FristFormState,
  config: FristDomainConfig,
  computed: {
    prinsipaltResultat: FristBeregningResultat;
    subsidiaertResultat: FristBeregningResultat;
    visSubsidiaertResultat: boolean;
    subsidiaerTriggers: SubsidiaerTrigger[];
  },
  fristKravId: string,
  autoBegrunnelse: string,
): Record<string, unknown> {
  const effectiveGodkjentDager = computed.prinsipaltResultat !== 'avslatt' ? state.godkjentDager : 0;
  return {
    frist_krav_id: fristKravId,
    frist_varsel_ok: state.fristVarselOk,
    spesifisert_krav_ok: state.spesifisertKravOk,
    foresporsel_svar_ok: state.foresporselSvarOk,
    send_foresporsel: state.sendForesporsel,
    vilkar_oppfylt: state.vilkarOppfylt,
    godkjent_dager: effectiveGodkjentDager,
    begrunnelse: state.begrunnelse || autoBegrunnelse,
    auto_begrunnelse: autoBegrunnelse,
    beregnings_resultat: computed.prinsipaltResultat,
    krevd_dager: config.krevdDager,
    subsidiaer_triggers: computed.subsidiaerTriggers.length > 0 ? computed.subsidiaerTriggers : undefined,
    subsidiaer_resultat: computed.visSubsidiaertResultat ? computed.subsidiaertResultat : undefined,
    subsidiaer_godkjent_dager: computed.visSubsidiaertResultat && computed.subsidiaertResultat !== 'avslatt' ? effectiveGodkjentDager : undefined,
    subsidiaer_begrunnelse: computed.visSubsidiaertResultat ? (state.begrunnelse || autoBegrunnelse) : undefined,
  };
}

// ============================================================================
// CONVENIENCE: beregnAlt
// ============================================================================

export function beregnAlt(state: FristFormState, config: FristDomainConfig): FristComputedValues {
  const visibility = beregnVisibility(state, config);
  const erPrekludert = beregnPreklusjon(state, config);
  const erRedusert = beregnReduksjon(state, config);

  const harHindring = state.vilkarOppfylt === true;

  const prinsipaltResultat = beregnPrinsipaltResultat({
    erPrekludert,
    sendForesporsel: state.sendForesporsel,
    harHindring,
    krevdDager: config.krevdDager,
    godkjentDager: state.godkjentDager,
  });

  const subsidiaertResultat = beregnSubsidiaertResultat({
    harHindring,
    krevdDager: config.krevdDager,
    godkjentDager: state.godkjentDager,
  });

  const visSubsidiaertResultat = prinsipaltResultat === 'avslatt';
  const showGodkjentDager = !state.sendForesporsel;

  const port2ErSubsidiaer = (erPrekludert || config.erGrunnlagSubsidiaer) && !state.sendForesporsel;
  const port3ErSubsidiaer = (erPrekludert || !harHindring || config.erGrunnlagSubsidiaer) && !state.sendForesporsel;

  const subsidiaerTriggers = beregnSubsidiaerTriggers({
    erGrunnlagSubsidiaer: config.erGrunnlagSubsidiaer,
    erPrekludert,
    harHindring,
  });

  const dynamicPlaceholder = getDynamicPlaceholder(prinsipaltResultat);

  return {
    erPrekludert,
    erRedusert,
    prinsipaltResultat,
    subsidiaertResultat,
    visSubsidiaertResultat,
    showGodkjentDager,
    port2ErSubsidiaer,
    port3ErSubsidiaer,
    subsidiaerTriggers,
    dynamicPlaceholder,
    visibility,
  };
}
