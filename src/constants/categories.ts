/**
 * Hovedkategori and Underkategori Constants
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * Ported from legacy/config/dropdownOptions.ts with improved codes
 */

export interface DropdownOption {
  value: string;
  label: string;
}

// ========== HOVEDKATEGORIER (Main Categories) ==========

export const HOVEDKATEGORI_OPTIONS: DropdownOption[] = [
  { value: "", label: "— Velg —" },
  {
    value: "endring_initiert_bh",
    label: "Endring initiert av BH (§31.1)"
  },
  {
    value: "forsinkelse_svikt_bh",
    label: "Forsinkelse eller svikt i BHs ytelser (§22, §24)"
  },
  {
    value: "risiko_grunnforhold",
    label: "Risiko for grunnforhold (§23.1)"
  },
  {
    value: "offentlige_paalegg",
    label: "Offentlige pålegg (§16.3)"
  },
  {
    value: "forsering_tidsmessig_omlegging",
    label: "Forsering / Tidsmessig omlegging"
  },
  {
    value: "force_majeure",
    label: "Force majeure (§33.3)"
  },
  {
    value: "hindringer_bh_risiko",
    label: "Hindringer BH har risikoen for (§33.1c)"
  },
  {
    value: "ovrige_forhold",
    label: "Øvrige forhold"
  },
];

// ========== UNDERKATEGORIER (Sub-Categories) ==========

export const UNDERKATEGORI_MAP: Record<string, DropdownOption[]> = {
  "endring_initiert_bh": [
    {
      value: "regulaer_endringsordre",
      label: "Regulær endringsordre (§31.1, §31.3) - BH har rett til å endre prosjektet"
    },
    {
      value: "irregulaer_endring_uten_eo",
      label: "Irregulær endring/pålegg uten EO (§32.1) - BH gir ordre uten forutgående EO"
    },
    {
      value: "mengdeendring",
      label: "Mengdeendring (§31.1 siste avsnitt, §34.3) - Endring i mengde av kontraktsarbeid"
    },
  ],

  "forsinkelse_svikt_bh": [
    {
      value: "prosjektering_mangel",
      label: "Prosjektering (§24.1) - Mangler i prosjekteringsunderlag fra BH"
    },
    {
      value: "svikt_arbeidsgrunnlag",
      label: "Svikt i arbeidsgrunnlaget (§22.3, §25) - BH har ikke levert komplett/korrekt arbeidsgrunnlag. TEs plikt til å undersøke og varsle (§25)"
    },
    {
      value: "materialer_fra_bh",
      label: "Materialer fra BH (§22.4) - BH-leverte materialer mangler eller er forsinkert"
    },
    {
      value: "tillatelser_godkjenninger",
      label: "Tillatelser og godkjenninger (§16.3) - BH har ikke skaffet nødvendige tillatelser"
    },
    {
      value: "fastmerker_utstikking",
      label: "Fastmerker og utstikking (§18.4) - BH har ikke etablert korrekte fastmerker"
    },
    {
      value: "svikt_bh_losninger",
      label: "Svikt i BHs foreskrevne løsninger (§24.1) - BHs valgte løsninger er ikke egnet"
    },
    {
      value: "koordinering_sideentreprenorer",
      label: "Koordinering av sideentreprenører (§21) - BH koordinerer ikke andre entreprenører tilfredsstillende"
    },
  ],

  "risiko_grunnforhold": [
    {
      value: "uforutsette_grunnforhold",
      label: "Uforutsette grunnforhold (§23.1a) - Grunnforhold avviker fra det som var kjent"
    },
    {
      value: "uriktige_grunnopplysninger",
      label: "Uriktige grunnopplysninger fra BH (§23.1b) - BH har gitt feil informasjon"
    },
    {
      value: "forurensning_grunn",
      label: "Forurensning i grunnen (§23.1) - Uventet forurensning oppdages"
    },
    {
      value: "kulturminner",
      label: "Kulturminner (§23.3) - Funn av kulturminner som krever stans og varsling"
    },
  ],

  "forsering_tidsmessig_omlegging": [
    {
      value: "palagt_forsering",
      label: "Pålagt forsering / omlegging (§31.2) - BH pålegger endret tidsplan som en endring"
    },
    {
      value: "forsering_etter_avslag",
      label: "Forsering ved uberettiget avslag på fristkrav (§33.8) - TE velger å forsere etter avslag"
    },
  ],

  "hindringer_bh_risiko": [
    {
      value: "hindringer_byggeplass",
      label: "Hindringer på byggeplassen (§33.1c) - Fysiske hindringer BH har risikoen for"
    },
    {
      value: "offentlige_restriksjoner",
      label: "Offentlige restriksjoner (§33.1c) - Myndighetspålagte begrensninger"
    },
    {
      value: "tilstotende_arbeider_forsinket",
      label: "Tilstøtende arbeider forsinket (§33.1c) - Andre entreprenører forsinker"
    },
  ],
};

// Helper function to get all underkategorier for a given hovedkategori
export function getUnderkategorier(hovedkategori: string): DropdownOption[] {
  return UNDERKATEGORI_MAP[hovedkategori] || [];
}

// Helper function to get hovedkategori label from code
export function getHovedkategoriLabel(code: string): string {
  const option = HOVEDKATEGORI_OPTIONS.find(opt => opt.value === code);
  return option?.label || code;
}

// Helper function to get underkategori label from code
export function getUnderkategoriLabel(code: string): string {
  for (const hovedkategori in UNDERKATEGORI_MAP) {
    const option = UNDERKATEGORI_MAP[hovedkategori].find(opt => opt.value === code);
    if (option) return option.label;
  }
  return code;
}
