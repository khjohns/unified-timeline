/**
 * CSV Export Utilities
 *
 * Functions for exporting revision history data to CSV format.
 */

import { VederlagHistorikkEntry, FristHistorikkEntry } from '../types/api';

/**
 * Convert vederlag historikk to CSV string
 */
function vederlagToCsv(entries: VederlagHistorikkEntry[]): string {
  const headers = [
    'Versjon',
    'Tidsstempel',
    'Aktør',
    'Rolle',
    'Type',
    'Krevd beløp',
    'Metode',
    'Rigg/drift',
    'Produktivitet',
    'BH Resultat',
    'Godkjent beløp',
  ];

  const rows = entries.map((e) => [
    e.versjon.toString(),
    e.tidsstempel,
    e.aktor.navn,
    e.aktor.rolle,
    e.endring_type,
    e.krav_belop?.toString() ?? '',
    e.metode_label ?? '',
    e.inkluderer_rigg_drift ? 'Ja' : '',
    e.inkluderer_produktivitet ? 'Ja' : '',
    e.bh_resultat_label ?? '',
    e.godkjent_belop?.toString() ?? '',
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\n');
}

/**
 * Convert frist historikk to CSV string
 */
function fristToCsv(entries: FristHistorikkEntry[]): string {
  const headers = [
    'Versjon',
    'Tidsstempel',
    'Aktør',
    'Rolle',
    'Type',
    'Krevd dager',
    'Varseltype',
    'Ny sluttdato',
    'BH Resultat',
    'Godkjent dager',
  ];

  const rows = entries.map((e) => [
    e.versjon.toString(),
    e.tidsstempel,
    e.aktor.navn,
    e.aktor.rolle,
    e.endring_type,
    e.krav_dager?.toString() ?? '',
    e.varsel_type_label ?? '',
    e.ny_sluttdato ?? '',
    e.bh_resultat_label ?? '',
    e.godkjent_dager?.toString() ?? '',
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\n');
}

/**
 * Escape a value for CSV (handle quotes and special characters)
 */
function escapeCsv(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Download revision history as CSV file
 */
export function downloadRevisionHistoryCsv(
  sakId: string,
  vederlag: VederlagHistorikkEntry[],
  frist: FristHistorikkEntry[]
): void {
  const sections: string[] = [];

  if (vederlag.length > 0) {
    sections.push('=== VEDERLAG ===');
    sections.push(vederlagToCsv(vederlag));
  }

  if (frist.length > 0) {
    if (sections.length > 0) sections.push(''); // Empty line between sections
    sections.push('=== FRIST ===');
    sections.push(fristToCsv(frist));
  }

  if (sections.length === 0) {
    alert('Ingen revisjonshistorikk å eksportere.');
    return;
  }

  const csv = sections.join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `revisjonshistorikk-${sakId}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
