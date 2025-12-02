/**
 * Status helper functions for PDF generation
 * Returns color skins and labels for different status types
 */

import {
  getSakStatusLabel as getSakStatusLabelGenerated,
  getKoeStatusLabel as getKoeStatusLabelGenerated,
  getBhSvarStatusLabel as getBhSvarStatusLabelGenerated
} from './generatedConstants';

export type StatusSkin = 'blue' | 'green' | 'red' | 'beige' | 'yellow' | 'grey';

/**
 * Get color skin for Krav (request) status
 */
export function getKravStatusSkin(status: string): StatusSkin {
  const statusMap: Record<string, StatusSkin> = {
    'sendt': 'blue',
    'under_behandling': 'yellow',
    'godkjent': 'green',
    'delvis_godkjent': 'beige',
    'avvist': 'red',
    'utkast': 'grey',
    'ikke_relevant': 'grey',
  };
  return statusMap[status] || 'grey';
}

/**
 * Get color skin for Svar (response) status
 */
export function getSvarStatusSkin(status: string): StatusSkin {
  const statusMap: Record<string, StatusSkin> = {
    'godkjent': 'green',
    'delvis_godkjent': 'beige',
    'avvist': 'red',
    'under_behandling': 'yellow',
    'mottatt': 'blue',
  };
  return statusMap[status] || 'grey';
}

/**
 * Get color skin for Sak (case) status
 */
export function getSakStatusSkin(status: string): StatusSkin {
  const statusMap: Record<string, StatusSkin> = {
    'aktiv': 'blue',
    'godkjent': 'green',
    'avsluttet': 'grey',
    'under_behandling': 'yellow',
    'avvist': 'red',
  };
  return statusMap[status] || 'grey';
}

/**
 * Get label for Sak status (alias for generated function)
 */
export function getSakStatusLabel(status: string): string {
  return getSakStatusLabelGenerated(status);
}

/**
 * Get label for Krav status (alias for generated function)
 */
export function getKravStatusLabel(status: string): string {
  return getKoeStatusLabelGenerated(status);
}

/**
 * Get label for Svar status (alias for generated function)
 */
export function getSvarStatusLabel(status: string): string {
  return getBhSvarStatusLabelGenerated(status);
}
