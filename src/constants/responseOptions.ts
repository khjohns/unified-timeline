/**
 * BH Response Options for all three tracks (Grunnlag, Vederlag, Frist)
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * CRITICAL: Refactored to support subsidiary logic.
 * Vederlag and Frist responses NO LONGER contain "avslatt_uenig_grunnlag" -
 * that would break the separation of tracks.
 */

import { DropdownOption } from './categories';

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
    value: "avvist_uenig",
    label: "Avvist - Uenig i ansvarsgrunnlaget"
  },
  {
    value: "avvist_for_sent",
    label: "Avvist - Varselet kom for sent (preklusjon)"
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
    value: "avventer_spesifikasjon",
    label: "Avventer spesifikasjon - Mangler dokumentasjon"
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
