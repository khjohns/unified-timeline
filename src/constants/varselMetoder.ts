/**
 * Varsel Metoder (Warning/Notification Methods)
 * How the contractor notified the client about the issue
 *
 * Basert på NS 8407 §5 Varsler og krav:
 * - Skriftlig til partenes representanter (§9) eller avtalte adresser
 * - E-post til avtalt adresse regnes som skriftlig
 * - Innført i referat (§4.2) regnes som skriftlig
 *
 * NB: Muntlige varsler (telefon) er IKKE gyldige iht. §5.
 */

import { DropdownOption } from './categories';

// ========== VARSEL METODER (§5) ==========

export const VARSEL_METODER_OPTIONS: DropdownOption[] = [
  { value: "epost", label: "E-post til avtalt adresse" },
  { value: "brev", label: "Brev til representant" },
  { value: "byggemote", label: "Innført i byggemøtereferat (§4.2)" },
  { value: "prosjektportal", label: "Prosjektportal (Catenda/BIM360)" },
  { value: "system", label: "System (sendes automatisk)" },
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
