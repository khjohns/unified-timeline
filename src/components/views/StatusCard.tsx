/**
 * StatusCard Component
 *
 * Read-only display component for track status.
 * Shows current status, krevd/godkjent values, and contextual actions.
 * Uses dark background (Punkt dark blue) with white text.
 */

import { SporStatus, SporType } from '../../types/timeline';
import { clsx } from 'clsx';
import { ReactNode } from 'react';

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
  { label: string; badgeClass: string; icon: string; ariaLabel: string }
> = {
  ikke_relevant: {
    label: 'Ikke relevant',
    badgeClass: 'bg-white/20 text-white',
    icon: '○',
    ariaLabel: 'Status: Ikke relevant',
  },
  utkast: {
    label: 'Utkast',
    badgeClass: 'bg-white/20 text-white',
    icon: '○',
    ariaLabel: 'Status: Utkast',
  },
  sendt: {
    label: 'Sendt',
    badgeClass: 'bg-pkt-brand-blue-500 text-pkt-brand-dark-blue-1000',
    icon: '→',
    ariaLabel: 'Status: Sendt til byggherre',
  },
  under_behandling: {
    label: 'Under behandling',
    badgeClass: 'bg-pkt-brand-yellow-1000 text-pkt-brand-dark-blue-1000',
    icon: '⏳',
    ariaLabel: 'Status: Under behandling',
  },
  godkjent: {
    label: 'Godkjent',
    badgeClass: 'bg-pkt-brand-green-1000 text-pkt-brand-dark-blue-1000',
    icon: '✓',
    ariaLabel: 'Status: Godkjent',
  },
  delvis_godkjent: {
    label: 'Delvis godkjent',
    badgeClass: 'bg-pkt-brand-yellow-1000 text-pkt-brand-dark-blue-1000',
    icon: '◐',
    ariaLabel: 'Status: Delvis godkjent',
  },
  avvist: {
    label: 'Avvist',
    badgeClass: 'bg-pkt-brand-red-600 text-white',
    icon: '✗',
    ariaLabel: 'Status: Avvist',
  },
  under_forhandling: {
    label: 'Under forhandling',
    badgeClass: 'bg-pkt-brand-yellow-1000 text-pkt-brand-dark-blue-1000',
    icon: '⇄',
    ariaLabel: 'Status: Under forhandling',
  },
  trukket: {
    label: 'Trukket',
    badgeClass: 'bg-white/20 text-white',
    icon: '⌫',
    ariaLabel: 'Status: Trukket tilbake',
  },
  laast: {
    label: 'Låst',
    badgeClass: 'bg-pkt-brand-green-1000 text-pkt-brand-dark-blue-1000',
    icon: '🔒',
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
    <div className="bg-pkt-surface-strong-dark-blue rounded-none p-4 sm:p-5 flex flex-col">
      {/* Header: Track title and status badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wide">
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
          <dl className="space-y-1">
            {krevd !== null && krevd !== undefined && (
              <div className="flex justify-between items-baseline">
                <dt className="text-sm text-white/70">Krevd:</dt>
                <dd className="text-lg font-bold text-white">
                  {formatValue(krevd, unit)}
                </dd>
              </div>
            )}
            {godkjent !== null && godkjent !== undefined && (
              <div className="flex justify-between items-baseline">
                <dt className="text-sm text-white/70">Godkjent:</dt>
                <dd className="text-lg font-bold text-pkt-brand-green-1000">
                  {formatValue(godkjent, unit)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Grunnlag doesn't have values, show last updated instead */}
      {!hasValues && lastUpdated && (
        <p className="flex-1 text-sm text-white/60 mb-3">
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
        <div className="pt-3 border-t border-white/20">
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
    </div>
  );
}
