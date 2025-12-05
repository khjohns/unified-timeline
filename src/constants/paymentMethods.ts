/**
 * Vederlagsmetoder (Payment/Compensation Calculation Methods)
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * UPDATED 2025-12-05: Simplified to 3 main methods (uppercase values)
 * - ENHETSPRISER: Covers both kontrakts- and justerte enhetspriser
 * - REGNINGSARBEID: Regningsarbeid with kostnadsoverslag (§30.2)
 * - FASTPRIS_TILBUD: Fastpris / Tilbud (§34.2.1)
 */

import { DropdownOption } from './categories';

// Type definition matching timeline.ts
export type VederlagsMetode = 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD';

// ========== VEDERLAGSMETODER ==========

export const VEDERLAGSMETODER_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "ENHETSPRISER",
    label: "Enhetspriser (§34.3)"
  },
  {
    value: "REGNINGSARBEID",
    label: "Regningsarbeid (§30.2/§34.4)"
  },
  {
    value: "FASTPRIS_TILBUD",
    label: "Fastpris / Tilbud (§34.2.1)"
  },
];

// Helper function to get vederlagsmetode label from code
export function getVederlagsmetodeLabel(code: string): string {
  const option = VEDERLAGSMETODER_OPTIONS.find(opt => opt.value === code);
  // Support legacy codes
  if (!option) {
    const legacyMap: Record<string, string> = {
      'kontrakt_ep': 'Kontraktens enhetspriser (§34.3.1)',
      'justert_ep': 'Justerte enhetspriser (§34.3.2)',
      'regning': 'Regningsarbeid (§30.1)',
      'overslag': 'Regningsarbeid med prisoverslag (§30.2)',
      'tilbud': 'Fastpris / Tilbud (§34.2.1)',
    };
    return legacyMap[code] || code;
  }
  return option.label;
}

// ========== DESCRIPTIVE HELP TEXT ==========

export const VEDERLAGSMETODE_DESCRIPTIONS: Record<string, string> = {
  ENHETSPRISER: "Enhetspriser (§34.3) - Kontraktens eller justerte enhetspriser. Indeksregulert iht. §26.2. Krever særskilt varsel ved justering (§34.3.3).",
  REGNINGSARBEID: "Regningsarbeid med kostnadsoverslag (§30.2/§34.4) - Oppgjør etter medgått tid og materialer med forhåndsoverslag. Krever varsel FØR oppstart.",
  FASTPRIS_TILBUD: "Fastpris / Tilbud (§34.2.1) - TE gir pristilbud som BH kan akseptere. Ikke indeksregulert.",
  // Legacy support
  kontrakt_ep: "Kontraktens enhetspriser (§34.3.1) - Anvendelse av eksisterende enhetspriser. Indeksregulert iht. §26.2.",
  justert_ep: "Justerte enhetspriser (§34.3.2) - Enhetspriser justert for endrede forhold. Indeksregulert iht. §26.2. Krever særskilt varsel.",
  regning: "Regningsarbeid (§30.1) - Oppgjør etter medgått tid og materialer. Delvis indeksregulert (kun timerater). Krever varsel FØR oppstart.",
  overslag: "Regningsarbeid med prisoverslag (§30.2) - Som regning, men med forhåndsgodkjent maksbeløp. Delvis indeksregulert (kun timerater).",
  tilbud: "Entreprenørens tilbud (§34.2.1) - TE gir pristilbud som BH kan akseptere. Ikke indeksregulert."
};
