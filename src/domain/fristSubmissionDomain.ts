/**
 * fristSubmissionDomain.ts — TE's frist submission logic (NS 8407 §33).
 *
 * Pure TypeScript — no React dependencies. Imported by useFristSubmissionBridge.ts.
 * Ref: ADR-003 L14
 */

import { differenceInDays } from 'date-fns';
import type { FristVarselType, VarselInfo } from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export type SubmissionScenario = 'new' | 'spesifisering' | 'foresporsel' | 'edit';

export interface FristSubmissionFormState {
  varselType: FristVarselType | undefined;
  tidligereVarslet: boolean;
  varselDato: string | undefined;
  antallDager: number;
  nySluttdato: string | undefined;
  begrunnelse: string;
  begrunnelseValidationError: string | undefined;
}

export interface FristSubmissionDefaultsConfig {
  scenario: SubmissionScenario;
  existingVarselDato?: string;
  existing?: {
    varsel_type: FristVarselType;
    antall_dager?: number;
    begrunnelse?: string;
    frist_varsel?: { dato_sendt: string; metode: string[] };
    ny_sluttdato?: string;
  };
}

export interface FristSubmissionVisibilityConfig {
  scenario: SubmissionScenario;
}

export interface FristSubmissionVisibility {
  showSegmentedControl: boolean;
  segmentOptions: { value: string; label: string }[];
  showVarselSection: boolean;
  showKravSection: boolean;
  showForesporselAlert: boolean;
  begrunnelseRequired: boolean;
}

export interface FristSubmissionBuildConfig {
  scenario: SubmissionScenario;
  grunnlagEventId: string;
  erSvarPaForesporsel?: boolean;
  originalEventId?: string;  // for revision/specification events
}

export interface FristSubmissionEventData {
  grunnlag_event_id: string;
  varsel_type: FristVarselType | undefined;
  frist_varsel: VarselInfo | undefined;
  spesifisert_varsel: VarselInfo | undefined;
  antall_dager: number | undefined;
  begrunnelse: string | undefined;
  ny_sluttdato: string | undefined;
  er_svar_pa_foresporsel: boolean | undefined;
  original_event_id?: string;
  dato_revidert?: string;
  dato_spesifisert?: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export function getDefaults(config: FristSubmissionDefaultsConfig): FristSubmissionFormState {
  if (config.scenario === 'edit' && config.existing) {
    return {
      varselType: config.existing.varsel_type,
      tidligereVarslet: !!config.existing.frist_varsel,
      varselDato: config.existing.frist_varsel?.dato_sendt,
      antallDager: config.existing.antall_dager ?? 0,
      nySluttdato: config.existing.ny_sluttdato,
      begrunnelse: config.existing.begrunnelse ?? '',
      begrunnelseValidationError: undefined,
    };
  }

  if (config.scenario === 'spesifisering') {
    return {
      varselType: 'spesifisert',
      tidligereVarslet: true,
      varselDato: config.existingVarselDato,
      antallDager: 0,
      nySluttdato: undefined,
      begrunnelse: '',
      begrunnelseValidationError: undefined,
    };
  }

  return {
    varselType: undefined,
    tidligereVarslet: false,
    varselDato: undefined,
    antallDager: 0,
    nySluttdato: undefined,
    begrunnelse: '',
    begrunnelseValidationError: undefined,
  };
}

// ============================================================================
// VISIBILITY
// ============================================================================

const NEW_SEGMENTS = [
  { value: 'varsel', label: 'Varsel' },
  { value: 'spesifisert', label: 'Krav' },
];

const FORESPORSEL_SEGMENTS = [
  { value: 'spesifisert', label: 'Krav' },
  { value: 'begrunnelse_utsatt', label: 'Utsatt beregning' },
];

export function beregnVisibility(
  state: Pick<FristSubmissionFormState, 'varselType'>,
  config: FristSubmissionVisibilityConfig,
): FristSubmissionVisibility {
  const showSegmentedControl = config.scenario === 'new' || config.scenario === 'foresporsel';
  const segmentOptions = config.scenario === 'foresporsel' ? FORESPORSEL_SEGMENTS : NEW_SEGMENTS;

  const showVarselSection = state.varselType === 'varsel' || state.varselType === 'spesifisert';
  const showKravSection = state.varselType === 'spesifisert';
  const showForesporselAlert = config.scenario === 'foresporsel';
  const begrunnelseRequired = state.varselType === 'spesifisert' || state.varselType === 'begrunnelse_utsatt';

  return {
    showSegmentedControl,
    segmentOptions,
    showVarselSection,
    showKravSection,
    showForesporselAlert,
    begrunnelseRequired,
  };
}

// ============================================================================
// PREKLUSION WARNING
// ============================================================================

export function beregnPreklusjonsvarsel(config: {
  datoOppdaget?: string;
}): { variant: 'warning' | 'danger'; dager: number } | null {
  if (!config.datoOppdaget) return null;
  const dager = differenceInDays(new Date(), new Date(config.datoOppdaget));
  if (dager > 14) return { variant: 'danger', dager };
  if (dager > 7) return { variant: 'warning', dager };
  return null;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function beregnCanSubmit(
  state: FristSubmissionFormState,
  _config: FristSubmissionVisibilityConfig,
): boolean {
  if (!state.varselType) return false;

  if (state.varselType === 'varsel') return true;

  if (state.varselType === 'spesifisert') {
    if (state.antallDager <= 0) return false;
    if (state.begrunnelse.length < 10) return false;
    return true;
  }

  if (state.varselType === 'begrunnelse_utsatt') {
    return state.begrunnelse.length >= 10;
  }

  return false;
}

// ============================================================================
// DYNAMIC PLACEHOLDER
// ============================================================================

export function getDynamicPlaceholder(varselType: FristVarselType | undefined): string {
  if (!varselType) return 'Velg kravtype i kortet for å begynne...';
  if (varselType === 'varsel') return 'Beskriv kort hva som forårsaker behovet for fristforlengelse (valgfritt)...';
  if (varselType === 'spesifisert') return 'Begrunn antall dager krevd og den virkning hindringen har hatt for fremdriften (§33.5)...';
  return 'Begrunn hvorfor grunnlaget for å beregne kravet ikke foreligger (§33.6.2 b)...';
}

// ============================================================================
// BUILD EVENT DATA
// ============================================================================

export function buildEventData(
  state: FristSubmissionFormState,
  config: FristSubmissionBuildConfig,
): FristSubmissionEventData {
  const today = new Date().toISOString().split('T')[0];

  // Build frist_varsel (§33.4 notice)
  const fristVarsel: VarselInfo | undefined =
    state.tidligereVarslet && state.varselDato
      ? { dato_sendt: state.varselDato, metode: ['digital_oversendelse'] }
      : !state.tidligereVarslet
        ? { dato_sendt: today, metode: ['digital_oversendelse'] }
        : undefined;

  // Build spesifisert_varsel (§33.6.1) — for specified claims
  const spesifisertVarsel: VarselInfo | undefined =
    state.varselType === 'spesifisert'
      ? { dato_sendt: today, metode: ['digital_oversendelse'] }
      : undefined;

  const result: FristSubmissionEventData = {
    grunnlag_event_id: config.grunnlagEventId,
    varsel_type: state.varselType,
    frist_varsel: fristVarsel,
    spesifisert_varsel: spesifisertVarsel,
    antall_dager: state.varselType === 'spesifisert' ? state.antallDager : undefined,
    begrunnelse: state.begrunnelse || undefined,
    ny_sluttdato: state.nySluttdato || undefined,
    er_svar_pa_foresporsel: config.erSvarPaForesporsel,
  };

  if (config.originalEventId) {
    result.original_event_id = config.originalEventId;
    if (config.scenario === 'edit') {
      result.dato_revidert = today;
    } else if (config.scenario === 'spesifisering' || config.scenario === 'foresporsel') {
      result.dato_spesifisert = today;
    }
  }

  return result;
}

// ============================================================================
// EVENT TYPE
// ============================================================================

export function getEventType(config: { scenario: SubmissionScenario }): string {
  switch (config.scenario) {
    case 'new': return 'frist_krav_sendt';
    case 'spesifisering': return 'frist_krav_spesifisert';
    case 'foresporsel': return 'frist_krav_spesifisert';
    case 'edit': return 'frist_krav_oppdatert';
  }
}

// ============================================================================
// REVISION CONTEXT
// ============================================================================

export interface RevisionContextConfig {
  scenario?: SubmissionScenario;
  bhResponse?: {
    resultat: string;
    godkjent_dager?: number;
    begrunnelse?: string;
  };
  krevdDager?: number;
  foresporselDeadline?: string;
}

export interface RevisionContext {
  bhResultat: string;
  bhGodkjentDager?: number;
  bhBegrunnelse?: string;
  krevdDager?: number;
  isSpecification: boolean;
  isForesporsel: boolean;
  foresporselDeadline?: string;
}

export function beregnRevisionContext(
  config: RevisionContextConfig,
): RevisionContext | null {
  if (!config.bhResponse) return null;

  const isSpec = config.scenario === 'spesifisering' || config.scenario === 'foresporsel';

  return {
    bhResultat: config.bhResponse.resultat,
    bhGodkjentDager: config.bhResponse.godkjent_dager,
    bhBegrunnelse: config.bhResponse.begrunnelse,
    krevdDager: config.krevdDager,
    isSpecification: isSpec,
    isForesporsel: config.scenario === 'foresporsel',
    foresporselDeadline: config.foresporselDeadline,
  };
}
