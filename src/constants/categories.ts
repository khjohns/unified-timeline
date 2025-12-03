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
    value: "forsinkelse_bh",
    label: "Forsinkelse eller svikt i BHs ytelser (§22, §24)"
  },
  {
    value: "grunnforhold",
    label: "Risiko for grunnforhold (§23.1)"
  },
  {
    value: "offentlige_paaleg",
    label: "Offentlige pålegg (§16.3)"
  },
  {
    value: "forsering",
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
    value: "ovrige",
    label: "Øvrige forhold"
  },
];

// ========== UNDERKATEGORIER (Sub-Categories) ==========

export const UNDERKATEGORI_MAP: Record<string, DropdownOption[]> = {
  "endring_initiert_bh": [
    {
      value: "regulaer_eo",
      label: "Regulær endringsordre (§31.1, §31.3) - BH har rett til å endre prosjektet"
    },
    {
      value: "irregulaer_endring",
      label: "Irregulær endring/pålegg uten EO (§32.1) - BH gir ordre uten forutgående EO"
    },
    {
      value: "mengdeendring",
      label: "Mengdeendring (§31.1 siste avsnitt, §34.3) - Endring i mengde av kontraktsarbeid"
    },
  ],

  "forsinkelse_bh": [
    {
      value: "prosjektering",
      label: "Prosjektering (§24.1) - Mangler i prosjekteringsunderlag fra BH"
    },
    {
      value: "arbeidsgrunnlag",
      label: "Svikt i arbeidsgrunnlaget (§22.3, §25) - BH har ikke levert komplett/korrekt arbeidsgrunnlag"
    },
    {
      value: "materialer_bh",
      label: "Materialer fra BH (§22.4) - BH-leverte materialer mangler eller er forsinkert"
    },
    {
      value: "tillatelser",
      label: "Tillatelser og godkjenninger (§16.3) - BH har ikke skaffet nødvendige tillatelser"
    },
    {
      value: "fastmerker",
      label: "Fastmerker og utstikking (§18.4) - BH har ikke etablert korrekte fastmerker"
    },
    {
      value: "foreskrevne_losninger",
      label: "Svikt i BHs foreskrevne løsninger (§24.1) - BHs valgte løsninger er ikke egnet"
    },
    {
      value: "koordinering",
      label: "Koordinering av sideentreprenører (§21) - BH koordinerer ikke andre entreprenører tilfredsstillende"
    },
  ],

  "grunnforhold": [
    {
      value: "uforutsette_grunnforhold",
      label: "Uforutsette grunnforhold (§23.1a) - Grunnforhold avviker fra det som var kjent"
    },
    {
      value: "uriktige_opplysninger",
      label: "Uriktige grunnopplysninger fra BH (§23.1b) - BH har gitt feil informasjon"
    },
    {
      value: "forurensning",
      label: "Forurensning i grunnen (§23.1) - Uventet forurensning oppdages"
    },
    {
      value: "kulturminner",
      label: "Kulturminner (§23.3) - Funn av kulturminner som krever stans og varsling"
    },
  ],

  "forsering": [
    {
      value: "paalegt_forsering",
      label: "Pålagt forsering / omlegging (§31.2) - BH pålegger endret tidsplan som en endring"
    },
    {
      value: "forsering_etter_avslag",
      label: "Forsering ved uberettiget avslag på fristkrav (§33.8) - TE velger å forsere etter avslag"
    },
  ],

  "force_majeure": [
    {
      value: "naturkatastrofe",
      label: "Naturkatastrofe (§33.3) - Flom, ras, storm eller lignende"
    },
    {
      value: "krig_opprør",
      label: "Krig, opprør eller unntakstilstand (§33.3)"
    },
    {
      value: "streik",
      label: "Streik eller lockout (§33.3) - Arbeidskonflikter"
    },
  ],

  "hindringer_bh_risiko": [
    {
      value: "fysiske_hindringer",
      label: "Hindringer på byggeplassen (§33.1c) - Fysiske hindringer BH har risikoen for"
    },
    {
      value: "offentlige_restriksjoner",
      label: "Offentlige restriksjoner (§33.1c) - Myndighetspålagte begrensninger"
    },
    {
      value: "tilstotende_arbeider",
      label: "Tilstøtende arbeider forsinket (§33.1c) - Andre entreprenører forsinker"
    },
  ],

  "offentlige_paaleg": [
    {
      value: "nye_krav",
      label: "Nye myndighetskrav (§16.3) - Nye lover eller forskrifter"
    },
    {
      value: "endrede_vilkaar",
      label: "Endrede tillatelsesvilkår (§16.3) - Endringer i godkjenninger"
    },
  ],

  "ovrige": [
    {
      value: "annet",
      label: "Annet forhold - Andre forhold som ikke passer i kategoriene over"
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
