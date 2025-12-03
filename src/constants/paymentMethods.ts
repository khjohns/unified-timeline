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

// ========== DESCRIPTIVE HELP TEXT ==========

export const VEDERLAGSMETODE_DESCRIPTIONS: Record<string, string> = {
  kontrakt_ep: "Kontraktens enhetspriser (§34.3.1) - Anvendelse av eksisterende enhetspriser. Indeksregulert iht. §26.2.",
  justert_ep: "Justerte enhetspriser (§34.3.2) - Enhetspriser justert for endrede forhold. Indeksregulert iht. §26.2. Krever særskilt varsel.",
  regning: "Regningsarbeid (§30.1) - Oppgjør etter medgått tid og materialer. Delvis indeksregulert (kun timerater). Krever varsel FØR oppstart.",
  overslag: "Regningsarbeid med prisoverslag (§30.2) - Som regning, men med forhåndsgodkjent maksbeløp. Delvis indeksregulert (kun timerater).",
  tilbud: "Entreprenørens tilbud (§34.2.1) - TE gir pristilbud som BH kan akseptere. Ikke indeksregulert."
};
