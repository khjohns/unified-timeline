/**
 * Hovedkategori and Underkategori Constants
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * Enhanced with complete legal references and claim type information
 * from Komplett_Python_Datasett_NS 8407.py
 *
 * VIKTIG: To parallelle varslingsplikter for prosjekteringsfeil (§25):
 *
 * §25.1.2: Forhold som FORSTYRRER GJENNOMFØRINGEN
 *   - Aktsomhet: "burde" (normal faglig aktsomhet)
 *   - TE må aktivt undersøke og varsle
 *
 * §25.2: Prosjektering UEGNET til å oppfylle §14-krav (funksjonskrav)
 *   - Aktsomhet: "måtte" (kun åpenbare feil)
 *   - TE vurderer "i rimelig utstrekning"
 *
 * Begge kan gjelde for samme prosjekteringsfeil, men med ulik terskel.
 */

export interface DropdownOption {
  value: string;
  label: string;
}

// Vederlagsmetode type for standard methods
export type StandardVederlagsmetode =
  | 'Enhetspriser (34.3)'
  | 'Regningsarbeid (34.4)'
  | 'Ingen (Kun fristforlengelse)'
  | 'Avtalt/Tilbud (34.2.1)';

// Type krav - what can be claimed
export type TypeKrav = 'Tid' | 'Penger' | 'Tid og Penger';

// Enhanced Underkategori with legal references
export interface Underkategori {
  kode: string;
  label: string;
  hjemmel_basis: string;      // The triggering paragraph
  beskrivelse: string;
  varselkrav_ref: string;     // Legal reference for notification requirement
  gruppe?: string;            // Optional grouping for UI display
}

// Enhanced Hovedkategori with full legal context
export interface Hovedkategori {
  kode: string;
  label: string;
  beskrivelse: string;
  hjemmel_frist: string;                  // Reference in section 33
  hjemmel_vederlag: string | null;        // Reference in section 34 (null for FM)
  standard_vederlagsmetode: StandardVederlagsmetode;
  type_krav: TypeKrav;
  underkategorier: Underkategori[];
}

// Complete NS 8407 claim structure with legal references
export const KRAV_STRUKTUR_NS8407: Hovedkategori[] = [
  {
    kode: 'ENDRING',
    label: 'Endringer',
    beskrivelse: 'Avvik fra det opprinnelig avtalte, enten ved formell ordre, endrede rammebetingelser eller pålegg.',
    hjemmel_frist: '33.1 a)',
    hjemmel_vederlag: '34.1.1',
    standard_vederlagsmetode: 'Enhetspriser (34.3)',
    type_krav: 'Tid og Penger',
    underkategorier: [
      {
        kode: 'EO',
        label: 'Formell endringsordre',
        hjemmel_basis: '31.3',
        beskrivelse: 'Skriftlig endringsordre utstedt av byggherren iht. §31.3.',
        varselkrav_ref: '33.4 / 34.1.1',
        gruppe: 'Endringsordrer',
      },
      {
        kode: 'IRREG',
        label: 'Irregulær endring (Pålegg)',
        hjemmel_basis: '32.1',
        beskrivelse: 'Pålegg/anvisning som entreprenøren mener er endring, men som ikke er gitt som endringsordre.',
        varselkrav_ref: '32.2 / 33.4 / 34.1.1',
        gruppe: 'Endringsordrer',
      },
      {
        kode: 'SVAR_VARSEL',
        label: 'Endring via svar på varsel',
        hjemmel_basis: '25.3',
        beskrivelse: 'Byggherrens svar på varsel etter §25 innebærer tiltak som utgjør en endring.',
        varselkrav_ref: '32.2 / 33.4 / 34.1.1',
        gruppe: 'Endringsordrer',
      },
      {
        kode: 'LOV_GJENSTAND',
        label: 'Endring i lover/vedtak (Gjenstand)',
        hjemmel_basis: '14.4',
        beskrivelse: 'Nye offentlige krav som krever fysisk endring av kontraktsgjenstanden.',
        varselkrav_ref: '32.2 / 33.4 / 34.1.1',
        gruppe: 'Lov og forskrift',
      },
      {
        kode: 'LOV_PROSESS',
        label: 'Endring i lover/vedtak (Prosess)',
        hjemmel_basis: '15.2',
        beskrivelse: 'Nye offentlige krav som endrer måten arbeidet må utføres på.',
        varselkrav_ref: '32.2 / 33.4 / 34.1.1',
        gruppe: 'Lov og forskrift',
      },
      {
        kode: 'GEBYR',
        label: 'Endring i gebyrer/avgifter',
        hjemmel_basis: '26.3',
        beskrivelse: 'Endringer i offentlige gebyrer/avgifter etter tilbudstidspunktet.',
        varselkrav_ref: '32.2 / 33.4 / 34.1.1',
        gruppe: 'Lov og forskrift',
      },
      {
        kode: 'SAMORD',
        label: 'Samordning/Omlegging',
        hjemmel_basis: '21.4',
        beskrivelse: 'Pålagt omlegging som følge av samordning utover det påregnelige.',
        varselkrav_ref: '32.2 / 33.4 / 34.1.1',
        gruppe: 'Koordinering',
      },
    ],
  },
  {
    kode: 'SVIKT',
    label: 'Forsinkelse eller svikt ved byggherrens ytelser',
    beskrivelse: 'Forhold definert som byggherrens ytelser eller risiko i kapittel V.',
    hjemmel_frist: '33.1 b)',
    hjemmel_vederlag: '34.1.2',
    standard_vederlagsmetode: 'Regningsarbeid (34.4)',
    type_krav: 'Tid og Penger',
    underkategorier: [
      {
        kode: 'MEDVIRK',
        label: 'Manglende medvirkning/leveranser',
        hjemmel_basis: '22',
        beskrivelse: 'Forsinkede tegninger, beslutninger, fysisk arbeidsgrunnlag (§22.3) eller materialer (§22.4).',
        varselkrav_ref: '25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Medvirkning',
      },
      {
        kode: 'ADKOMST',
        label: 'Manglende tilkomst/råderett',
        hjemmel_basis: '22.2',
        beskrivelse: 'Byggherren har ikke nødvendig råderett over eiendommen.',
        varselkrav_ref: '25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Medvirkning',
      },
      {
        kode: 'GRUNN',
        label: 'Uforutsette grunnforhold',
        hjemmel_basis: '23.1',
        beskrivelse: 'Forhold ved grunnen som avviker fra det entreprenøren hadde grunn til å regne med.',
        varselkrav_ref: '25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Grunnforhold',
      },
      {
        kode: 'KULTURMINNER',
        label: 'Funn av kulturminner',
        hjemmel_basis: '23.3',
        beskrivelse: 'Stans i arbeidet som følge av funn av ukjente kulturminner.',
        varselkrav_ref: '23.3 annet ledd / 33.4 / 34.1.2',
        gruppe: 'Grunnforhold',
      },
      {
        kode: 'PROSJ_RISIKO',
        label: 'Svikt i byggherrens prosjektering',
        hjemmel_basis: '24.1',
        beskrivelse: 'Feil, mangler eller uklarheter i prosjektering/løsninger byggherren har risikoen for.',
        // §25.1.2: Forhold som forstyrrer gjennomføringen ("burde" oppdaget)
        // §25.2: Prosjektering uegnet til å oppfylle §14-krav ("måtte" oppdaget - kun åpenbare feil)
        varselkrav_ref: '25.1.2 / 25.2 / 33.4 / 34.1.2',
        gruppe: 'Prosjektering',
      },
      {
        kode: 'BH_FASTHOLDER',
        label: 'Byggherren fastholder løsning etter varsel',
        hjemmel_basis: '24.2.2 tredje ledd',
        beskrivelse: 'Byggherren fastholder sin prosjektering etter varsel fra entreprenøren, og løsningen viser seg uegnet.',
        // §24.2.2: TE må ha varslet innen 5-ukersfristen om at løsningen ikke oppfyller §14
        varselkrav_ref: '24.2.2 / 33.4 / 34.1.2',
        gruppe: 'Prosjektering',
      },
    ],
  },
  {
    kode: 'ANDRE',
    label: 'Andre forhold byggherren har risikoen for',
    beskrivelse: 'Sekkepost for risikoforhold som ikke er endringer eller "ytelser".',
    hjemmel_frist: '33.1 c)',
    hjemmel_vederlag: '34.1.2',
    standard_vederlagsmetode: 'Regningsarbeid (34.4)',
    type_krav: 'Tid og Penger',
    // TOLKNING: §25.1.1 sier "byggherrens ytelser og andre forhold byggherren har risikoen for",
    // så §25.1.2 gjelder som grunnlagsvarsel også for ANDRE-kategorien. Dette kan virke
    // overflødig for underkategorier der BH har gjort en aktiv handling han selv vet om
    // (nektelse, brukstakelse, pålagt stans), men vi inkluderer det for konsistens og
    // for å sikre at TE alltid har dokumentert varsling.
    underkategorier: [
      {
        kode: 'NEKT_MH',
        label: 'Nektelse av kontraktsmedhjelper',
        hjemmel_basis: '10.2',
        beskrivelse: 'Byggherren nekter å godta valgt medhjelper uten saklig grunn.',
        varselkrav_ref: '25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Kontraktsmedhjelpere',
      },
      {
        kode: 'NEKT_TILTRANSPORT',
        label: 'Tvungen tiltransport',
        hjemmel_basis: '12.1.2',
        beskrivelse: 'Byggherren gjennomfører tiltransport til tross for entreprenørens saklige innvendinger etter §12.1.2.',
        varselkrav_ref: '12.1.2 annet ledd / 25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Kontraktsmedhjelpere',
      },
      {
        kode: 'SKADE_BH',
        label: 'Skade forårsaket av byggherren/sideentreprenør',
        hjemmel_basis: '19.1',
        beskrivelse: 'Skade på kontraktsgjenstanden forårsaket av byggherren eller hans kontraktsmedhjelpere.',
        // §20.5 gjelder TEs egne kontraktsstridige utførelser, ikke skade forårsaket av BH
        varselkrav_ref: '25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Kontraktsbrudd',
      },
      {
        kode: 'BRUKSTAKELSE',
        label: 'Urettmessig brukstakelse',
        hjemmel_basis: '38.1 annet ledd',
        beskrivelse: 'Byggherren tar kontraktsgjenstanden i bruk før overtakelse/avtalt tid.',
        varselkrav_ref: '25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Kontraktsbrudd',
      },
      {
        kode: 'STANS_BET',
        label: 'Stans ved betalingsmislighold',
        hjemmel_basis: '29.2',
        beskrivelse: 'Konsekvenser av rettmessig stans grunnet manglende betaling/sikkerhet.',
        // §29.2 krever 24 timers skriftlig varsel før stans
        varselkrav_ref: '29.2 / 25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Stans',
      },
      {
        kode: 'STANS_UENIGHET',
        label: 'Pålagt stans/utsettelse',
        hjemmel_basis: '35.1',
        beskrivelse: 'Byggherren pålegger utsettelse av arbeidet ved uenighet om endring.',
        varselkrav_ref: '25.1.2 / 33.4 / 34.1.2',
        gruppe: 'Stans',
      },
    ],
  },
  {
    kode: 'FORCE_MAJEURE',
    label: 'Force Majeure',
    beskrivelse: 'Ekstraordinære hendelser utenfor partenes kontroll.',
    hjemmel_frist: '33.3',
    hjemmel_vederlag: null,
    standard_vederlagsmetode: 'Ingen (Kun fristforlengelse)',
    type_krav: 'Tid',
    underkategorier: [
      {
        kode: 'FM_EGEN',
        label: 'Force Majeure (Egen)',
        hjemmel_basis: '33.3 første ledd',
        beskrivelse: 'Ekstraordinære værforhold, offentlige påbud/forbud, streik, lockout etc. som rammer entreprenøren direkte.',
        varselkrav_ref: '33.4',
      },
      {
        kode: 'FM_MH',
        label: 'Force Majeure (Medhjelper)',
        hjemmel_basis: '33.3 annet ledd',
        beskrivelse: 'Hindring hos kontraktsmedhjelper som skyldes forhold utenfor dennes kontroll.',
        varselkrav_ref: '33.4',
      },
    ],
  },
];

// ========== LEGACY DROPDOWN OPTIONS (for backwards compatibility) ==========

export const HOVEDKATEGORI_OPTIONS: DropdownOption[] = [
  { value: '', label: '— Velg —' },
  ...KRAV_STRUKTUR_NS8407.map((k) => ({
    value: k.kode,
    label: k.label,
  })),
];

// Generate UNDERKATEGORI_MAP from enhanced structure
export const UNDERKATEGORI_MAP: Record<string, DropdownOption[]> =
  KRAV_STRUKTUR_NS8407.reduce(
    (acc, hovedkategori) => {
      acc[hovedkategori.kode] = hovedkategori.underkategorier.map((u) => ({
        value: u.kode,
        label: `${u.label} (§${u.hjemmel_basis})`,
      }));
      return acc;
    },
    {} as Record<string, DropdownOption[]>
  );

// ========== HELPER FUNCTIONS ==========

// Get underkategorier for a given hovedkategori
export function getUnderkategorier(hovedkategori: string): DropdownOption[] {
  return UNDERKATEGORI_MAP[hovedkategori] || [];
}

// Get hovedkategori label from code (case-insensitive)
export function getHovedkategoriLabel(code: string): string {
  const upperCode = code.toUpperCase();
  const kategori = KRAV_STRUKTUR_NS8407.find((k) => k.kode.toUpperCase() === upperCode);
  return kategori?.label || code;
}

// Get underkategori label from code (case-insensitive)
export function getUnderkategoriLabel(code: string): string {
  const upperCode = code.toUpperCase();
  for (const hovedkategori of KRAV_STRUKTUR_NS8407) {
    const underkategori = hovedkategori.underkategorier.find((u) => u.kode.toUpperCase() === upperCode);
    if (underkategori) return underkategori.label;
  }
  return code;
}

// Get full hovedkategori object by code (case-insensitive)
export function getHovedkategori(code: string): Hovedkategori | undefined {
  const upperCode = code.toUpperCase();
  return KRAV_STRUKTUR_NS8407.find((k) => k.kode.toUpperCase() === upperCode);
}

// Get full underkategori object by code (case-insensitive)
export function getUnderkategoriObj(code: string): Underkategori | undefined {
  const upperCode = code.toUpperCase();
  for (const hovedkategori of KRAV_STRUKTUR_NS8407) {
    const underkategori = hovedkategori.underkategorier.find((u) => u.kode.toUpperCase() === upperCode);
    if (underkategori) return underkategori;
  }
  return undefined;
}

// Group underkategorier by their gruppe field for UI display
// Returns a Map preserving insertion order (groups appear in the order they first occur)
export function getGrupperteUnderkategorier(
  underkategorier: Underkategori[]
): Map<string | null, Underkategori[]> {
  const grupper = new Map<string | null, Underkategori[]>();

  for (const uk of underkategorier) {
    const gruppeNavn = uk.gruppe ?? null;
    if (!grupper.has(gruppeNavn)) {
      grupper.set(gruppeNavn, []);
    }
    grupper.get(gruppeNavn)!.push(uk);
  }

  return grupper;
}

// Check if underkategori is a law change (requires special handling)
export function erLovendring(underkategoriKode: string): boolean {
  return ['LOV_GJENSTAND', 'LOV_PROSESS', 'GEBYR'].includes(underkategoriKode);
}

// Get the correct paragraph reference for law change underkategorier
export function getLovendringParagraf(underkategoriKode: string): string | null {
  switch (underkategoriKode) {
    case 'LOV_GJENSTAND':
      return '14.4';
    case 'LOV_PROSESS':
      return '15.2';
    case 'GEBYR':
      return '26.3';
    default:
      return null;
  }
}

// Check if hovedkategori is Force Majeure (no compensation, only time)
export function erForceMajeure(hovedkategoriKode: string): boolean {
  return hovedkategoriKode === 'FORCE_MAJEURE';
}

// Check if this is an irregular change (special passivity rules apply)
export function erIrregulaerEndring(hovedkategoriKode: string, underkategoriKode: string): boolean {
  return hovedkategoriKode === 'ENDRING' && underkategoriKode === 'IRREG';
}

// Get type krav for a hovedkategori
export function getTypeKrav(hovedkategoriKode: string): TypeKrav | undefined {
  const kategori = getHovedkategori(hovedkategoriKode);
  return kategori?.type_krav;
}

// Get hjemmel references for a claim
export function getHjemmelReferanser(
  hovedkategoriKode: string,
  underkategoriKode?: string
): { frist: string; vederlag: string | null; varsel: string } {
  const hovedkategori = getHovedkategori(hovedkategoriKode);
  const underkategori = underkategoriKode ? getUnderkategoriObj(underkategoriKode) : undefined;

  return {
    frist: hovedkategori?.hjemmel_frist || '',
    vederlag: hovedkategori?.hjemmel_vederlag || null,
    varsel: underkategori?.varselkrav_ref || '',
  };
}
