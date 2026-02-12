/**
 * ProgressTile - Contract timeline: deadline, adjusted deadline, days remaining.
 */

import { BentoCard, BentoCtaCard } from './BentoCard';
import type { ContractSettings } from '../../types/project';
import { formatDateShort } from '../../utils/formatters';

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

interface ProgressTileProps {
  contract: ContractSettings | null;
  totalDagerGodkjent: number;
}

export function ProgressTile({ contract, totalDagerGodkjent }: ProgressTileProps) {
  if (!contract) {
    return (
      <BentoCtaCard
        title="Fremdrift"
        description="Legg til kontraktsdatoer"
        colSpan="col-span-12 sm:col-span-6 lg:col-span-5"
        delay={50}
      />
    );
  }

  // Adjusted deadline = original + godkjent fristforlengelse
  const adjustedDate = new Date(contract.kontraktsfrist);
  adjustedDate.setDate(adjustedDate.getDate() + totalDagerGodkjent);
  const adjustedDateStr = adjustedDate.toISOString().split('T')[0]!;

  // Days from today to adjusted deadline
  const today = new Date().toISOString().split('T')[0]!;
  const daysRemaining = daysBetween(today, adjustedDateStr);

  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-5" delay={50}>
      <div className="p-4">
        <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-2">
          Fremdrift
        </p>

        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-pkt-text-body-subtle">Frist</span>
            <span className="text-xs font-mono text-pkt-text-body-default">
              {formatDateShort(contract.kontraktsfrist)}
            </span>
          </div>
          {totalDagerGodkjent > 0 && (
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-pkt-text-body-subtle">Justert</span>
              <span className="text-xs font-mono font-semibold text-pkt-brand-warm-blue-1000">
                {formatDateShort(adjustedDateStr)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-pkt-text-body-subtle">Gjenstår</span>
            <p className={`text-sm font-mono font-bold tabular-nums ${
              daysRemaining < 0 ? 'text-red-600' : daysRemaining < 30 ? 'text-pkt-brand-yellow-1000' : 'text-emerald-600'
            }`}>
              {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d over` : `${daysRemaining}d`}
            </p>
          </div>
          {totalDagerGodkjent > 0 && (
            <p className="text-[10px] text-pkt-text-body-subtle mt-0.5">
              +{totalDagerGodkjent}d forlengelse
            </p>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
