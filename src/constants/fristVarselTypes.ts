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
    label: "Varsel om fristforlengelse (§33.4)"
  },
  {
    value: "spesifisert",
    label: "Spesifisert krav med antall dager (§33.6.1)"
  },
  {
    value: "begrunnelse_utsatt",
    label: "Begrunnelse for manglende beregningsgrunnlag (§33.6.2 b)"
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
  noytralt: "Varsel sendes «uten ugrunnet opphold», selv om du ennå ikke kan fremsette et spesifisert krav (§33.4).",
  spesifisert: "Når du har grunnlag for å beregne omfanget, skal du angi og begrunne antall dager (§33.6.1).",
  begrunnelse_utsatt: "Begrunn hvorfor grunnlaget for å beregne kravet ikke foreligger (§33.6.2 b). Bestemmelsen i §33.6.1 gjelder videre.",
};
