/**
 * BH Response Options for all three tracks (Grunnlag, Vederlag, Frist)
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * CRITICAL: Refactored to support subsidiary logic.
 * Vederlag and Frist responses NO LONGER contain "avslatt_uenig_grunnlag" -
 * that would break the separation of tracks.
 */

import { DropdownOption } from './categories';
import type { SubsidiaerTrigger } from '../types/timeline';

// ========== GRUNNLAG RESPONSE OPTIONS ==========

export const BH_GRUNNLAGSVAR_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "godkjent",
    label: "Godkjent - BH aksepterer ansvarsgrunnlaget"
  },
  {
    value: "delvis_godkjent",
    label: "Delvis godkjent - BH aksepterer deler av grunnlaget"
  },
  {
    value: "erkjenn_fm",
    label: "Erkjenn Force Majeure (§33.3)"
  },
  {
    value: "avvist_uenig",
    label: "Avvist - Uenig i ansvarsgrunnlaget"
  },
  {
    value: "frafalt",
    label: "Frafall pålegget (§32.3 c) - BH frafaller kravet ved irregulær endring"
  },
  {
    value: "krever_avklaring",
    label: "Krever avklaring - BH trenger mer dokumentasjon"
  },
];

// ========== VEDERLAG RESPONSE OPTIONS ==========
// Forenklet til tre hovedkategorier - årsak til avslag fanges av subsidiaer_triggers

export const BH_VEDERLAGSSVAR_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "godkjent",
    label: "Godkjent - Enighet om sum og metode"
  },
  {
    value: "delvis_godkjent",
    label: "Delvis godkjent - Uenighet om beløp eller metode"
  },
  {
    value: "avslatt",
    label: "Avslått - BH avviser kravet"
  },
  {
    value: "avventer",
    label: "Avventer dokumentasjon - BH trenger mer informasjon"
  },
  {
    value: "hold_tilbake",
    label: "Hold tilbake betaling (§30.2) - Krev overslag for regningsarbeid"
  },
];

// ========== FRIST RESPONSE OPTIONS ==========
// Forenklet til tre hovedkategorier - årsak til avslag fanges av subsidiaer_triggers

export const BH_FRISTSVAR_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "godkjent",
    label: "Godkjent - Enighet om antall dager"
  },
  {
    value: "delvis_godkjent",
    label: "Delvis godkjent - Uenighet om antall dager"
  },
  {
    value: "avslatt",
    label: "Avslått - BH avviser kravet"
  },
  {
    value: "avventer",
    label: "Avventer dokumentasjon - Mangler fremdriftsplan/dokumentasjon"
  },
];

// ========== HELPER FUNCTIONS ==========

export function getBhGrunnlagssvarLabel(code: string): string {
  const option = BH_GRUNNLAGSVAR_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}

export function getBhVederlagssvarLabel(code: string): string {
  const option = BH_VEDERLAGSSVAR_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}

export function getBhFristsvarLabel(code: string): string {
  const option = BH_FRISTSVAR_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}

// ========== HELPER FUNCTIONS FOR ZOD SCHEMAS ==========

/**
 * Get enum values for Zod schema (filters out empty placeholder)
 */
export function getBhGrunnlagssvarValues(): [string, ...string[]] {
  const values = BH_GRUNNLAGSVAR_OPTIONS
    .filter(opt => opt.value !== '')
    .map(opt => opt.value);

  if (values.length === 0) {
    throw new Error('BH_GRUNNLAGSVAR_OPTIONS must have at least one non-empty value');
  }

  return values as [string, ...string[]];
}

export function getBhVederlagssvarValues(): [string, ...string[]] {
  const values = BH_VEDERLAGSSVAR_OPTIONS
    .filter(opt => opt.value !== '')
    .map(opt => opt.value);

  if (values.length === 0) {
    throw new Error('BH_VEDERLAGSSVAR_OPTIONS must have at least one non-empty value');
  }

  return values as [string, ...string[]];
}

export function getBhFristsvarValues(): [string, ...string[]] {
  const values = BH_FRISTSVAR_OPTIONS
    .filter(opt => opt.value !== '')
    .map(opt => opt.value);

  if (values.length === 0) {
    throw new Error('BH_FRISTSVAR_OPTIONS must have at least one non-empty value');
  }

  return values as [string, ...string[]];
}

// ========== DESCRIPTIVE HELP TEXT ==========

export const BH_GRUNNLAGSVAR_DESCRIPTIONS: Record<string, string> = {
  godkjent: "Byggherren aksepterer ansvarsgrunnlaget fullt ut. Vederlag og frist vurderes prinsipalt.",
  delvis_godkjent: "Byggherren aksepterer deler av grunnlaget. Kan påvirke vederlag/frist-vurdering.",
  erkjenn_fm: "§33.3: Byggherren erkjenner at forholdet er Force Majeure. Entreprenøren får kun fristforlengelse, ikke vederlag.",
  avvist_uenig: "Byggherren er uenig i ansvarsgrunnlaget. Vederlag og frist vurderes subsidiært (hvis ansvar hadde foreligget).",
  frafalt: "Byggherren frafaller pålegget (§32.3 c). Kun for irregulære endringer. Arbeidet trenger ikke utføres.",
  krever_avklaring: "Byggherren trenger mer dokumentasjon før beslutning. Angir hvilke dokumenter som mangler."
};

export const BH_VEDERLAGSSVAR_DESCRIPTIONS: Record<string, string> = {
  godkjent: "Enighet om sum og metode. Beløpet utbetales hvis grunnlag også godkjennes (prinsipalt) eller som subsidiær enighet.",
  delvis_godkjent: "Enighet om at det skal betales (prinsipalt eller subsidiært), men uenighet om beløpet (f.eks. antall timer eller påslag).",
  avslatt: "BH avviser kravet. Årsaken (preklusjon, metode, etc.) spesifiseres via subsidiaer_triggers.",
  avventer: "BH kan ikke ta stilling til kravet fordi dokumentasjon mangler. Stopper saksbehandlingstiden ('ballen er hos TE').",
  hold_tilbake: "§30.2: BH holder tilbake betaling inntil kostnadsoverslag for regningsarbeid mottas. Kun for regningsarbeid uten overslag.",
};

export const BH_FRISTSVAR_DESCRIPTIONS: Record<string, string> = {
  godkjent: "Enighet om antall dager (prinsipalt eller subsidiært). Dagene innvilges hvis grunnlag også godkjennes.",
  delvis_godkjent: "BH mener forsinkelsen er kortere enn TE krever; uenighet om hvor mye fremdriften hindres.",
  avslatt: "BH avviser kravet. Årsaken (preklusjon, ingen hindring, etc.) spesifiseres via subsidiaer_triggers.",
  avventer: "Brukes ved nøytrale varsler, eller når fremdriftsplan/dokumentasjon mangler for å vurdere konsekvensen.",
};

// ========== SUBSIDIÆR TRIGGER LABELS ==========

export const SUBSIDIAER_TRIGGER_LABELS: Record<SubsidiaerTrigger, string> = {
  grunnlag_avvist: 'Grunnlag avvist av BH',
  preklusjon_rigg: 'Rigg/drift varslet for sent (§34.1.3)',
  preklusjon_produktivitet: 'Produktivitet varslet for sent (§34.1.3)',
  preklusjon_ep_justering: 'EP-justering varslet for sent (§34.3.3)',
  preklusjon_noytralt: 'Nøytralt varsel for sent (§33.4)',
  preklusjon_spesifisert: 'Spesifisert krav for sent (§33.6)',
  ingen_hindring: 'Ingen reell fremdriftshindring (§33.5)',
  metode_avvist: 'Metode ikke akseptert',
};

export function getSubsidiaerTriggerLabel(trigger: SubsidiaerTrigger): string {
  return SUBSIDIAER_TRIGGER_LABELS[trigger] || trigger;
}
