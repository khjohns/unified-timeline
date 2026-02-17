/**
 * DagmulktTile - Delay exposure: delay days x dagmulkt rate = total exposure.
 * Also shows active forsering cost data when available.
 */

import { BentoCard, BentoCtaCard } from './BentoCard';
import type { ContractSettings } from '../../types/project';
import { formatCurrency, formatCurrencyCompact } from '../../utils/formatters';

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

interface DagmulktTileProps {
  contract: ContractSettings | null;
  totalDagerGodkjent: number;
  forseringPaalopt?: number;
  forseringMaks?: number;
  forseringCount?: number;
}

export function DagmulktTile({
  contract,
  totalDagerGodkjent,
  forseringPaalopt = 0,
  forseringMaks = 0,
  forseringCount = 0,
}: DagmulktTileProps) {
  if (!contract) {
    return (
      <BentoCtaCard
        title="Dagmulkt"
        description="Sett dagmulktsats"
        colSpan="col-span-12 sm:col-span-6 lg:col-span-3"
        delay={100}
      />
    );
  }

  // Adjusted deadline
  const adjustedDate = new Date(contract.kontraktsfrist);
  adjustedDate.setDate(adjustedDate.getDate() + totalDagerGodkjent);
  const adjustedDateStr = adjustedDate.toISOString().split('T')[0]!;

  const today = new Date().toISOString().split('T')[0]!;
  const daysToDeadline = daysBetween(today, adjustedDateStr);
  const delayDays = Math.max(0, -daysToDeadline); // positive when past deadline
  const exposure = delayDays * contract.dagmulkt_sats;

  // Severity: red = past deadline, yellow = within 30 days, green = safe
  let severityColor = 'text-pkt-brand-dark-green-1000';
  let bgColor = 'bg-pkt-brand-light-green-400/30';
  if (delayDays > 0) {
    severityColor = 'text-pkt-brand-red-1000';
    bgColor = 'bg-pkt-brand-red-100/30';
  } else if (daysToDeadline < 30) {
    severityColor = 'text-pkt-brand-yellow-1000';
    bgColor = 'bg-alert-warning-bg/30';
  }

  const hasForsering = forseringCount > 0 && forseringMaks > 0;
  const forseringPct = hasForsering ? Math.min(100, (forseringPaalopt / forseringMaks) * 100) : 0;

  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-3" delay={100}>
      <div className={`p-4 h-full ${bgColor}`}>
        <p className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-2">
          Dagmulkt
        </p>

        {delayDays > 0 ? (
          <>
            <p className={`text-bento-kpi font-bold font-mono tabular-nums leading-tight ${severityColor}`}>
              {formatCurrencyCompact(exposure)}
            </p>
            <p className="text-bento-label text-pkt-text-body-subtle mt-1">
              {delayDays}d &times; {formatCurrency(contract.dagmulkt_sats)}/d
            </p>
          </>
        ) : (
          <>
            <p className={`text-bento-kpi font-bold ${severityColor}`}>
              Ingen forsinkelse
            </p>
            <p className="text-bento-label text-pkt-text-body-subtle mt-1">
              Sats: {formatCurrencyCompact(contract.dagmulkt_sats)}/d
            </p>
          </>
        )}

        {/* Forsering section */}
        <div className="mt-3 pt-3 border-t border-current/10">
          <p className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-1">
            Forsering
          </p>
          {hasForsering ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-bento-body font-bold font-mono tabular-nums text-pkt-text-body-default">
                  {formatCurrencyCompact(forseringPaalopt)}
                </span>
                <span className="text-bento-label text-pkt-text-body-subtle">
                  / {formatCurrencyCompact(forseringMaks)}
                </span>
              </div>
              {/* Progress bar */}
              <div
                className="mt-1 h-1 rounded-full bg-current/10 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(forseringPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Forsering påløpt"
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    forseringPct > 80 ? 'bg-pkt-brand-red-1000' : 'bg-pkt-brand-warm-blue-1000'
                  }`}
                  style={{ width: `${forseringPct}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-bento-label text-pkt-text-body-subtle">
              Ingen aktiv forsering
            </p>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
