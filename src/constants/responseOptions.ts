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
    value: "avvist_for_sent",
    label: "Avvist - Varselet kom for sent (preklusjon)"
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
// PURE calculation/computation responses - NO "avslatt_uenig_grunnlag"

export const BH_VEDERLAGSSVAR_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "godkjent_fullt",
    label: "Godkjent fullt ut - Enighet om sum og metode"
  },
  {
    value: "delvis_godkjent",
    label: "Delvis godkjent - Uenighet om beløpet"
  },
  {
    value: "godkjent_annen_metode",
    label: "Godkjent med annen metode - BH endrer beregningsmetode"
  },
  {
    value: "hold_tilbake",
    label: "Hold tilbake betaling (§30.2) - Krev overslag for regningsarbeid"
  },
  {
    value: "avventer_spesifikasjon",
    label: "Avventer spesifikasjon - Mangler dokumentasjon"
  },
  {
    value: "avvist_preklusjon_rigg",
    label: "Avvist - Rigg/drift varslet for sent (§34.1.3 preklusjon)"
  },
  {
    value: "avslatt_totalt",
    label: "Avslått totalt - Kun ved dobbeltfakturering e.l. (IKKE grunnlag)"
  },
];

// ========== FRIST RESPONSE OPTIONS ==========
// PURE time calculation responses - NO "avslatt_uenig_grunnlag"

export const BH_FRISTSVAR_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "godkjent_fullt",
    label: "Godkjent fullt ut - Enighet om antall dager"
  },
  {
    value: "delvis_godkjent",
    label: "Delvis godkjent - Uenighet om antall dager"
  },
  {
    value: "avventer_spesifikasjon",
    label: "Avventer spesifikasjon - Mangler fremdriftsplan/dokumentasjon"
  },
  {
    value: "avslatt_ingen_hindring",
    label: "Avslått - Ingen fremdriftshindring (TE hadde slakk)"
  },
  {
    value: "avvist_preklusjon",
    label: "Avvist - Varslet for sent (§33.4/§33.6 preklusjon)"
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
  godkjent: "BH aksepterer ansvarsgrunnlaget fullt ut. Vederlag og frist vurderes prinsipalt.",
  delvis_godkjent: "BH aksepterer deler av grunnlaget. Kan påvirke vederlag/frist-vurdering.",
  erkjenn_fm: "§33.3: BH erkjenner at forholdet er Force Majeure. TE får kun fristforlengelse, ikke vederlag.",
  avvist_uenig: "BH er uenig i ansvarsgrunnlaget. Vederlag og frist vurderes subsidiært (hvis ansvar hadde foreligget).",
  avvist_for_sent: "Varselet kom for sent (preklusjon). Kravet kan tapes helt eller reduseres.",
  frafalt: "BH frafaller pålegget (§32.3 c). Kun for irregulære endringer. Arbeidet trenger ikke utføres.",
  krever_avklaring: "BH trenger mer dokumentasjon før beslutning. Angir hvilke dokumenter som mangler."
};

export const BH_VEDERLAGSSVAR_DESCRIPTIONS: Record<string, string> = {
  godkjent_fullt: "Enighet om sum og metode. Beløpet utbetales hvis grunnlag også godkjennes (prinsipalt) eller som subsidiær enighet.",
  delvis_godkjent: "Enighet om at det skal betales (prinsipalt eller subsidiært), men uenighet om beløpet (f.eks. antall timer eller påslag).",
  godkjent_annen_metode: "BH aksepterer beløpet, men endrer forutsetningen (f.eks. fra 'Regningsarbeid' til 'Fastpris'). Krever ofte aksept fra TE.",
  hold_tilbake: "§30.2: BH holder tilbake betaling inntil kostnadsoverslag for regningsarbeid mottas. Kun for regningsarbeid uten overslag.",
  avventer_spesifikasjon: "BH kan ikke ta stilling til kravet fordi dokumentasjon mangler. Stopper saksbehandlingstiden ('ballen er hos TE').",
  avvist_preklusjon_rigg: "§34.1.3: Krav om rigg/drift ble ikke varslet 'uten ugrunnet opphold'. Kravet kan avvises pga preklusjon.",
  avslatt_totalt: "Kun ved f.eks. dobbeltfakturering. IKKE ved uenighet om grunnlag (det håndteres i Grunnlag-sporet)."
};

export const BH_FRISTSVAR_DESCRIPTIONS: Record<string, string> = {
  godkjent_fullt: "Enighet om antall dager (prinsipalt eller subsidiært). Dagen innvilges hvis grunnlag også godkjennes.",
  delvis_godkjent: "BH mener forsinkelsen er kortere enn TE krever; uenighet om hvor mye fremdriften hindres.",
  avventer_spesifikasjon: "Brukes ved nøytrale varsler, eller når fremdriftsplan/dokumentasjon mangler for å vurdere konsekvensen.",
  avslatt_ingen_hindring: "BH erkjenner grunnlaget, men mener det ikke medførte forsinkelse (f.eks. TE hadde slakk). Dette er et avslag på utregningen av tid, ikke ansvaret.",
  avvist_preklusjon: "§33.4/§33.6: Kravet avvises fordi TE ikke varslet 'uten ugrunnet opphold'. Kravet tapes helt eller reduseres til det BH måtte forstå."
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
