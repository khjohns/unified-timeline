/**
 * Vederlagsmetoder (Payment/Compensation Calculation Methods)
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * Ported from legacy/config/dropdownOptions.ts
 */

import { DropdownOption } from './categories';

// ========== VEDERLAGSMETODER ==========

export const VEDERLAGSMETODER_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "entreprenorens_tilbud",
    label: "Entreprenørens tilbud (§34.2.1)"
  },
  {
    value: "kontraktens_enhetspriser",
    label: "Kontraktens enhetspriser (§34.3.1)"
  },
  {
    value: "justerte_enhetspriser",
    label: "Justerte enhetspriser (§34.3.2)"
  },
  {
    value: "regningsarbeid",
    label: "Regningsarbeid (§30.1)"
  },
];

// Helper function to get vederlagsmetode label from code
export function getVederlagsmetodeLabel(code: string): string {
  const option = VEDERLAGSMETODER_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}
