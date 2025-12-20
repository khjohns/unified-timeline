/**
 * StatusCard Component
 *
 * Read-only display component for track status.
 * Shows current status, krevd/godkjent values, and contextual actions.
 * Forslag B: Minimal Soft - List-item style with hover effects.
 */

import { SporStatus, SporType } from '../../types/timeline';
import { clsx } from 'clsx';
import { ReactNode } from 'react';
import {
  ChevronRightIcon,
} from '@radix-ui/react-icons';

interface StatusCardProps {
  spor: SporType;
  status: SporStatus;
  title: string;
  lastUpdated?: string;
  actions?: ReactNode;
  /** Krevd value (amount for vederlag, days for frist) */
  krevd?: number | null;
  /** Godkjent value (amount for vederlag, days for frist) */
  godkjent?: number | null;
  /** Unit label for values (e.g., "kr" or "dager") */
  unit?: string;
  /** Full display status from backend (includes subsidiary info) */
  visningsstatus?: string;
  /** Whether this track has subsidiary approval */
  erSubsidiaert?: boolean;
}

const STATUS_CONFIG: Record<
  SporStatus,
  { label: string; borderClass: string; dotClass: string; ariaLabel: string }
> = {
  ikke_relevant: {
    label: 'Ikke relevant',
    borderClass: 'border-l-pkt-grays-gray-400',
    dotClass: 'bg-pkt-grays-gray-400',
    ariaLabel: 'Status: Ikke relevant',
  },
  utkast: {
    label: 'Utkast',
    borderClass: 'border-l-pkt-grays-gray-400',
    dotClass: 'bg-pkt-grays-gray-400',
    ariaLabel: 'Status: Utkast',
  },
  sendt: {
    label: 'Sendt',
    borderClass: 'border-l-pkt-brand-blue-1000',
    dotClass: 'bg-pkt-brand-blue-1000',
    ariaLabel: 'Status: Sendt til byggherre',
  },
  under_behandling: {
    label: 'Under behandling',
    borderClass: 'border-l-pkt-brand-yellow-1000',
    dotClass: 'bg-pkt-brand-yellow-1000',
    ariaLabel: 'Status: Under behandling',
  },
  godkjent: {
    label: 'Godkjent',
    borderClass: 'border-l-pkt-brand-green-1000',
    dotClass: 'bg-pkt-brand-green-1000',
    ariaLabel: 'Status: Godkjent',
  },
  delvis_godkjent: {
    label: 'Delvis godkjent',
    borderClass: 'border-l-pkt-brand-yellow-1000',
    dotClass: 'bg-pkt-brand-yellow-1000',
    ariaLabel: 'Status: Delvis godkjent',
  },
  avslatt: {
    label: 'Avslått',
    borderClass: 'border-l-pkt-brand-red-1000',
    dotClass: 'bg-pkt-brand-red-1000',
    ariaLabel: 'Status: Avslått',
  },
  under_forhandling: {
    label: 'Under forhandling',
    borderClass: 'border-l-pkt-brand-yellow-1000',
    dotClass: 'bg-pkt-brand-yellow-1000',
    ariaLabel: 'Status: Under forhandling',
  },
  trukket: {
    label: 'Trukket',
    borderClass: 'border-l-pkt-grays-gray-400',
    dotClass: 'bg-pkt-grays-gray-400',
    ariaLabel: 'Status: Trukket tilbake',
  },
  laast: {
    label: 'Låst',
    borderClass: 'border-l-pkt-brand-green-1000',
    dotClass: 'bg-pkt-brand-green-1000',
    ariaLabel: 'Status: Låst',
  },
};

const SPOR_LABELS: Record<SporType, string> = {
  grunnlag: 'Ansvarsgrunnlag',
  vederlag: 'Vederlag',
  frist: 'Frist',
  forsering: 'Forsering',
};

/**
 * Format a number for display (Norwegian locale)
 */
function formatValue(value: number, unit: string): string {
  if (unit === 'kr') {
    return `${value.toLocaleString('nb-NO')} kr`;
  }
  return `${value} ${unit}`;
}

/**
 * Format value summary for inline display
 */
function formatValueSummary(krevd?: number | null, godkjent?: number | null, unit?: string): string | null {
  if (krevd === null || krevd === undefined) return null;

  const krevdStr = formatValue(krevd, unit || 'kr');
  if (godkjent !== null && godkjent !== undefined) {
    const godkjentStr = formatValue(godkjent, unit || 'kr');
    return `${krevdStr} → ${godkjentStr}`;
  }
  return krevdStr;
}

/**
 * StatusCard displays the current status of a track (grunnlag, vederlag, frist)
 * Forslag B: Minimal Soft - List-item style with hover effects and status-colored left border.
 *
 * Supports subsidiary status display when grunnlag is rejected but vederlag/frist is approved.
 */
export function StatusCard({
  spor,
  status,
  actions,
  krevd,
  godkjent,
  unit = 'kr',
  visningsstatus,
  erSubsidiaert,
}: StatusCardProps) {
  const config = STATUS_CONFIG[status];
  const valueSummary = formatValueSummary(krevd, godkjent, unit);

  // Use visningsstatus if provided (includes subsidiary info), otherwise fall back to config.label
  const displayLabel = visningsstatus || config.label;

  // Determine if we should show subsidiary styling
  // Subsidiary means: avvist on grunnlag but vederlag/frist approved
  const isSubsidiary = erSubsidiaert === true;

  // Subsidiary status uses semantic color (amber in light, coral in dark)
  const borderClass = isSubsidiary
    ? 'border-l-subsidiary-indicator'
    : config.borderClass;

  const dotClass = isSubsidiary
    ? 'bg-subsidiary-indicator'
    : config.dotClass;

  return (
    <div
      className={clsx(
        'group bg-pkt-bg-card px-3 py-3 sm:px-4 sm:py-4',
        'border-l-4',
        borderClass,
        'hover:bg-pkt-bg-subtle',
        'transition-colors'
      )}
    >
      {/* Mobile: Stacked layout, Desktop: Single row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* Top row on mobile / Left side on desktop */}
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Status dot and title - always together */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className={clsx('w-2 h-2 rounded-full shrink-0', dotClass)}
              role="status"
              aria-label={config.ariaLabel}
            />
            <span className="font-medium text-pkt-text-body-dark shrink-0">
              {SPOR_LABELS[spor]}
            </span>
            {/* Status label - hidden on mobile, shown on desktop */}
            <span className={clsx(
              'text-sm truncate hidden sm:inline',
              isSubsidiary ? 'text-pkt-grays-gray-700' : 'text-pkt-grays-gray-500'
            )}>
              {displayLabel}
            </span>
            {/* Value summary inline on desktop - only show if not already in visningsstatus */}
            {valueSummary && !visningsstatus && (
              <span className="text-sm font-medium text-pkt-text-body-dark ml-2 shrink-0 hidden sm:inline">
                {valueSummary}
              </span>
            )}
          </div>

          {/* Chevron on mobile (only when no actions) */}
          {!actions && (
            <div className="flex items-center shrink-0 sm:hidden">
              <ChevronRightIcon
                className="w-4 h-4 text-pkt-grays-gray-400 group-hover:text-pkt-text-body-dark transition-colors"
              />
            </div>
          )}
        </div>

        {/* Mobile only: Status and value on second row */}
        <div className="flex flex-col gap-1 pl-4 sm:hidden">
          {/* Status label on mobile */}
          <span className={clsx(
            'text-sm',
            isSubsidiary ? 'text-pkt-grays-gray-700' : 'text-pkt-grays-gray-500'
          )}>
            {displayLabel}
          </span>
          {/* Value summary on mobile - only show if not already in visningsstatus */}
          {valueSummary && !visningsstatus && (
            <span className="text-sm font-medium text-pkt-text-body-dark">
              {valueSummary}
            </span>
          )}
        </div>

        {/* Mobile only: Actions at bottom (full width for better touch targets) */}
        {actions && (
          <div className="flex items-center gap-2 pl-4 pt-1 sm:hidden">
            {actions}
          </div>
        )}

        {/* Desktop only: Right side actions/chevron */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : (
            <ChevronRightIcon
              className="w-4 h-4 text-pkt-grays-gray-400 group-hover:text-pkt-text-body-dark transition-colors"
            />
          )}
        </div>
      </div>
    </div>
  );
}
