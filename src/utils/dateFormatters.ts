/**
 * Date formatting utilities for consistent Norwegian timezone display.
 *
 * All dates from the backend are stored in UTC. These functions convert
 * to Norwegian timezone (Europe/Oslo) for display.
 */

const NORWEGIAN_TIMEZONE = 'Europe/Oslo';
const NORWEGIAN_LOCALE = 'nb-NO';

/**
 * Format date string to Norwegian locale and timezone.
 * Assumes input is UTC ISO string from backend.
 *
 * @example formatDateNorwegian('2025-12-22T14:30:00Z') // '22. desember 2025'
 */
export function formatDateNorwegian(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(NORWEGIAN_LOCALE, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: NORWEGIAN_TIMEZONE,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format date and time to Norwegian locale and timezone.
 *
 * @example formatDateTimeNorwegian('2025-12-22T14:30:00Z') // '22. desember 2025 kl. 15:30'
 */
export function formatDateTimeNorwegian(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString(NORWEGIAN_LOCALE, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: NORWEGIAN_TIMEZONE,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format date to short Norwegian format (DD.MM).
 *
 * @example formatDateMinimalNorwegian('2025-12-22T14:30:00Z') // '22.12'
 */
export function formatDateMinimalNorwegian(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(NORWEGIAN_LOCALE, {
      day: '2-digit',
      month: '2-digit',
      timeZone: NORWEGIAN_TIMEZONE,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get current date/time in Norwegian timezone.
 * Useful for "Generated" timestamps in PDFs.
 *
 * @example getNowNorwegian() // '22. desember 2025 kl. 15:30'
 */
export function getNowNorwegian(): string {
  return new Date().toLocaleString(NORWEGIAN_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: NORWEGIAN_TIMEZONE,
  });
}
