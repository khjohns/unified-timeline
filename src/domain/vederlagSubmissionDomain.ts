/**
 * vederlagSubmissionDomain.ts — TE's vederlag submission logic (NS 8407 §34).
 *
 * Pure TypeScript — no React dependencies. Imported by useVederlagSubmissionBridge.ts.
 * Ref: ADR-003 L14, L20
 */

import type { VederlagsMetode } from '../constants/paymentMethods';

// ============================================================================
// TYPES
// ============================================================================

export type VederlagSubmissionScenario = 'new' | 'edit';

export interface VederlagSubmissionFormState {
  metode: VederlagsMetode | undefined;
  belopDirekte: number | undefined;
  kostnadsOverslag: number | undefined;
  kreverJustertEp: boolean;
  varsletForOppstart: boolean;
  harRiggKrav: boolean;
  belopRigg: number | undefined;
  datoKlarOverRigg: string | undefined;
  harProduktivitetKrav: boolean;
  belopProduktivitet: number | undefined;
  datoKlarOverProduktivitet: string | undefined;
  begrunnelse: string;
  begrunnelseValidationError: string | undefined;
}

export interface VederlagSubmissionDefaultsConfig {
  scenario: VederlagSubmissionScenario;
  existing?: {
    metode?: VederlagsMetode;
    belop_direkte?: number;
    kostnads_overslag?: number;
    krever_justert_ep?: boolean;
    varslet_for_oppstart?: boolean;
    begrunnelse?: string;
    saerskilt_krav?: {
      rigg_drift?: { belop?: number; dato_klar_over?: string };
      produktivitet?: { belop?: number; dato_klar_over?: string };
    } | null;
  };
}

export interface VederlagSubmissionVisibility {
  showBelopDirekte: boolean;
  showKostnadsOverslag: boolean;
  showJustertEp: boolean;
  showVarsletForOppstart: boolean;
}

export interface VederlagSubmissionBuildConfig {
  scenario: VederlagSubmissionScenario;
  grunnlagEventId: string;
  datoOppdaget?: string;
  originalEventId?: string;
}

export interface VederlagSubmissionEventData {
  grunnlag_event_id: string;
  metode: VederlagsMetode;
  belop_direkte: number | undefined;
  kostnads_overslag: number | undefined;
  begrunnelse: string;
  krever_justert_ep: boolean | undefined;
  justert_ep_varsel: { dato_sendt: string } | undefined;
  varslet_for_oppstart: boolean | undefined;
  saerskilt_krav: {
    rigg_drift?: { belop?: number; dato_klar_over?: string };
    produktivitet?: { belop?: number; dato_klar_over?: string };
  } | null;
  original_event_id?: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export function getDefaults(config: VederlagSubmissionDefaultsConfig): VederlagSubmissionFormState {
  if (config.scenario === 'edit' && config.existing) {
    const e = config.existing;
    return {
      metode: e.metode,
      belopDirekte: e.belop_direkte,
      kostnadsOverslag: e.kostnads_overslag,
      kreverJustertEp: e.krever_justert_ep ?? false,
      varsletForOppstart: e.varslet_for_oppstart ?? true,
      harRiggKrav: (e.saerskilt_krav?.rigg_drift?.belop ?? 0) > 0,
      belopRigg: e.saerskilt_krav?.rigg_drift?.belop,
      datoKlarOverRigg: e.saerskilt_krav?.rigg_drift?.dato_klar_over,
      harProduktivitetKrav: (e.saerskilt_krav?.produktivitet?.belop ?? 0) > 0,
      belopProduktivitet: e.saerskilt_krav?.produktivitet?.belop,
      datoKlarOverProduktivitet: e.saerskilt_krav?.produktivitet?.dato_klar_over,
      begrunnelse: e.begrunnelse ?? '',
      begrunnelseValidationError: undefined,
    };
  }

  return {
    metode: undefined,
    belopDirekte: undefined,
    kostnadsOverslag: undefined,
    kreverJustertEp: false,
    varsletForOppstart: true,
    harRiggKrav: false,
    belopRigg: undefined,
    datoKlarOverRigg: undefined,
    harProduktivitetKrav: false,
    belopProduktivitet: undefined,
    datoKlarOverProduktivitet: undefined,
    begrunnelse: '',
    begrunnelseValidationError: undefined,
  };
}

// ============================================================================
// VISIBILITY
// ============================================================================

export function beregnVisibility(
  state: Pick<VederlagSubmissionFormState, 'metode'>,
): VederlagSubmissionVisibility {
  const metode = state.metode;
  return {
    showBelopDirekte: metode === 'ENHETSPRISER' || metode === 'FASTPRIS_TILBUD',
    showKostnadsOverslag: metode === 'REGNINGSARBEID',
    showJustertEp: metode === 'ENHETSPRISER',
    showVarsletForOppstart: metode === 'REGNINGSARBEID',
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export function beregnCanSubmit(state: VederlagSubmissionFormState): boolean {
  if (!state.metode) return false;

  // Check amount
  if (state.metode === 'REGNINGSARBEID') {
    // Kostnadsoverslag is optional per §30.2 but begrunnelse is required
  } else {
    // ENHETSPRISER / FASTPRIS_TILBUD need belop_direkte
    if (state.belopDirekte === undefined) return false;
  }

  // Begrunnelse required (min 10 chars)
  if (state.begrunnelse.length < 10) return false;

  return true;
}

// ============================================================================
// DYNAMIC PLACEHOLDER
// ============================================================================

export function getDynamicPlaceholder(metode: VederlagsMetode | undefined): string {
  if (!metode) return 'Velg beregningsmetode for å begynne...';
  if (metode === 'ENHETSPRISER') return 'Begrunn kravets omfang med referanse til kontraktens enhetspriser (§34.3)...';
  if (metode === 'REGNINGSARBEID') return 'Begrunn behovet for regningsarbeid og estimer omfanget (§34.4)...';
  return 'Begrunn tilbudt fastpris (§34.2.1)...';
}

// ============================================================================
// TE STATUS SUMMARY
// ============================================================================

export interface TeStatusSummaryConfig {
  scenario: VederlagSubmissionScenario;
  existingBelop?: number;
}

export function beregnTeStatusSummary(
  state: Pick<VederlagSubmissionFormState, 'metode' | 'belopDirekte' | 'kostnadsOverslag'>,
  config: TeStatusSummaryConfig,
): string | null {
  if (!state.metode) return null;

  const belop = state.metode === 'REGNINGSARBEID'
    ? state.kostnadsOverslag
    : state.belopDirekte;

  if (config.scenario === 'edit') {
    if (belop !== undefined && belop > 0) {
      if (config.existingBelop && config.existingBelop !== belop) {
        return `Justerer krav fra kr ${formatCompact(config.existingBelop)} til kr ${formatCompact(belop)}`;
      }
      return `Oppdaterer krav om kr ${formatCompact(belop)}`;
    }
    return 'Oppdaterer vederlagskrav';
  }

  // new scenario
  if (belop !== undefined && belop > 0) {
    return `Krav om kr ${formatCompact(belop)} i vederlag`;
  }
  return 'Sender vederlagskrav';
}

function formatCompact(n: number): string {
  return n.toLocaleString('nb-NO', { maximumFractionDigits: 0 });
}

// ============================================================================
// BUILD EVENT DATA
// ============================================================================

export function buildEventData(
  state: VederlagSubmissionFormState,
  config: VederlagSubmissionBuildConfig,
): VederlagSubmissionEventData {
  if (!state.metode) throw new Error('metode is required');

  const isRegning = state.metode === 'REGNINGSARBEID';
  const isEnhetspriser = state.metode === 'ENHETSPRISER';

  // Build justert_ep_varsel (§34.3.3)
  const justertEpVarsel = isEnhetspriser && state.kreverJustertEp && config.datoOppdaget
    ? { dato_sendt: config.datoOppdaget }
    : undefined;

  // Build saerskilt_krav (§34.1.3)
  const saerskiltKrav = state.harRiggKrav || state.harProduktivitetKrav
    ? {
        rigg_drift: state.harRiggKrav
          ? { belop: state.belopRigg, dato_klar_over: state.datoKlarOverRigg }
          : undefined,
        produktivitet: state.harProduktivitetKrav
          ? { belop: state.belopProduktivitet, dato_klar_over: state.datoKlarOverProduktivitet }
          : undefined,
      }
    : null;

  const result: VederlagSubmissionEventData = {
    grunnlag_event_id: config.grunnlagEventId,
    metode: state.metode,
    belop_direkte: isRegning ? undefined : state.belopDirekte,
    kostnads_overslag: isRegning ? state.kostnadsOverslag : undefined,
    begrunnelse: state.begrunnelse,
    krever_justert_ep: isEnhetspriser ? state.kreverJustertEp : undefined,
    justert_ep_varsel: justertEpVarsel,
    varslet_for_oppstart: isRegning ? state.varsletForOppstart : undefined,
    saerskilt_krav: saerskiltKrav,
  };

  if (config.originalEventId) {
    result.original_event_id = config.originalEventId;
  }

  return result;
}

// ============================================================================
// EVENT TYPE
// ============================================================================

export function getEventType(config: { scenario: VederlagSubmissionScenario }): string {
  switch (config.scenario) {
    case 'new': return 'vederlag_krav_sendt';
    case 'edit': return 'vederlag_krav_oppdatert';
  }
}
