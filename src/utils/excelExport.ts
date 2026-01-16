/**
 * Excel Export Utilities
 *
 * Functions for exporting revision history and case data to Excel format.
 * Creates professional, well-structured Excel workbooks with multiple sheets.
 */

import * as XLSX from 'xlsx';
import {
  VederlagHistorikkEntry,
  FristHistorikkEntry,
  GrunnlagHistorikkEntry,
} from '../types/api';
import { SakState, SporStatus, OverordnetStatus } from '../types/timeline';

// Import existing formatters and labels
import {
  formatCurrency,
  formatDateMedium,
  formatBoolean,
  getResultatLabel,
} from './formatters';
import {
  getOverordnetStatusLabel,
  getSporStatusLabel,
} from '../constants/statusLabels';
import { getVederlagsmetodeLabel } from '../constants/paymentMethods';
import { getFristVarseltypeLabel } from '../constants/fristVarselTypes';
import {
  getHovedkategoriLabel,
  getUnderkategoriLabel,
} from '../constants/categories';

// ========== TYPES ==========

interface ExcelExportData {
  sakId: string;
  state?: SakState;
  grunnlag?: GrunnlagHistorikkEntry[];
  vederlag?: VederlagHistorikkEntry[];
  frist?: FristHistorikkEntry[];
}

// ========== LOCAL FORMATTERS ==========

const SAKSTYPE_LABELS: Record<string, string> = {
  standard: 'Standard KOE',
  forsering: 'Forsering (§33.8)',
  endringsordre: 'Endringsordre',
};

function formatSakstype(sakstype?: string): string {
  if (!sakstype) return 'Standard KOE';
  return SAKSTYPE_LABELS[sakstype] || sakstype;
}

const ENDRING_TYPE_LABELS: Record<string, string> = {
  opprettet: 'Opprettet',
  oppdatert: 'Oppdatert',
  sendt: 'Sendt',
  trukket: 'Trukket',
  respons: 'BH respons',
  respons_oppdatert: 'BH respons oppdatert',
};

function formatEndringType(type: string): string {
  return ENDRING_TYPE_LABELS[type] || type;
}

function formatRolle(rolle: 'TE' | 'BH'): string {
  return rolle === 'TE' ? 'Totalentreprenør' : 'Byggherre';
}

function formatUnderkategorier(
  underkategori?: string | string[] | null
): string {
  if (!underkategori) return '-';
  if (Array.isArray(underkategori)) {
    return underkategori.map(getUnderkategoriLabel).join(', ');
  }
  return getUnderkategoriLabel(underkategori);
}

// ========== WORKSHEET BUILDERS ==========

function buildOppsummeringSheet(state: SakState): XLSX.WorkSheet {
  const data: (string | number)[][] = [
    ['SAKSOVERSIKT'],
    [],
    ['Sak-ID', state.sak_id],
    ['Tittel', state.sakstittel || '-'],
    ['Sakstype', formatSakstype(state.sakstype)],
    [
      'Status',
      getOverordnetStatusLabel(state.overordnet_status as OverordnetStatus),
    ],
    [],
    ['PARTER'],
    [],
    ['Byggherre', state.byggherre || '-'],
    ['Entreprenør', state.entreprenor || '-'],
    ['Prosjekt', state.prosjekt_navn || '-'],
    [],
    ['ØKONOMISK OVERSIKT'],
    [],
    ['Sum krevd', formatCurrency(state.sum_krevd)],
    ['Sum godkjent', formatCurrency(state.sum_godkjent)],
    ['Differanse', formatCurrency(state.sum_krevd - state.sum_godkjent)],
    [],
    ['GRUNNLAG'],
    [],
    [
      'Status',
      getSporStatusLabel(state.grunnlag?.status as SporStatus) || '-',
    ],
    [
      'Hovedkategori',
      state.grunnlag?.hovedkategori
        ? getHovedkategoriLabel(state.grunnlag.hovedkategori)
        : '-',
    ],
    [
      'Underkategori',
      formatUnderkategorier(state.grunnlag?.underkategori),
    ],
    [
      'BH resultat',
      state.grunnlag?.bh_resultat
        ? getResultatLabel(state.grunnlag.bh_resultat)
        : '-',
    ],
    ['Antall versjoner', state.grunnlag?.antall_versjoner?.toString() || '0'],
    [],
    ['VEDERLAG'],
    [],
    [
      'Status',
      getSporStatusLabel(state.vederlag?.status as SporStatus) || '-',
    ],
    ['Krevd beløp', formatCurrency(state.vederlag?.krevd_belop)],
    ['Godkjent beløp', formatCurrency(state.vederlag?.godkjent_belop)],
    [
      'Metode',
      state.vederlag?.metode
        ? getVederlagsmetodeLabel(state.vederlag.metode)
        : '-',
    ],
    [
      'BH resultat',
      state.vederlag?.bh_resultat
        ? getResultatLabel(state.vederlag.bh_resultat)
        : '-',
    ],
    ['Antall versjoner', state.vederlag?.antall_versjoner?.toString() || '0'],
    [],
    ['FRIST'],
    [],
    ['Status', getSporStatusLabel(state.frist?.status as SporStatus) || '-'],
    [
      'Krevd dager',
      state.frist?.krevd_dager != null
        ? `${state.frist.krevd_dager} dager`
        : '-',
    ],
    [
      'Godkjent dager',
      state.frist?.godkjent_dager != null
        ? `${state.frist.godkjent_dager} dager`
        : '-',
    ],
    [
      'Varseltype',
      state.frist?.varsel_type
        ? getFristVarseltypeLabel(state.frist.varsel_type)
        : '-',
    ],
    [
      'BH resultat',
      state.frist?.bh_resultat
        ? getResultatLabel(state.frist.bh_resultat)
        : '-',
    ],
    ['Antall versjoner', state.frist?.antall_versjoner?.toString() || '0'],
    [],
    ['METADATA'],
    [],
    ['Opprettet', formatDateMedium(state.opprettet)],
    ['Siste aktivitet', formatDateMedium(state.siste_aktivitet)],
    ['Antall events', state.antall_events?.toString() || '0'],
    ['Eksportert', formatDateMedium(new Date().toISOString())],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [{ wch: 25 }, { wch: 45 }];

  return ws;
}

function buildGrunnlagSheet(entries: GrunnlagHistorikkEntry[]): XLSX.WorkSheet {
  const headers = [
    'Versjon',
    'Tidsstempel',
    'Aktør',
    'Rolle',
    'Type endring',
    'Hovedkategori',
    'Underkategori',
    'Beskrivelse',
    'Kontraktsreferanser',
    'BH resultat',
    'BH begrunnelse',
  ];

  const rows = entries.map((e) => [
    e.versjon,
    formatDateMedium(e.tidsstempel),
    e.aktor.navn,
    formatRolle(e.aktor.rolle),
    formatEndringType(e.endring_type),
    e.hovedkategori ? getHovedkategoriLabel(e.hovedkategori) : '-',
    formatUnderkategorier(e.underkategori),
    e.beskrivelse || '-',
    e.kontraktsreferanser?.join(', ') || '-',
    e.bh_resultat ? getResultatLabel(e.bh_resultat) : '-',
    e.bh_begrunnelse || '-',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 }, // Versjon
    { wch: 16 }, // Tidsstempel
    { wch: 20 }, // Aktør
    { wch: 16 }, // Rolle
    { wch: 18 }, // Type endring
    { wch: 28 }, // Hovedkategori
    { wch: 30 }, // Underkategori
    { wch: 40 }, // Beskrivelse
    { wch: 25 }, // Kontraktsreferanser
    { wch: 18 }, // BH resultat
    { wch: 40 }, // BH begrunnelse
  ];

  return ws;
}

function buildVederlagSheet(entries: VederlagHistorikkEntry[]): XLSX.WorkSheet {
  const headers = [
    'Versjon',
    'Tidsstempel',
    'Aktør',
    'Rolle',
    'Type endring',
    'Krevd beløp',
    'Metode',
    'Begrunnelse',
    'Inkl. rigg/drift',
    'Inkl. produktivitet',
    'BH resultat',
    'Godkjent beløp',
    'BH begrunnelse',
  ];

  const rows = entries.map((e) => [
    e.versjon,
    formatDateMedium(e.tidsstempel),
    e.aktor.navn,
    formatRolle(e.aktor.rolle),
    formatEndringType(e.endring_type),
    formatCurrency(e.krav_belop),
    e.metode ? getVederlagsmetodeLabel(e.metode) : '-',
    e.begrunnelse || '-',
    formatBoolean(e.inkluderer_rigg_drift),
    formatBoolean(e.inkluderer_produktivitet),
    e.bh_resultat ? getResultatLabel(e.bh_resultat) : '-',
    formatCurrency(e.godkjent_belop),
    e.bh_begrunnelse || '-',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 }, // Versjon
    { wch: 16 }, // Tidsstempel
    { wch: 20 }, // Aktør
    { wch: 16 }, // Rolle
    { wch: 18 }, // Type endring
    { wch: 14 }, // Krevd beløp
    { wch: 28 }, // Metode
    { wch: 35 }, // Begrunnelse
    { wch: 14 }, // Inkl. rigg/drift
    { wch: 16 }, // Inkl. produktivitet
    { wch: 18 }, // BH resultat
    { wch: 14 }, // Godkjent beløp
    { wch: 35 }, // BH begrunnelse
  ];

  return ws;
}

function buildFristSheet(entries: FristHistorikkEntry[]): XLSX.WorkSheet {
  const headers = [
    'Versjon',
    'Tidsstempel',
    'Aktør',
    'Rolle',
    'Type endring',
    'Krevd dager',
    'Varseltype',
    'Begrunnelse',
    'Ny sluttdato',
    'BH resultat',
    'Godkjent dager',
    'BH begrunnelse',
  ];

  const rows = entries.map((e) => [
    e.versjon,
    formatDateMedium(e.tidsstempel),
    e.aktor.navn,
    formatRolle(e.aktor.rolle),
    formatEndringType(e.endring_type),
    e.krav_dager != null ? `${e.krav_dager} dager` : '-',
    e.varsel_type ? getFristVarseltypeLabel(e.varsel_type) : '-',
    e.begrunnelse || '-',
    e.ny_sluttdato || '-',
    e.bh_resultat ? getResultatLabel(e.bh_resultat) : '-',
    e.godkjent_dager != null ? `${e.godkjent_dager} dager` : '-',
    e.bh_begrunnelse || '-',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 }, // Versjon
    { wch: 16 }, // Tidsstempel
    { wch: 20 }, // Aktør
    { wch: 16 }, // Rolle
    { wch: 18 }, // Type endring
    { wch: 12 }, // Krevd dager
    { wch: 22 }, // Varseltype
    { wch: 35 }, // Begrunnelse
    { wch: 12 }, // Ny sluttdato
    { wch: 18 }, // BH resultat
    { wch: 14 }, // Godkjent dager
    { wch: 35 }, // BH begrunnelse
  ];

  return ws;
}

// ========== MAIN EXPORT FUNCTION ==========

/**
 * Download case data as Excel file
 *
 * Creates a professional Excel workbook with multiple sheets:
 * - Oppsummering: Case overview with metadata and status
 * - Grunnlag: Grunnlag revision history (if data exists)
 * - Vederlag: Vederlag revision history (if data exists)
 * - Frist: Frist revision history (if data exists)
 */
export function downloadCaseExcel({
  sakId,
  state,
  grunnlag = [],
  vederlag = [],
  frist = [],
}: ExcelExportData): void {
  // Check if there's any data to export
  if (
    !state &&
    grunnlag.length === 0 &&
    vederlag.length === 0 &&
    frist.length === 0
  ) {
    alert('Ingen data å eksportere.');
    return;
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add Oppsummering sheet (if state exists)
  if (state) {
    const oppsummeringSheet = buildOppsummeringSheet(state);
    XLSX.utils.book_append_sheet(wb, oppsummeringSheet, 'Oppsummering');
  }

  // Add Grunnlag sheet (if data exists)
  if (grunnlag.length > 0) {
    const grunnlagSheet = buildGrunnlagSheet(grunnlag);
    XLSX.utils.book_append_sheet(wb, grunnlagSheet, 'Grunnlag');
  }

  // Add Vederlag sheet (if data exists)
  if (vederlag.length > 0) {
    const vederlagSheet = buildVederlagSheet(vederlag);
    XLSX.utils.book_append_sheet(wb, vederlagSheet, 'Vederlag');
  }

  // Add Frist sheet (if data exists)
  if (frist.length > 0) {
    const fristSheet = buildFristSheet(frist);
    XLSX.utils.book_append_sheet(wb, fristSheet, 'Frist');
  }

  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `sak-${sakId}-${dateStr}.xlsx`;

  // Write file and trigger download
  XLSX.writeFile(wb, filename);
}

/**
 * Download revision history only (without state oppsummering)
 * Useful for quick export of just the revision data
 */
export function downloadRevisionHistoryExcel(
  sakId: string,
  vederlag: VederlagHistorikkEntry[],
  frist: FristHistorikkEntry[]
): void {
  if (vederlag.length === 0 && frist.length === 0) {
    alert('Ingen revisjonshistorikk å eksportere.');
    return;
  }

  const wb = XLSX.utils.book_new();

  if (vederlag.length > 0) {
    const vederlagSheet = buildVederlagSheet(vederlag);
    XLSX.utils.book_append_sheet(wb, vederlagSheet, 'Vederlag');
  }

  if (frist.length > 0) {
    const fristSheet = buildFristSheet(frist);
    XLSX.utils.book_append_sheet(wb, fristSheet, 'Frist');
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `revisjonshistorikk-${sakId}-${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);
}

// ========== FRAVIK EXPORT ==========

import type { FravikState, MaskinTilstand } from '../types/fravik';

const FRAVIK_GRUNN_LABELS: Record<string, string> = {
  markedsmangel: 'Markedsmangel',
  leveringstid: 'Leveringstid',
  tekniske_begrensninger: 'Tekniske begrensninger',
  hms_krav: 'HMS-krav',
  annet: 'Annet',
};

const DRIVSTOFF_LABELS: Record<string, string> = {
  HVO100: 'HVO100 (palmefritt)',
  annet_biodrivstoff: 'Annet biodrivstoff',
  diesel: 'Diesel',
  diesel_euro6: 'Diesel Euro 6', // Legacy - for backwards compatibility
};

const MASKIN_VEKT_LABELS: Record<string, string> = {
  liten: 'Liten (< 8 tonn)',
  medium: 'Medium (8–20 tonn)',
  stor: 'Stor (20–50 tonn)',
  svart_stor: 'Svært stor (> 50 tonn)',
};

const ARBEIDSKATEGORI_LABELS: Record<string, string> = {
  graving: 'Graving',
  lasting: 'Lasting',
  lofting: 'Løfting',
  boring_peling: 'Boring/pæling',
  asfalt_komprimering: 'Asfalt/komprimering',
  annet: 'Annet',
};

const BRUKSINTENSITET_LABELS: Record<string, string> = {
  sporadisk: 'Sporadisk (< 2 timer/dag)',
  normal: 'Normal (2–6 timer/dag)',
  intensiv: 'Intensiv (> 6 timer/dag)',
};

const EUROKLASSE_LABELS: Record<string, string> = {
  euro_4: 'Euro 4/IV',
  euro_5: 'Euro 5/V',
  euro_6: 'Euro 6/VI (minimumskrav)',
};

const FRAVIK_BESLUTNING_LABELS: Record<string, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  krever_avklaring: 'Krever avklaring',
};

const FRAVIK_STATUS_LABELS: Record<string, string> = {
  utkast: 'Utkast',
  sendt_inn: 'Sendt inn',
  under_miljo_vurdering: 'Til vurdering hos miljørådgiver',
  returnert_fra_miljo: 'Returnert fra miljørådgiver',
  under_pl_vurdering: 'Til godkjenning hos prosjektleder',
  returnert_fra_pl: 'Returnert fra prosjektleder',
  under_arbeidsgruppe: 'Til behandling i arbeidsgruppen',
  under_eier_beslutning: 'Til beslutning hos eier',
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  trukket: 'Trukket',
};

const MASKIN_STATUS_LABELS: Record<string, string> = {
  ikke_vurdert: 'Ikke vurdert',
  godkjent: 'Godkjent',
  avslatt: 'Avslått',
  delvis_godkjent: 'Delvis godkjent',
};

const MASKIN_TYPE_LABELS: Record<string, string> = {
  Gravemaskin: 'Gravemaskin',
  Hjullaster: 'Hjullaster',
  Lift: 'Lift',
  Asfaltutlegger: 'Asfaltutlegger',
  Bergboremaskin: 'Bergboremaskin',
  Borerigg: 'Borerigg',
  Hjuldoser: 'Hjuldoser',
  Pælemaskin: 'Pælemaskin',
  Spuntmaskin: 'Spuntmaskin',
  Vals: 'Vals',
  Annet: 'Annet',
};

function formatGrunner(grunner?: string[]): string {
  if (!grunner || grunner.length === 0) return '-';
  return grunner.map((g) => FRAVIK_GRUNN_LABELS[g] || g).join(', ');
}

function formatDrivstoff(drivstoff?: string): string {
  if (!drivstoff) return '-';
  return DRIVSTOFF_LABELS[drivstoff] || drivstoff;
}

function formatFravikBeslutning(beslutning?: string): string {
  if (!beslutning) return '-';
  return FRAVIK_BESLUTNING_LABELS[beslutning] || beslutning;
}

function formatFravikStatus(status?: string): string {
  if (!status) return '-';
  return FRAVIK_STATUS_LABELS[status] || status;
}

function formatMaskinType(type?: string): string {
  if (!type) return '-';
  return MASKIN_TYPE_LABELS[type] || type;
}

function formatMaskinStatus(status?: string): string {
  if (!status) return '-';
  return MASKIN_STATUS_LABELS[status] || status;
}

function formatMaskinVekt(vekt?: string): string {
  if (!vekt) return '-';
  return MASKIN_VEKT_LABELS[vekt] || vekt;
}

function formatArbeidskategori(kategori?: string): string {
  if (!kategori) return '-';
  return ARBEIDSKATEGORI_LABELS[kategori] || kategori;
}

function formatBruksintensitet(intensitet?: string): string {
  if (!intensitet) return '-';
  return BRUKSINTENSITET_LABELS[intensitet] || intensitet;
}

function formatEuroklasse(euroklasse?: string): string {
  if (!euroklasse) return '-';
  return EUROKLASSE_LABELS[euroklasse] || euroklasse;
}

function buildFravikOppsummeringSheet(state: FravikState): XLSX.WorkSheet {
  const data: (string | number)[][] = [
    ['FRAVIK-SØKNAD'],
    [],
    ['Sak-ID', state.sak_id],
    [],
    ['PROSJEKT'],
    [],
    ['Prosjektnavn', state.prosjekt_navn || '-'],
    ['Prosjektnummer', state.prosjekt_nummer || '-'],
    ['Rammeavtale', state.rammeavtale || '-'],
    ['Hovedentreprenør', state.hovedentreprenor || '-'],
    [],
    ['SØKER'],
    [],
    ['Navn', state.soker_navn || '-'],
    ['E-post', state.soker_epost || '-'],
    [],
    ['STATUS'],
    [],
    ['Status', formatFravikStatus(state.status)],
    ['Hastebehandling', state.er_haste ? 'Ja' : 'Nei'],
    ['Hastebegrunnelse', state.haste_begrunnelse || '-'],
    [],
    ['MASKINER'],
    [],
    ['Antall maskiner', state.antall_maskiner],
    ['Godkjente', state.antall_godkjente_maskiner],
    ['Avslåtte', state.antall_avslatte_maskiner],
    [],
    ['AVBØTENDE TILTAK'],
    [],
    ['Avbøtende tiltak', state.avbotende_tiltak || '-'],
    ['Konsekvenser ved avslag', state.konsekvenser_ved_avslag || '-'],
    [],
    ['ENDELIG BESLUTNING'],
    [],
    ['Beslutning', formatFravikBeslutning(state.endelig_beslutning)],
    ['Kommentar', state.endelig_beslutning_kommentar || '-'],
    ['Besluttet av', state.endelig_beslutning_av || '-'],
    [
      'Tidspunkt',
      state.endelig_beslutning_tidspunkt
        ? formatDateMedium(state.endelig_beslutning_tidspunkt)
        : '-',
    ],
    [],
    ['METADATA'],
    [],
    ['Opprettet', state.opprettet ? formatDateMedium(state.opprettet) : '-'],
    [
      'Sendt inn',
      state.sendt_inn_tidspunkt
        ? formatDateMedium(state.sendt_inn_tidspunkt)
        : '-',
    ],
    [
      'Sist oppdatert',
      state.siste_oppdatert ? formatDateMedium(state.siste_oppdatert) : '-',
    ],
    ['Eksportert', formatDateMedium(new Date().toISOString())],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 50 }];

  return ws;
}

function buildMaskinerSheet(
  maskiner: Record<string, MaskinTilstand>
): XLSX.WorkSheet {
  const headers = [
    'Maskin-ID',
    'Type',
    'Annet type',
    'Vekt',
    'Reg.nr',
    'Startdato',
    'Sluttdato',
    'Grunner',
    'Begrunnelse',
    'Alternativer vurdert',
    'Markedsundersøkelse',
    'Undersøkte leverandører',
    'Erstatningsmaskin',
    'Erstatningsdrivstoff',
    'Euroklasse',
    'Arbeidskategori',
    'Bruksintensitet',
    'Est. forbruk (l/dag)',
    'Arbeidsbeskrivelse',
    'Status',
  ];

  const rows = Object.values(maskiner).map((m) => [
    m.maskin_id,
    formatMaskinType(m.maskin_type),
    m.annet_type || '-',
    formatMaskinVekt(m.vekt),
    m.registreringsnummer || '-',
    m.start_dato || '-',
    m.slutt_dato || '-',
    formatGrunner(m.grunner),
    m.begrunnelse || '-',
    m.alternativer_vurdert || '-',
    m.markedsundersokelse ? 'Ja' : 'Nei',
    m.undersøkte_leverandorer || '-',
    m.erstatningsmaskin || '-',
    formatDrivstoff(m.erstatningsdrivstoff),
    formatEuroklasse(m.euroklasse),
    formatArbeidskategori(m.arbeidskategori),
    formatBruksintensitet(m.bruksintensitet),
    m.estimert_drivstofforbruk ? `${m.estimert_drivstofforbruk}` : '-',
    m.arbeidsbeskrivelse || '-',
    formatMaskinStatus(m.samlet_status),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws['!cols'] = [
    { wch: 12 }, // Maskin-ID
    { wch: 14 }, // Type
    { wch: 14 }, // Annet type
    { wch: 22 }, // Vekt
    { wch: 12 }, // Reg.nr
    { wch: 12 }, // Startdato
    { wch: 12 }, // Sluttdato
    { wch: 30 }, // Grunner
    { wch: 40 }, // Begrunnelse
    { wch: 35 }, // Alternativer vurdert
    { wch: 18 }, // Markedsundersøkelse
    { wch: 30 }, // Undersøkte leverandører
    { wch: 20 }, // Erstatningsmaskin
    { wch: 22 }, // Erstatningsdrivstoff
    { wch: 22 }, // Euroklasse
    { wch: 20 }, // Arbeidskategori
    { wch: 24 }, // Bruksintensitet
    { wch: 18 }, // Est. forbruk
    { wch: 35 }, // Arbeidsbeskrivelse
    { wch: 14 }, // Status
  ];

  return ws;
}

/**
 * Download Fravik application data as Excel file
 *
 * Creates a professional Excel workbook with:
 * - Oppsummering: Application overview, status, and final decision
 * - Maskiner: Detailed list of all machines with full information
 */
export function downloadFravikExcel(state: FravikState): void {
  if (!state) {
    alert('Ingen data å eksportere.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Add Oppsummering sheet
  const oppsummeringSheet = buildFravikOppsummeringSheet(state);
  XLSX.utils.book_append_sheet(wb, oppsummeringSheet, 'Oppsummering');

  // Add Maskiner sheet (if any machines exist)
  if (Object.keys(state.maskiner).length > 0) {
    const maskinerSheet = buildMaskinerSheet(state.maskiner);
    XLSX.utils.book_append_sheet(wb, maskinerSheet, 'Maskiner');
  }

  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `fravik-${state.sak_id}-${dateStr}.xlsx`;

  // Write file and trigger download
  XLSX.writeFile(wb, filename);
}
