/**
 * Hovedkategori and Underkategori Constants
 * Based on NS 8407 Norwegian Standard Building Contract
 *
 * Enhanced with complete legal references and claim type information
 * from Komplett_Python_Datasett_NS 8407.py
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
        hjemmel_basis: '31.1',
        beskrivelse: 'Skriftlig endringsordre utstedt av byggherren.',
        varselkrav_ref: '31.3 (Mottatt ordre)',
      },
      {
        kode: 'IRREG',
        label: 'Irregulær endring (Pålegg)',
        hjemmel_basis: '32.1',
        beskrivelse: 'Pålegg/anvisning som TE mener er endring, men som ikke er gitt som EO.',
        varselkrav_ref: '32.2',
      },
      {
        kode: 'SVAR_VARSEL',
        label: 'Endring via svar på varsel',
        hjemmel_basis: '25.3 / 32.3',
        beskrivelse: 'BHs svar på varsel om svikt/mangler innebærer en endring (f.eks. nye løsninger).',
        varselkrav_ref: '32.2',
      },
      {
        kode: 'LOV_GJENSTAND',
        label: 'Endring i lover/vedtak (Gjenstand)',
        hjemmel_basis: '14.4',
        beskrivelse: 'Nye offentlige krav som krever fysisk endring av kontraktsgjenstanden.',
        varselkrav_ref: '32.2',
      },
      {
        kode: 'LOV_PROSESS',
        label: 'Endring i lover/vedtak (Prosess)',
        hjemmel_basis: '15.2',
        beskrivelse: 'Nye offentlige krav som endrer måten arbeidet må utføres på.',
        varselkrav_ref: '32.2',
      },
      {
        kode: 'GEBYR',
        label: 'Endring i gebyrer/avgifter',
        hjemmel_basis: '26.3',
        beskrivelse: 'Endringer i offentlige gebyrer/avgifter etter tilbudstidspunktet.',
        varselkrav_ref: '32.2',
      },
      {
        kode: 'SAMORD',
        label: 'Samordning/Omlegging',
        hjemmel_basis: '21.4',
        beskrivelse: 'Pålagt omlegging som følge av samordning utover det påregnelige.',
        varselkrav_ref: '32.2',
      },
      {
        kode: 'FORSERING',
        label: 'Forsering ved uberettiget avslag',
        hjemmel_basis: '33.8',
        beskrivelse: 'Byggherren avslår rettmessig fristforlengelse, TE velger å forsere.',
        varselkrav_ref: '33.8 (Før iverksettelse)',
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
        beskrivelse: 'Forsinkede tegninger, beslutninger, materialer eller fysisk arbeidsgrunnlag (22.3).',
        varselkrav_ref: '34.1.2 / 25.1.2',
      },
      {
        kode: 'ADKOMST',
        label: 'Manglende tilkomst/råderett',
        hjemmel_basis: '22.2',
        beskrivelse: 'Byggherren har ikke nødvendig råderett over eiendommen.',
        varselkrav_ref: '34.1.2',
      },
      {
        kode: 'GRUNN',
        label: 'Uforutsette grunnforhold',
        hjemmel_basis: '23.1',
        beskrivelse: 'Forhold ved grunnen som avviker fra det TE hadde grunn til å regne med.',
        varselkrav_ref: '34.1.2 / 25.1.2',
      },
      {
        kode: 'KULTURMINNER',
        label: 'Funn av kulturminner',
        hjemmel_basis: '23.3',
        beskrivelse: 'Stans i arbeidet som følge av funn av ukjente kulturminner.',
        varselkrav_ref: '34.1.2 / 23.3 annet ledd',
      },
      {
        kode: 'PROSJ_RISIKO',
        label: 'Svikt i BHs prosjektering',
        hjemmel_basis: '24.1',
        beskrivelse: 'Feil, mangler eller uklarheter i prosjektering/løsninger BH har risikoen for.',
        varselkrav_ref: '34.1.2 / 25.2',
      },
      {
        kode: 'BH_FASTHOLDER',
        label: 'BH fastholder løsning etter varsel',
        hjemmel_basis: '24.2.2 tredje ledd',
        beskrivelse: 'BH fastholder sin prosjektering etter varsel fra TE, og løsningen viser seg uegnet.',
        varselkrav_ref: '34.1.2',
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
    underkategorier: [
      {
        kode: 'NEKT_MH',
        label: 'Nektelse av kontraktsmedhjelper',
        hjemmel_basis: '10.2',
        beskrivelse: 'BH nekter å godta valgt medhjelper uten saklig grunn.',
        varselkrav_ref: '34.1.2',
      },
      {
        kode: 'NEKT_TILTRANSPORT',
        label: 'Nektelse av tiltransport',
        hjemmel_basis: '12.1.2',
        beskrivelse: 'BH nekter tiltransport av sideentreprenør/TE uten saklig grunn.',
        varselkrav_ref: '34.1.2 / 12.1.2 annet ledd',
      },
      {
        kode: 'SKADE_BH',
        label: 'Skade forårsaket av BH/Sideentreprenør',
        hjemmel_basis: '19.1',
        beskrivelse: 'Skade på kontraktsgjenstanden forårsaket av BH eller hans kontraktsmedhjelpere.',
        varselkrav_ref: '34.1.2 / 20.5',
      },
      {
        kode: 'BRUKSTAKELSE',
        label: 'Urettmessig brukstakelse',
        hjemmel_basis: '38.1 annet ledd',
        beskrivelse: 'BH tar kontraktsgjenstanden i bruk før overtakelse/avtalt tid.',
        varselkrav_ref: '34.1.2 / 33.4',
      },
      {
        kode: 'STANS_BET',
        label: 'Stans ved betalingsmislighold',
        hjemmel_basis: '29.2',
        beskrivelse: 'Konsekvenser av rettmessig stans grunnet manglende betaling/sikkerhet.',
        varselkrav_ref: '34.1.2 / 29.2',
      },
      {
        kode: 'STANS_UENIGHET',
        label: 'Pålagt stans/utsettelse',
        hjemmel_basis: '35.1',
        beskrivelse: 'BH pålegger utsettelse av arbeidet ved uenighet om endring.',
        varselkrav_ref: '34.1.2',
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
        beskrivelse: 'Krig, opprør, naturkatastrofe, streik etc. som rammer TE direkte.',
        varselkrav_ref: '33.4',
      },
      {
        kode: 'FM_MH',
        label: 'Force Majeure (Medhjelper)',
        hjemmel_basis: '33.3 annet ledd',
        beskrivelse: 'Hindring hos kontraktsmedhjelper som skyldes FM.',
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
    label: `${k.label} (${k.hjemmel_frist})`,
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

// Get hovedkategori label from code
export function getHovedkategoriLabel(code: string): string {
  const kategori = KRAV_STRUKTUR_NS8407.find((k) => k.kode === code);
  return kategori?.label || code;
}

// Get underkategori label from code
export function getUnderkategoriLabel(code: string): string {
  for (const hovedkategori of KRAV_STRUKTUR_NS8407) {
    const underkategori = hovedkategori.underkategorier.find((u) => u.kode === code);
    if (underkategori) return underkategori.label;
  }
  return code;
}

// Get full hovedkategori object by code
export function getHovedkategori(code: string): Hovedkategori | undefined {
  return KRAV_STRUKTUR_NS8407.find((k) => k.kode === code);
}

// Get full underkategori object by code
export function getUnderkategoriObj(code: string): Underkategori | undefined {
  for (const hovedkategori of KRAV_STRUKTUR_NS8407) {
    const underkategori = hovedkategori.underkategorier.find((u) => u.kode === code);
    if (underkategori) return underkategori;
  }
  return undefined;
}

// Check if underkategori is a law change (requires special handling for §14.4)
export function erLovendring(underkategoriKode: string): boolean {
  return ['LOV_GJENSTAND', 'LOV_PROSESS', 'GEBYR'].includes(underkategoriKode);
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
