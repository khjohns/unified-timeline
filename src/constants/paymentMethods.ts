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

// Helper function to get vederlagsmetode label from code (case-insensitive)
export function getVederlagsmetodeLabel(code: string | undefined | null): string {
  if (!code) return '';
  const upperCode = code.toUpperCase();
  const option = VEDERLAGSMETODER_OPTIONS.find(opt => opt.value.toUpperCase() === upperCode);
  return option?.label || code;
}

// Short labels uten hjemmel - for inline/kompakt visning
const SHORT_LABELS: Record<VederlagsMetode, string> = {
  ENHETSPRISER: 'Enhetspriser',
  REGNINGSARBEID: 'Regningsarbeid',
  FASTPRIS_TILBUD: 'Fastpris',
};

// Helper function to get short vederlagsmetode label (uten hjemmel)
export function getVederlagsmetodeShortLabel(code: string | undefined | null): string {
  if (!code) return '';
  const upperCode = code.toUpperCase() as VederlagsMetode;
  return SHORT_LABELS[upperCode] || code;
}

// ========== DESCRIPTIVE HELP TEXT ==========

export const VEDERLAGSMETODE_DESCRIPTIONS: Record<VederlagsMetode, string> = {
  ENHETSPRISER: "Oppgjør basert på kontraktens enhetspriser, eventuelt justert for endrede forutsetninger.",
  REGNINGSARBEID: "Oppgjør etter medgått tid og materialer. Entreprenøren skal gi kostnadsoverslag før arbeidet starter.",
  FASTPRIS_TILBUD: "Entreprenøren gir et spesifisert pristilbud som byggherren kan akseptere eller avslå. Indeksreguleres ikke.",
};
