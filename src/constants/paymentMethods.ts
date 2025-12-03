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
    value: "tilbud",
    label: "Entreprenørens tilbud / Fastpris (§34.2.1)"
  },
  {
    value: "kontrakt_ep",
    label: "Kontraktens enhetspriser (§34.3.1)"
  },
  {
    value: "justert_ep",
    label: "Justerte enhetspriser (§34.3.2)"
  },
  {
    value: "regning",
    label: "Regningsarbeid (§30.1)"
  },
  {
    value: "overslag",
    label: "Regningsarbeid med prisoverslag (§30.2)"
  },
];

// Helper function to get vederlagsmetode label from code
export function getVederlagsmetodeLabel(code: string): string {
  const option = VEDERLAGSMETODER_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}
