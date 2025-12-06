/**
 * StatusCard Component
 *
 * Read-only display component for track status.
 * Shows current status, last updated time, and visual indicators.
 */

import { Card } from '../primitives/Card';
import { SporStatus, SporType } from '../../types/timeline';
import { clsx } from 'clsx';
import { ReactNode } from 'react';

interface StatusCardProps {
  spor: SporType;
  status: SporStatus;
  title: string;
  lastUpdated?: string;
  actions?: ReactNode;
}

const STATUS_CONFIG: Record<
  SporStatus,
  { label: string; color: string; icon: string; ariaLabel: string }
> = {
  ikke_relevant: {
    label: 'Ikke relevant',
    color: 'bg-gray-100 text-gray-700',
    icon: '○',
    ariaLabel: 'Status: Ikke relevant',
  },
  utkast: {
    label: 'Utkast',
    color: 'bg-gray-100 text-gray-700',
    icon: '○',
    ariaLabel: 'Status: Utkast',
  },
  sendt: {
    label: 'Sendt',
    color: 'bg-info-100 text-info-700',
    icon: '→',
    ariaLabel: 'Status: Sendt til byggherre',
  },
  under_behandling: {
    label: 'Under behandling',
    color: 'bg-warning-100 text-warning-700',
    icon: '⏳',
    ariaLabel: 'Status: Under behandling',
  },
  godkjent: {
    label: 'Godkjent',
    color: 'bg-success-100 text-success-700',
    icon: '✓',
    ariaLabel: 'Status: Godkjent',
  },
  delvis_godkjent: {
    label: 'Delvis godkjent',
    color: 'bg-warning-100 text-warning-700',
    icon: '◐',
    ariaLabel: 'Status: Delvis godkjent',
  },
  avvist: {
    label: 'Avvist',
    color: 'bg-error-100 text-error-700',
    icon: '✗',
    ariaLabel: 'Status: Avvist',
  },
  under_forhandling: {
    label: 'Under forhandling',
    color: 'bg-warning-100 text-warning-700',
    icon: '⇄',
    ariaLabel: 'Status: Under forhandling',
  },
  trukket: {
    label: 'Trukket',
    color: 'bg-gray-100 text-gray-700',
    icon: '⌫',
    ariaLabel: 'Status: Trukket tilbake',
  },
  laast: {
    label: 'Låst',
    color: 'bg-success-100 text-success-700',
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
 * StatusCard displays the current status of a track (grunnlag, vederlag, frist)
 */
export function StatusCard({
  spor,
  status,
  title,
  lastUpdated,
  actions,
}: StatusCardProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Card variant="outlined" padding="md">
      <div className="flex flex-col gap-4">
        {/* Status Information */}
        <div className="flex-1">
          {/* Track Title */}
          <h3 className="text-heading-sm font-bold text-oslo-blue uppercase tracking-wide">
            {SPOR_LABELS[spor]}
          </h3>

          {/* Status Badge */}
          <div
            className={clsx(
              'mt-2 inline-flex items-center gap-2',
              'px-3 py-2 rounded-none',
              'text-sm font-medium',
              config.color
            )}
            role="status"
            aria-live="polite"
            aria-label={config.ariaLabel}
          >
            <span aria-hidden="true">{config.icon}</span>
            <span>{config.label}</span>
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <p className="mt-2 text-sm text-gray-600">
              Sist oppdatert:{' '}
              {new Date(lastUpdated).toLocaleDateString('nb-NO', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Contextual Actions */}
        {actions && (
          <div className="pt-3 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">{actions}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
