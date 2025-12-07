/**
 * StatusCard Component
 *
 * Read-only display component for track status.
 * Shows current status, krevd/godkjent values, and contextual actions.
 * Uses white background with Punkt semantic colors and dark blue borders.
 */

import { SporStatus, SporType } from '../../types/timeline';
import { clsx } from 'clsx';
import { ReactNode } from 'react';
import {
  CircleIcon,
  ArrowRightIcon,
  TimerIcon,
  CheckIcon,
  Cross2Icon,
  UpdateIcon,
  TrashIcon,
  LockClosedIcon,
  Half2Icon,
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
  { label: string; badgeClass: string; icon: ReactNode; ariaLabel: string }
> = {
  ikke_relevant: {
    label: 'Ikke relevant',
    badgeClass: 'bg-pkt-surface-strong-gray text-pkt-text-body-dark border border-pkt-border-gray',
    icon: <CircleIcon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Ikke relevant',
  },
  utkast: {
    label: 'Utkast',
    badgeClass: 'bg-pkt-surface-light-beige text-pkt-text-body-dark border border-pkt-border-beige',
    icon: <CircleIcon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Utkast',
  },
  sendt: {
    label: 'Sendt',
    badgeClass: 'bg-pkt-surface-light-blue text-pkt-brand-dark-blue-1000 border border-pkt-brand-blue-500',
    icon: <ArrowRightIcon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Sendt til byggherre',
  },
  under_behandling: {
    label: 'Under behandling',
    badgeClass: 'bg-pkt-surface-yellow text-pkt-brand-dark-blue-1000 border border-pkt-border-yellow',
    icon: <TimerIcon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Under behandling',
  },
  godkjent: {
    label: 'Godkjent',
    badgeClass: 'bg-pkt-surface-light-green text-pkt-brand-dark-green-1000 border border-pkt-border-green',
    icon: <CheckIcon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Godkjent',
  },
  delvis_godkjent: {
    label: 'Delvis godkjent',
    badgeClass: 'bg-pkt-surface-yellow text-pkt-brand-dark-blue-1000 border border-pkt-border-yellow',
    icon: <Half2Icon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Delvis godkjent',
  },
  avvist: {
    label: 'Avvist',
    badgeClass: 'bg-pkt-surface-faded-red text-pkt-brand-red-1000 border border-pkt-border-red',
    icon: <Cross2Icon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Avvist',
  },
  under_forhandling: {
    label: 'Under forhandling',
    badgeClass: 'bg-pkt-surface-yellow text-pkt-brand-dark-blue-1000 border border-pkt-border-yellow',
    icon: <UpdateIcon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Under forhandling',
  },
  trukket: {
    label: 'Trukket',
    badgeClass: 'bg-pkt-surface-strong-gray text-pkt-text-body-dark border border-pkt-border-gray',
    icon: <TrashIcon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Trukket tilbake',
  },
  laast: {
    label: 'Låst',
    badgeClass: 'bg-pkt-surface-light-green text-pkt-brand-dark-green-1000 border border-pkt-border-green',
    icon: <LockClosedIcon className="w-3.5 h-3.5" />,
    ariaLabel: 'Status: Låst',
  },
};

const SPOR_LABELS: Record<SporType, string> = {
  grunnlag: 'GRUNNLAG',
  vederlag: 'VEDERLAG',
  frist: 'FRIST',
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
 * StatusCard displays the current status of a track (grunnlag, vederlag, frist)
 * with dark background and white text for prominence.
 */
export function StatusCard({
  spor,
  status,
  lastUpdated,
  actions,
  krevd,
  godkjent,
  unit = 'kr',
}: StatusCardProps) {
  const config = STATUS_CONFIG[status];
  const hasValues = krevd !== null && krevd !== undefined;

  return (
    <div className="bg-white rounded-none p-4 sm:p-5 flex flex-col border-2 border-pkt-border-default">
      {/* Header: Track title and status badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold text-pkt-brand-dark-blue-1000 uppercase tracking-wide">
          {SPOR_LABELS[spor]}
        </h3>
        <div
          className={clsx(
            'inline-flex items-center gap-1.5',
            'px-2 py-1 rounded-none',
            'text-xs font-semibold',
            config.badgeClass
          )}
          role="status"
          aria-live="polite"
          aria-label={config.ariaLabel}
        >
          <span aria-hidden="true">{config.icon}</span>
          <span>{config.label}</span>
        </div>
      </div>

      {/* Values: Krevd and Godkjent */}
      {hasValues && (
        <div className="flex-1 mb-3">
          <dl className="space-y-2">
            {krevd !== null && krevd !== undefined && (
              <div className="flex justify-between items-baseline">
                <dt className="text-sm text-pkt-grays-gray-600 font-medium">Krevd:</dt>
                <dd className="text-lg font-bold text-pkt-text-body-dark">
                  {formatValue(krevd, unit)}
                </dd>
              </div>
            )}
            {godkjent !== null && godkjent !== undefined && (
              <div className="flex justify-between items-baseline">
                <dt className="text-sm text-pkt-grays-gray-600 font-medium">Godkjent:</dt>
                <dd className="text-lg font-bold text-pkt-brand-dark-green-1000 bg-pkt-surface-faded-green px-2 py-0.5 rounded-none">
                  {formatValue(godkjent, unit)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Grunnlag doesn't have values, show last updated instead */}
      {!hasValues && lastUpdated && (
        <p className="flex-1 text-sm text-pkt-grays-gray-500 mb-3">
          Sist oppdatert:{' '}
          {new Date(lastUpdated).toLocaleDateString('nb-NO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      )}

      {/* Contextual Actions */}
      {actions && (
        <div className="pt-3 border-t border-pkt-border-subtle">
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
    </div>
  );
}
