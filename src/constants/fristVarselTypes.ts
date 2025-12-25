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
    label: "Foreløpig varsel (§33.4)"
  },
  {
    value: "spesifisert",
    label: "Spesifisert krav (§33.6)"
  },
  {
    value: "force_majeure",
    label: "Force majeure-krav (§33.3)"
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
  noytralt: "Foreløpig varsel sendes når omfanget ikke er kjent. Bevarer retten til å fremme spesifisert krav senere.",
  spesifisert: "Krav med konkret antall kalenderdager når du har grunnlag for å beregne omfanget.",
  force_majeure: "Krav om tilleggsfrist ved ekstraordinære hendelser utenfor partenes kontroll."
};
