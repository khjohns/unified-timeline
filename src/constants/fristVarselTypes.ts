/**
 * Frist Varsel Types (Deadline Extension Warning Types)
 * Based on NS 8407 Norwegian Standard Building Contract §33
 */

import { DropdownOption } from './categories';

// ========== FRIST VARSEL TYPE OPTIONS ==========

export const FRIST_VARSELTYPE_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "noytralt",
    label: "Nøytralt varsel (§33.4)"
  },
  {
    value: "spesifisert",
    label: "Spesifisert krav (§33.6)"
  },
  {
    value: "force_majeure",
    label: "Force majeure (§33.3)"
  },
];

// ========== HELPER FUNCTIONS ==========

export function getFristVarseltypeLabel(code: string): string {
  const option = FRIST_VARSELTYPE_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}

export function getFristVarseltypeValues(): [string, ...string[]] {
  const values = FRIST_VARSELTYPE_OPTIONS
    .filter(opt => opt.value !== '')
    .map(opt => opt.value);

  if (values.length === 0) {
    throw new Error('FRIST_VARSELTYPE_OPTIONS must have at least one non-empty value');
  }

  return values as [string, ...string[]];
}

// ========== DESCRIPTIVE HELP TEXT ==========

export const FRIST_VARSELTYPE_DESCRIPTIONS: Record<string, string> = {
  noytralt: "Nøytralt/Foreløpig varsel (§33.4) - sendes når omfang ikke er kjent. Bevarer rett til senere krav.",
  spesifisert: "Spesifisert krav (§33.6.1) - Konkret krav om antall dager fristforlengelse.",
  force_majeure: "Tilleggsfrist ved force majeure (§33.3) - Frist ved ekstraordinære hendelser utenfor partenes kontroll."
};
