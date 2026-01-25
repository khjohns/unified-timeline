/**
 * Sync Excel Export Utilities
 *
 * Functions for exporting Dalux-Catenda sync history to Excel format.
 * Creates professional Excel workbooks with mapping overview and task details.
 */

import ExcelJS from 'exceljs';
import type {
  SyncMapping,
  TaskSyncRecord,
  SyncHistoryResponse,
} from '../types/integration';

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

// ========== HELPER FUNCTIONS ==========

function setColumnWidths(
  worksheet: ExcelJS.Worksheet,
  widths: number[]
): void {
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
}

async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ========== WORKSHEET BUILDERS ==========

function buildOversiktSheet(
  workbook: ExcelJS.Workbook,
  mapping: SyncMapping,
  summary: SyncHistoryResponse['summary']
): void {
  const ws = workbook.addWorksheet('Oversikt');

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

  ws.addRows(data);
  setColumnWidths(ws, [25, 50]);
}

function buildTasksSheet(
  workbook: ExcelJS.Workbook,
  records: TaskSyncRecord[]
): void {
  const ws = workbook.addWorksheet('Tasks');

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

  ws.addRow(headers);
  ws.addRows(rows);

  ws.getRow(1).font = { bold: true };

  setColumnWidths(ws, [20, 38, 14, 18, 18, 8, 50, 18, 18]);
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
export async function downloadSyncHistoryExcel(
  data: SyncExportData
): Promise<void> {
  const { mapping, records, summary } = data;

  if (records.length === 0) {
    alert('Ingen synkroniseringshistorikk å eksportere.');
    return;
  }

  // Create workbook
  const workbook = new ExcelJS.Workbook();

  // Add Oversikt sheet
  buildOversiktSheet(workbook, mapping, summary);

  // Add Tasks sheet
  buildTasksSheet(workbook, records);

  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `sync-${mapping.project_id}-${dateStr}.xlsx`;

  // Write file and trigger download
  await downloadWorkbook(workbook, filename);
}
