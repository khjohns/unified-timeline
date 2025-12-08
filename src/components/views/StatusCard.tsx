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
  avvist: {
    label: 'Avvist',
    borderClass: 'border-l-pkt-brand-red-1000',
    dotClass: 'bg-pkt-brand-red-1000',
    ariaLabel: 'Status: Avvist',
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
  grunnlag: 'Grunnlag',
  vederlag: 'Vederlag',
  frist: 'Frist',
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
 */
export function StatusCard({
  spor,
  status,
  actions,
  krevd,
  godkjent,
  unit = 'kr',
}: StatusCardProps) {
  const config = STATUS_CONFIG[status];
  const valueSummary = formatValueSummary(krevd, godkjent, unit);

  return (
    <div
      className={clsx(
        'group bg-white px-4 py-4',
        'border-l-4',
        config.borderClass,
        'hover:bg-pkt-bg-subtle',
        'transition-colors'
      )}
    >
      <div className="flex items-center justify-between">
        {/* Left side: Status dot, title, and status label */}
        <div className="flex items-center gap-3">
          <div
            className={clsx('w-2 h-2 rounded-full', config.dotClass)}
            role="status"
            aria-label={config.ariaLabel}
          />
          <span className="font-medium text-pkt-text-body-dark">
            {SPOR_LABELS[spor]}
          </span>
          <span className="text-sm text-pkt-grays-gray-500">
            {config.label}
          </span>
          {/* Value summary inline */}
          {valueSummary && (
            <span className="text-sm font-medium text-pkt-text-body-dark ml-2">
              {valueSummary}
            </span>
          )}
        </div>

        {/* Right side: Actions or chevron */}
        <div className="flex items-center gap-2">
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
