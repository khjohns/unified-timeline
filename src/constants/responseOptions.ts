/**
 * BH Response Options for Vederlag and Frist claims
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * Ported from legacy/config/dropdownOptions.ts
 */

import { DropdownOption } from './categories';

// ========== BH VEDERLAG RESPONSE OPTIONS ==========

export const BH_VEDERLAGSSVAR_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "godkjent_fullt",
    label: "Godkjent fullt ut"
  },
  {
    value: "delvis_godkjent",
    label: "Delvis godkjent"
  },
  {
    value: "avslatt_uenig_grunnlag",
    label: "Avslått (uenig i grunnlag)"
  },
  {
    value: "avslatt_for_sent",
    label: "Avslått (for sent varslet)"
  },
  {
    value: "avventer_spesifikasjon",
    label: "Avventer (ber om nærmere spesifikasjon)"
  },
  {
    value: "godkjent_annen_metode",
    label: "Godkjent med annen metode"
  },
];

// ========== BH FRIST RESPONSE OPTIONS ==========

export const BH_FRISTSVAR_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "godkjent_fullt",
    label: "Godkjent fullt ut"
  },
  {
    value: "delvis_godkjent_bestrider_beregning",
    label: "Delvis godkjent (enig i grunnlag, bestrider beregning)"
  },
  {
    value: "avslatt_uenig_grunnlag",
    label: "Avslått (uenig i grunnlag)"
  },
  {
    value: "avslatt_for_sent",
    label: "Avslått (for sent varslet)"
  },
  {
    value: "avventer_spesifikasjon",
    label: "Avventer (ber om nærmere spesifikasjon)"
  },
];

// Helper functions
export function getBhVederlagssvarLabel(code: string): string {
  const option = BH_VEDERLAGSSVAR_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}

export function getBhFristsvarLabel(code: string): string {
  const option = BH_FRISTSVAR_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}
