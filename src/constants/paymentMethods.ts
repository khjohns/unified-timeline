/**
 * Vederlagsmetoder (Payment/Compensation Calculation Methods)
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * Simplified to 3 main methods:
 * - ENHETSPRISER: Covers both kontrakts- and justerte enhetspriser (§34.3)
 * - REGNINGSARBEID: Regningsarbeid with kostnadsoverslag (§30.2/§34.4)
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
  return option?.label || code;
}

// ========== DESCRIPTIVE HELP TEXT ==========

export const VEDERLAGSMETODE_DESCRIPTIONS: Record<VederlagsMetode, string> = {
  ENHETSPRISER: "Enhetspriser (§34.3) - Kontraktens eller justerte enhetspriser. Indeksregulert iht. §26.2. Krever særskilt varsel ved justering (§34.3.3).",
  REGNINGSARBEID: "Regningsarbeid med kostnadsoverslag (§30.2/§34.4) - Oppgjør etter medgått tid og materialer med forhåndsoverslag. Krever varsel FØR oppstart.",
  FASTPRIS_TILBUD: "Fastpris / Tilbud (§34.2.1) - TE gir pristilbud som BH kan akseptere. Ikke indeksregulert.",
};
