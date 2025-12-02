/**
 * Varsel Metoder (Warning/Notification Methods)
 * How the contractor notified the client about the issue
 *
 * Based on legacy implementation
 */

import { DropdownOption } from './categories';

// ========== VARSEL METODER ==========

export const VARSEL_METODER_OPTIONS: DropdownOption[] = [
  { value: "epost", label: "E-post" },
  { value: "byggemote", label: "Byggemøte" },
  { value: "brev", label: "Brev" },
  { value: "telefon", label: "Telefon" },
  { value: "prosjektportal", label: "Prosjektportal (Catenda/BIM360)" },
  { value: "annet", label: "Annet" },
];

// Helper function to get varsel metode label from code
export function getVarselMetodeLabel(code: string): string {
  const option = VARSEL_METODER_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}

// Helper to get multiple labels
export function getVarselMetoderLabels(codes: string[]): string {
  return codes.map(code => getVarselMetodeLabel(code)).join(", ");
}
