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
