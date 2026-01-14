/**
 * Sync Excel Export Utilities
 *
 * Functions for exporting Dalux-Catenda sync history to Excel format.
 * Creates professional Excel workbooks with mapping overview and task details.
 */

import * as XLSX from 'xlsx';
import type {
  SyncMapping,
  TaskSyncRecord,
  SyncHistoryResponse,
} from '../types/integration';
import { formatDateMedium } from './formatters';

// ========== TYPES ==========

export interface SyncExportData {
  mapping: SyncMapping;
  records: TaskSyncRecord[];
  summary: SyncHistoryResponse['summary'];
}

// ========== LOCAL FORMATTERS ==========

const STATUS_LABELS: Record<string, string> = {
  synced: 'Synkronisert',
  pending: 'Ventende',
  failed: 'Feilet',
};

const SYNC_STATUS_LABELS: Record<string, string> = {
  success: 'Vellykket',
  partial: 'Delvis',
  failed: 'Feilet',
};

function formatSyncStatus(status?: string): string {
  if (!status) return '-';
  return STATUS_LABELS[status] || status;
}

function formatMappingStatus(status?: string): string {
  if (!status) return '-';
  return SYNC_STATUS_LABELS[status] || status;
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ========== WORKSHEET BUILDERS ==========

function buildOversiktSheet(
  mapping: SyncMapping,
  summary: SyncHistoryResponse['summary']
): XLSX.WorkSheet {
  const data: (string | number)[][] = [
    ['SYNKRONISERINGSOVERSIKT'],
    [],
    ['Prosjekt-ID', mapping.project_id],
    ['Dalux prosjekt', mapping.dalux_project_id],
    ['Dalux URL', mapping.dalux_base_url],
    ['Catenda prosjekt', mapping.catenda_project_id],
    ['Catenda board', mapping.catenda_board_id],
    [],
    ['STATUS'],
    [],
    ['Synkronisering aktiv', mapping.sync_enabled ? 'Ja' : 'Nei'],
    ['Intervall (minutter)', mapping.sync_interval_minutes],
    ['Sist synkronisert', formatDateTime(mapping.last_sync_at)],
    ['Siste status', formatMappingStatus(mapping.last_sync_status)],
    ...(mapping.last_sync_error
      ? [['Siste feil', mapping.last_sync_error] as (string | number)[]]
      : []),
    [],
    ['STATISTIKK'],
    [],
    ['Totalt antall tasks', summary.total],
    ['Synkronisert', summary.synced],
    ['Ventende', summary.pending],
    ['Feilet', summary.failed],
    [],
    ['Eksportert', formatDateTime(new Date().toISOString())],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [{ wch: 25 }, { wch: 50 }];

  return ws;
}

function buildTasksSheet(records: TaskSyncRecord[]): XLSX.WorkSheet {
  const headers = [
    'Dalux Task ID',
    'Catenda Topic GUID',
    'Status',
    'Dalux oppdatert',
    'Catenda oppdatert',
    'Forsøk',
    'Feilmelding',
    'Opprettet',
    'Sist oppdatert',
  ];

  const rows = records.map((record) => [
    record.dalux_task_id,
    record.catenda_topic_guid || '-',
    formatSyncStatus(record.sync_status),
    formatDateTime(record.dalux_updated_at),
    formatDateTime(record.catenda_updated_at),
    record.retry_count,
    record.last_error || '-',
    formatDateTime(record.created_at),
    formatDateTime(record.updated_at),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Dalux Task ID
    { wch: 38 }, // Catenda Topic GUID
    { wch: 14 }, // Status
    { wch: 18 }, // Dalux oppdatert
    { wch: 18 }, // Catenda oppdatert
    { wch: 8 }, // Forsøk
    { wch: 50 }, // Feilmelding
    { wch: 18 }, // Opprettet
    { wch: 18 }, // Sist oppdatert
  ];

  return ws;
}

// ========== EXPORT FUNCTION ==========

/**
 * Download sync history as Excel file.
 *
 * Creates a workbook with:
 * - Oversikt: Mapping configuration and statistics
 * - Tasks: All sync records with status details
 *
 * @param data - Export data containing mapping, records, and summary
 */
export function downloadSyncHistoryExcel(data: SyncExportData): void {
  const { mapping, records, summary } = data;

  if (records.length === 0) {
    alert('Ingen synkroniseringshistorikk å eksportere.');
    return;
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add Oversikt sheet
  const oversiktSheet = buildOversiktSheet(mapping, summary);
  XLSX.utils.book_append_sheet(wb, oversiktSheet, 'Oversikt');

  // Add Tasks sheet
  const tasksSheet = buildTasksSheet(records);
  XLSX.utils.book_append_sheet(wb, tasksSheet, 'Tasks');

  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `sync-${mapping.project_id}-${dateStr}.xlsx`;

  // Write file and trigger download
  XLSX.writeFile(wb, filename);
}
