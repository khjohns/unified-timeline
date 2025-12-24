/**
 * Status Styles
 *
 * Centralized styling for status badges across the application.
 * Maps status values to Tailwind CSS classes for consistent display.
 */

import type { OverordnetStatus, SporStatus } from '../types/timeline';

/**
 * Badge variant types (matches Badge component variants)
 */
export type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger';

/**
 * Status style configuration
 */
interface StatusStyle {
  /** Badge variant for Badge component */
  variant: BadgeVariant;
  /** CSS classes for inline badge styling */
  className: string;
  /** Human-readable label */
  label: string;
}

/**
 * Overordnet (overall) status badge styles
 */
export const OVERORDNET_STATUS_STYLES: Record<OverordnetStatus, StatusStyle> = {
  UTKAST: {
    variant: 'default',
    className: 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700',
    label: 'Utkast',
  },
  SENDT: {
    variant: 'warning',
    className: 'bg-badge-warning-bg text-badge-warning-text',
    label: 'Sendt',
  },
  VENTER_PAA_SVAR: {
    variant: 'warning',
    className: 'bg-badge-warning-bg text-badge-warning-text',
    label: 'Venter på svar',
  },
  UNDER_BEHANDLING: {
    variant: 'warning',
    className: 'bg-badge-warning-bg text-badge-warning-text',
    label: 'Under behandling',
  },
  UNDER_FORHANDLING: {
    variant: 'warning',
    className: 'bg-badge-warning-bg text-badge-warning-text',
    label: 'Under forhandling',
  },
  OMFORENT: {
    variant: 'success',
    className: 'bg-badge-success-bg text-badge-success-text',
    label: 'Omforent',
  },
  LUKKET: {
    variant: 'success',
    className: 'bg-badge-success-bg text-badge-success-text',
    label: 'Lukket',
  },
  LUKKET_TRUKKET: {
    variant: 'danger',
    className: 'bg-badge-error-bg text-badge-error-text',
    label: 'Trukket',
  },
};

/**
 * Spor (track) status badge styles
 */
export const SPOR_STATUS_STYLES: Record<SporStatus, StatusStyle> = {
  ikke_relevant: {
    variant: 'default',
    className: 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700',
    label: 'Ikke relevant',
  },
  utkast: {
    variant: 'default',
    className: 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700',
    label: 'Utkast',
  },
  sendt: {
    variant: 'info',
    className: 'bg-badge-info-bg text-badge-info-text',
    label: 'Sendt',
  },
  under_behandling: {
    variant: 'warning',
    className: 'bg-badge-warning-bg text-badge-warning-text',
    label: 'Under behandling',
  },
  godkjent: {
    variant: 'success',
    className: 'bg-badge-success-bg text-badge-success-text',
    label: 'Godkjent',
  },
  delvis_godkjent: {
    variant: 'warning',
    className: 'bg-badge-warning-bg text-badge-warning-text',
    label: 'Delvis godkjent',
  },
  avslatt: {
    variant: 'danger',
    className: 'bg-badge-error-bg text-badge-error-text',
    label: 'Avslått',
  },
  under_forhandling: {
    variant: 'warning',
    className: 'bg-badge-warning-bg text-badge-warning-text',
    label: 'Under forhandling',
  },
  trukket: {
    variant: 'default',
    className: 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700',
    label: 'Trukket',
  },
  laast: {
    variant: 'success',
    className: 'bg-badge-success-bg text-badge-success-text',
    label: 'Låst',
  },
};

/**
 * Sakstype badge styles
 */
export const SAKSTYPE_STYLES: Record<string, StatusStyle> = {
  standard: {
    variant: 'info',
    className: 'bg-oslo-blue text-white',
    label: 'KOE',
  },
  forsering: {
    variant: 'warning',
    className: 'bg-pkt-brand-yellow-500 text-alert-warning-text',
    label: 'Forsering',
  },
  endringsordre: {
    variant: 'info',
    className: 'bg-badge-info-bg text-badge-info-text',
    label: 'Endringsordre',
  },
};

/**
 * Get style for overordnet status
 */
export function getOverordnetStatusStyle(status: OverordnetStatus | string | null): StatusStyle {
  if (!status) {
    return {
      variant: 'default',
      className: 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700',
      label: 'Ukjent',
    };
  }
  const upperStatus = status.toUpperCase() as OverordnetStatus;
  return OVERORDNET_STATUS_STYLES[upperStatus] || {
    variant: 'info',
    className: 'bg-badge-info-bg text-badge-info-text',
    label: status,
  };
}

/**
 * Get style for spor status
 */
export function getSporStatusStyle(status: SporStatus): StatusStyle {
  return SPOR_STATUS_STYLES[status] || {
    variant: 'default',
    className: 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700',
    label: status,
  };
}

/**
 * Get style for sakstype
 */
export function getSakstypeStyle(sakstype: string): StatusStyle {
  return SAKSTYPE_STYLES[sakstype] || SAKSTYPE_STYLES.standard;
}

/**
 * Get CSS class for overordnet status badge (for inline styling)
 */
export function getOverordnetStatusBadgeClass(status: string | null): string {
  return getOverordnetStatusStyle(status).className;
}

/**
 * Get CSS class for sakstype badge (for inline styling)
 */
export function getSakstypeBadgeClass(sakstype: string): string {
  return getSakstypeStyle(sakstype).className;
}

/**
 * Get label for sakstype
 */
export function getSakstypeLabel(sakstype: string): string {
  return getSakstypeStyle(sakstype).label;
}
