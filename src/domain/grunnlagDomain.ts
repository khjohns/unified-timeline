/**
 * grunnlagDomain.ts — Ren NS 8407 domenelogikk for ansvarsgrunnlag.
 *
 * Ingen React-avhengigheter. Alle funksjoner er rene (input → output).
 * Importeres av useGrunnlagBridge.ts som tynn React-adapter.
 *
 * Ref: ADR-003 L14, §25.2 / §32.2 NS 8407:2011
 */

import { differenceInDays } from 'date-fns';
import type { GrunnlagResponsResultat } from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export interface GrunnlagFormState {
  varsletITide: boolean;
  resultat: string | undefined;
  resultatError: boolean;
  begrunnelse: string;
  begrunnelseValidationError: string | undefined;
}

export interface GrunnlagDomainConfig {
  grunnlagEvent?: {
    hovedkategori?: string;
    underkategori?: string;
    dato_varslet?: string;
  };
  isUpdateMode: boolean;
  forrigeResultat?: GrunnlagResponsResultat;
  harSubsidiaereSvar: boolean;
}

export interface VerdictOption {
  value: string;
  label: string;
  description: string;
  icon: 'check' | 'cross' | 'undo';
  colorScheme: 'green' | 'red' | 'gray';
}

export interface GrunnlagDefaultsConfig {
  isUpdateMode: boolean;
  lastResponseEvent?: {
    resultat: GrunnlagResponsResultat;
  };
}

// ============================================================================
// DEFAULTS
// ============================================================================

export function getDefaults(config: GrunnlagDefaultsConfig): GrunnlagFormState {
  if (config.isUpdateMode && config.lastResponseEvent) {
    return {
      varsletITide: true,
      resultat: config.lastResponseEvent.resultat,
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
}

// ============================================================================
// CATEGORY CHECKS
// ============================================================================

export function erEndringMed32_2(event?: { hovedkategori?: string; underkategori?: string }): boolean {
  return event?.hovedkategori === 'ENDRING' && event?.underkategori !== 'EO';
}

export function erPaalegg(event?: { hovedkategori?: string; underkategori?: string }): boolean {
  return event?.hovedkategori === 'ENDRING' &&
    (event?.underkategori === 'IRREG' || event?.underkategori === 'VALGRETT');
}

export function erForceMajeure(event?: { hovedkategori?: string }): boolean {
  return event?.hovedkategori === 'FORCE_MAJEURE';
}

// ============================================================================
// PRECLUSION
// ============================================================================

export function erPrekludert(
  state: Pick<GrunnlagFormState, 'varsletITide'>,
  config: GrunnlagDomainConfig,
): boolean {
  return erEndringMed32_2(config.grunnlagEvent) && state.varsletITide === false;
}

// ============================================================================
// PASSIVITY (§32.3)
// ============================================================================

export function beregnPassivitet(
  event?: { hovedkategori?: string; underkategori?: string; dato_varslet?: string },
): { erPassiv: boolean; dagerSidenVarsel: number } {
  const dagerSidenVarsel = event?.dato_varslet
    ? differenceInDays(new Date(), new Date(event.dato_varslet))
    : 0;

  const erPassiv = erEndringMed32_2(event) && dagerSidenVarsel > 10;

  return { erPassiv, dagerSidenVarsel };
}

// ============================================================================
// SNUOPERASJON
// ============================================================================

export function erSnuoperasjon(
  state: Pick<GrunnlagFormState, 'resultat'>,
  config: GrunnlagDomainConfig,
): boolean {
  if (!config.isUpdateMode || config.forrigeResultat !== 'avslatt') return false;
  return state.resultat === 'godkjent';
}

// ============================================================================
// VERDICT OPTIONS
// ============================================================================

export function getVerdictOptions(config: GrunnlagDomainConfig): VerdictOption[] {
  const opts: VerdictOption[] = [
    { value: 'godkjent', label: 'Godkjent', description: 'Grunnlag anerkjent', icon: 'check', colorScheme: 'green' },
    { value: 'avslatt', label: 'Avslått', description: 'Grunnlag avvist', icon: 'cross', colorScheme: 'red' },
  ];
  if (erPaalegg(config.grunnlagEvent)) {
    opts.push({ value: 'frafalt', label: 'Frafalt', description: 'Pålegget frafalles', icon: 'undo', colorScheme: 'gray' });
  }
  return opts;
}

// ============================================================================
// DYNAMIC PLACEHOLDER
// ============================================================================

export function getDynamicPlaceholder(
  resultat: string | undefined,
  prekludert: boolean,
): string {
  if (!resultat) return 'Velg resultat i kortet til venstre, deretter skriv begrunnelse...';
  if (prekludert && resultat === 'godkjent') return 'Begrunn din preklusjonsinnsigelse og din subsidiære godkjenning...';
  if (prekludert && resultat === 'avslatt') return 'Begrunn din preklusjonsinnsigelse og ditt subsidiære avslag...';
  if (resultat === 'godkjent') return 'Begrunn din vurdering av ansvarsgrunnlaget...';
  if (resultat === 'avslatt') return 'Forklar hvorfor forholdet ikke gir grunnlag for krav...';
  if (resultat === 'frafalt') return 'Begrunn hvorfor pålegget frafalles...';
  return 'Begrunn din vurdering...';
}

// ============================================================================
// BUILD EVENT DATA
// ============================================================================

export function buildEventData(
  state: GrunnlagFormState,
  config: GrunnlagDomainConfig & {
    grunnlagEventId: string;
    lastResponseEventId?: string;
  },
): Record<string, unknown> {
  const isEndring = erEndringMed32_2(config.grunnlagEvent);
  const { dagerSidenVarsel } = beregnPassivitet(config.grunnlagEvent);

  if (config.isUpdateMode && config.lastResponseEventId) {
    return {
      original_respons_id: config.lastResponseEventId,
      resultat: state.resultat,
      begrunnelse: state.begrunnelse,
      dato_endret: new Date().toISOString().split('T')[0],
    };
  }

  return {
    grunnlag_event_id: config.grunnlagEventId,
    resultat: state.resultat,
    begrunnelse: state.begrunnelse,
    grunnlag_varslet_i_tide: isEndring ? state.varsletITide : undefined,
    dager_siden_varsel: dagerSidenVarsel > 0 ? dagerSidenVarsel : undefined,
  };
}
