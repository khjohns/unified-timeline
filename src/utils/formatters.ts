/**
 * Formatters
 *
 * Centralized formatting utilities for consistent display across the app.
 * Re-exports date formatters and adds additional formatters for:
 * - Currency
 * - Days
 * - Booleans
 * - Short dates (DD.MM.YYYY format)
 */

// Re-export all date formatters from dateFormatters.ts
export {
  formatDateNorwegian,
  formatDateTimeNorwegian,
  formatDateMinimalNorwegian,
  getNowNorwegian,
} from './dateFormatters';

const NORWEGIAN_LOCALE = 'nb-NO';
const NORWEGIAN_TIMEZONE = 'Europe/Oslo';

/**
 * Format a number as Norwegian currency (kr)
 *
 * @example formatCurrency(50000) // '50 000 kr'
 * @example formatCurrency(undefined) // '-'
 */
export function formatCurrency(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${value.toLocaleString(NORWEGIAN_LOCALE)} kr`;
}

/**
 * Format a number as days
 *
 * @example formatDays(5) // '5 dager'
 * @example formatDays(1) // '1 dag'
 * @example formatDays(undefined) // '-'
 */
export function formatDays(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${value} ${value === 1 ? 'dag' : 'dager'}`;
}

/**
 * Format boolean as Ja/Nei
 *
 * @example formatBoolean(true) // 'Ja'
 * @example formatBoolean(false) // 'Nei'
 * @example formatBoolean(undefined) // '-'
 */
export function formatBoolean(value?: boolean | null): string {
  if (value === null || value === undefined) return '-';
  return value ? 'Ja' : 'Nei';
}

/**
 * Format date to short Norwegian format (DD.MM.YYYY)
 * Used in tables and lists where space is limited.
 *
 * @example formatDateShort('2025-12-22T14:30:00Z') // '22.12.2025'
 * @example formatDateShort(null) // '-'
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(NORWEGIAN_LOCALE, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: NORWEGIAN_TIMEZONE,
    });
  } catch {
    return '-';
  }
}

/**
 * Format date to medium Norwegian format (22. des. 2025)
 * Used in cards and detail views.
 *
 * @example formatDateMedium('2025-12-22T14:30:00Z') // '22. des. 2025'
 * @example formatDateMedium(undefined) // '-'
 */
export function formatDateMedium(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(NORWEGIAN_LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: NORWEGIAN_TIMEZONE,
    });
  } catch {
    return dateStr || '-';
  }
}

/**
 * Format a percentage value
 *
 * @example formatPercent(0.75) // '75 %'
 * @example formatPercent(1.5) // '150 %'
 */
export function formatPercent(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${Math.round(value * 100)} %`;
}

/**
 * Format vederlagsmetode to readable label
 *
 * @example formatVederlagsmetode('ENHETSPRISER') // 'Enhetspriser'
 * @example formatVederlagsmetode('REGNINGSARBEID') // 'Regningsarbeid'
 */
export function formatVederlagsmetode(metode?: string | null): string {
  if (!metode) return '-';
  switch (metode) {
    case 'ENHETSPRISER':
      return 'Enhetspriser';
    case 'REGNINGSARBEID':
      return 'Regningsarbeid';
    case 'FASTPRIS':
      return 'Fastpris';
    default:
      return metode;
  }
}

/**
 * Format varsel type to readable label
 *
 * @example formatVarselType('NOYTRAL') // 'Nøytralt varsel'
 * @example formatVarselType('SPESIFISERT') // 'Spesifisert varsel'
 */
export function formatVarselType(type?: string | null): string {
  if (!type) return '-';
  switch (type) {
    case 'NOYTRAL':
      return 'Nøytralt varsel';
    case 'SPESIFISERT':
      return 'Spesifisert varsel';
    default:
      return type;
  }
}

/**
 * Format BH resultat to readable label with color hint
 *
 * @example formatBHResultat('godkjent') // { label: 'Godkjent', colorClass: 'text-pkt-brand-green-1000' }
 */
export function formatBHResultat(resultat?: string | null): {
  label: string;
  colorClass: string;
} {
  if (!resultat) return { label: '-', colorClass: '' };

  switch (resultat) {
    case 'godkjent':
      return { label: 'Godkjent', colorClass: 'text-pkt-brand-green-1000' };
    case 'avslatt':
      return { label: 'Avslått', colorClass: 'text-pkt-brand-red-1000' };
    case 'delvis_godkjent':
      return { label: 'Delvis godkjent', colorClass: 'text-pkt-brand-yellow-1000' };
    default:
      return { label: resultat, colorClass: '' };
  }
}
