/**
 * DagmulktTile - Delay exposure: delay days x dagmulkt rate = total exposure.
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
}

export function DagmulktTile({ contract, totalDagerGodkjent }: DagmulktTileProps) {
  if (!contract) {
    return (
      <BentoCtaCard
        title="Dagmulkt"
        description="Sett dagmulktsats"
        colSpan="col-span-6 lg:col-span-3"
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
  let severityColor = 'text-emerald-600';
  let bgColor = 'bg-emerald-50 dark:bg-emerald-950/20';
  if (delayDays > 0) {
    severityColor = 'text-red-600';
    bgColor = 'bg-red-50 dark:bg-red-950/20';
  } else if (daysToDeadline < 30) {
    severityColor = 'text-pkt-brand-yellow-1000';
    bgColor = 'bg-yellow-50 dark:bg-yellow-950/20';
  }

  return (
    <BentoCard colSpan="col-span-6 lg:col-span-3" delay={100}>
      <div className={`p-4 h-full ${bgColor}`}>
        <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-2">
          Dagmulkt
        </p>

        {delayDays > 0 ? (
          <>
            <p className={`text-lg font-bold font-mono tabular-nums leading-tight ${severityColor}`}>
              {formatCurrencyCompact(exposure)}
            </p>
            <p className="text-[10px] text-pkt-text-body-subtle mt-1">
              {delayDays}d &times; {formatCurrency(contract.dagmulkt_sats)}/d
            </p>
          </>
        ) : (
          <>
            <p className={`text-sm font-bold ${severityColor}`}>
              Ingen forsinkelse
            </p>
            <p className="text-[10px] text-pkt-text-body-subtle mt-1">
              Sats: {formatCurrencyCompact(contract.dagmulkt_sats)}/d
            </p>
          </>
        )}
      </div>
    </BentoCard>
  );
}
