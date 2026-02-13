/**
 * ContractEconomicsTile - Shows contract sum, claimed amount, approved amount with progress bar.
 */

import { BentoCard, BentoCtaCard } from './BentoCard';
import type { ContractSettings } from '../../types/project';
import { formatCurrency, formatCurrencyCompact } from '../../utils/formatters';

interface ContractEconomicsTileProps {
  contract: ContractSettings | null;
  totalKrevd: number;
  totalGodkjent: number;
}

export function ContractEconomicsTile({ contract, totalKrevd, totalGodkjent }: ContractEconomicsTileProps) {
  if (!contract) {
    return (
      <BentoCtaCard
        title="Kontraktsøkonomi"
        description="Legg til kontraktssum for å se økonomi-oversikt"
        colSpan="col-span-12 md:col-span-4"
        delay={50}
      />
    );
  }

  const adjustedSum = contract.kontraktssum + totalGodkjent;
  const krevdPct = contract.kontraktssum > 0
    ? Math.min(Math.round((totalKrevd / contract.kontraktssum) * 100), 100)
    : 0;
  const godkjentPct = contract.kontraktssum > 0
    ? Math.min(Math.round((totalGodkjent / contract.kontraktssum) * 100), 100)
    : 0;

  return (
    <BentoCard colSpan="col-span-12 md:col-span-4" delay={50}>
      <div className="p-5">
        <p className="text-xs font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-3">
          Kontraktsøkonomi
        </p>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-pkt-text-body-subtle">Kontraktssum</span>
            <span className="text-sm font-semibold font-mono text-pkt-text-body-dark">
              {formatCurrencyCompact(contract.kontraktssum)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-pkt-text-body-subtle">Justert sum</span>
            <span className="text-sm font-semibold font-mono text-pkt-text-body-dark">
              {formatCurrencyCompact(adjustedSum)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-pkt-text-body-subtle">
            <span>Krevd</span>
            <span className="font-mono">{formatCurrency(totalKrevd)}</span>
          </div>
          <div className="h-2 bg-pkt-grays-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-pkt-brand-yellow-1000 rounded-full transition-all duration-700"
              style={{ width: `${krevdPct}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-pkt-text-body-subtle">
            <span>Godkjent</span>
            <span className="font-mono">{formatCurrency(totalGodkjent)}</span>
          </div>
          <div className="h-2 bg-pkt-grays-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-pkt-brand-dark-green-1000 rounded-full transition-all duration-700"
              style={{ width: `${godkjentPct}%` }}
            />
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
