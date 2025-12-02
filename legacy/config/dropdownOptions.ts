/**
 * Dropdown options for form fields
 * Extracted from constants.ts
 */

export const HOVEDKATEGORI_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "100000000", label: "Endring initiert av BH (§31.1)" },
    { value: "100000001", label: "Forsinkelse eller svikt i BHs ytelser (§22, §24)" },
    { value: "100000002", label: "Risiko for grunnforhold (§23.1)" },
    { value: "100000003", label: "Offentlige pålegg (§16.3)" },
    { value: "100000004", label: "Forsering / Tidsmessig omlegging" },
    { value: "100000005", label: "Force majeure (§33.3)" },
    { value: "100000006", label: "Hindringer BH har risikoen for (§33.1c)" },
    { value: "100000007", label: "Øvrige forhold" },
];

export const UNDERKATEGORI_MAP: Record<string, { label: string; value: string }[]> = {
    "100000000": [
        { value: "110000000", label: "Regulær endringsordre (§31.1, §31.3) - BH har rett til å endre prosjektet" },
        { value: "110000001", label: "Irregulær endring/pålegg uten EO (§32.1) - BH gir ordre uten forutgående EO" },
        { value: "110000002", label: "Mengdeendring (§31.1 siste avsnitt, §34.3) - Endring i mengde av kontraktsarbeid" },
    ],
    "100000001": [
        { value: "120000000", label: "Prosjektering (§24.1) - Mangler i prosjekteringsunderlag fra BH" },
        { value: "120000001", label: "Svikt i arbeidsgrunnlaget (§22.3, §25) - BH har ikke levert komplett/korrekt arbeidsgrunnlag. TEs plikt til å undersøke og varsle (§25)" },
        { value: "120000002", label: "Materialer fra BH (§22.4) - BH-leverte materialer mangler eller er forsinkert" },
        { value: "120000003", label: "Tillatelser og godkjenninger (§16.3) - BH har ikke skaffet nødvendige tillatelser" },
        { value: "120000004", label: "Fastmerker og utstikking (§18.4) - BH har ikke etablert korrekte fastmerker" },
        { value: "120000005", label: "Svikt i BHs foreskrevne løsninger (§24.1) - BHs valgte løsninger er ikke egnet" },
        { value: "120000006", label: "Koordinering av sideentreprenører (§21) - BH koordinerer ikke andre entreprenører tilfredsstillende" },
    ],
    "100000002": [
        { value: "130000000", label: "Uforutsette grunnforhold (§23.1a) - Grunnforhold avviker fra det som var kjent" },
        { value: "130000001", label: "Uriktige grunnopplysninger fra BH (§23.1b) - BH har gitt feil informasjon" },
        { value: "130000002", label: "Forurensning i grunnen (§23.1) - Uventet forurensning oppdages" },
        { value: "130000003", label: "Kulturminner (§23.3) - Funn av kulturminner som krever stans og varsling" },
    ],
    "100000004": [
        { value: "140000000", label: "Pålagt forsering / omlegging (§31.2) - BH pålegger endret tidsplan som en endring" },
        { value: "140000001", label: "Forsering ved uberettiget avslag på fristkrav (§33.8) - TE velger å forsere etter avslag" },
    ],
    "100000006": [
        { value: "160000000", label: "Hindringer på byggeplassen (§33.1c) - Fysiske hindringer BH har risikoen for" },
        { value: "160000001", label: "Offentlige restriksjoner (§33.1c) - Myndighetspålagte begrensninger" },
        { value: "160000002", label: "Tilstøtende arbeider forsinket (§33.1c) - Andre entreprenører forsinker" },
    ],
};

export const VEDERLAGSMETODER_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "100000000", label: "Entreprenørens tilbud (§34.2.1)" },
    { value: "100000001", label: "Kontraktens enhetspriser (§34.3.1)" },
    { value: "100000002", label: "Justerte enhetspriser (§34.3.2)" },
    { value: "100000003", label: "Regningsarbeid (§30.1)" },
];

export const BH_VEDERLAGSSVAR_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "100000000", label: "Godkjent fullt ut" },
    { value: "100000001", label: "Delvis godkjent" },
    { value: "100000002", label: "Avslått (uenig i grunnlag)" },
    { value: "100000003", label: "Avslått (for sent varslet)" },
    { value: "100000004", label: "Avventer (ber om nærmere spesifikasjon)" },
    { value: "100000005", label: "Godkjent med annen metode" },
];

export const BH_FRISTSVAR_OPTIONS = [
    { value: "", label: "— Velg —" },
    { value: "100000000", label: "Godkjent fullt ut" },
    { value: "100000001", label: "Delvis godkjent (enig i grunnlag, bestrider beregning)" },
    { value: "100000002", label: "Avslått (uenig i grunnlag)" },
    { value: "100000003", label: "Avslått (for sent varslet)" },
    { value: "100000004", label: "Avventer (ber om nærmere spesifikasjon)" },
];
