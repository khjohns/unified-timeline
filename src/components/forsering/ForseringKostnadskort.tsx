/**
 * ForseringKostnadskort Component
 *
 * Displays the 30% rule calculation for a forsering case.
 * Shows the formula for calculating max forsering cost and
 * progress tracking for incurred costs when forsering is active.
 */

import { useMemo } from 'react';
import { Alert, Badge, DashboardCard } from '../primitives';
import type { ForseringData } from '../../types/timeline';

interface ForseringKostnadskortProps {
  forseringData: ForseringData;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

export function ForseringKostnadskort({ forseringData }: ForseringKostnadskortProps) {
  const {
    estimert_kostnad,
    dagmulktsats,
    avslatte_dager,
    maks_forseringskostnad,
    paalopte_kostnader,
    er_iverksatt,
  } = forseringData;

  const paalopteProsentAvEstimert = useMemo(() => {
    if (!paalopte_kostnader || estimert_kostnad <= 0) return 0;
    return (paalopte_kostnader / estimert_kostnad) * 100;
  }, [paalopte_kostnader, estimert_kostnad]);

  const paalopteProsentAvMaks = useMemo(() => {
    if (!paalopte_kostnader || maks_forseringskostnad <= 0) return 0;
    return (paalopte_kostnader / maks_forseringskostnad) * 100;
  }, [paalopte_kostnader, maks_forseringskostnad]);

  // Warning levels for påløpte kostnader
  const overstigerEstimert = paalopte_kostnader !== undefined && paalopte_kostnader > estimert_kostnad;
  const overstigerMaks = paalopte_kostnader !== undefined && paalopte_kostnader > maks_forseringskostnad;
  const naermerSegMaks = paalopte_kostnader !== undefined && paalopteProsentAvMaks >= 80 && !overstigerMaks;
  const naermerSegEstimert = paalopte_kostnader !== undefined && paalopteProsentAvEstimert >= 80 && !overstigerEstimert && !naermerSegMaks;

  const dagmulktTotalt = avslatte_dager * dagmulktsats;
  const tillegg30Prosent = dagmulktTotalt * 0.3;

  return (
    <DashboardCard title="Beregning av maksgrense (§33.8)">
      {/* Cost limit calculation */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-pkt-text-body-subtle">Dagmulkt ({avslatte_dager} dager × {formatCurrency(dagmulktsats)}):</span>
          <span className="font-mono">{formatCurrency(dagmulktTotalt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-pkt-text-body-subtle">+ 30% tillegg:</span>
          <span className="font-mono">{formatCurrency(tillegg30Prosent)}</span>
        </div>
        <div className="flex justify-between border-t border-pkt-border-subtle pt-2 font-bold">
          <span>Maks forseringskostnad:</span>
          <span className="font-mono text-lg">{formatCurrency(maks_forseringskostnad)}</span>
        </div>
      </div>

      {/* Påløpte kostnader tracking (only when forsering is active) */}
      {er_iverksatt && paalopte_kostnader !== undefined && (
        <div className="space-y-3 mt-4 pt-4 border-t border-pkt-border-subtle">
          <h4 className="font-bold text-sm flex items-center gap-2">
            Påløpte kostnader
            {overstigerMaks && (
              <Badge variant="danger" size="sm">Over maksgrense</Badge>
            )}
            {!overstigerMaks && overstigerEstimert && (
              <Badge variant="warning" size="sm">Over estimat</Badge>
            )}
          </h4>

          {/* Progress bar against max */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-pkt-text-body-subtle">Av maksgrense</span>
              <span className={`font-medium ${overstigerMaks ? 'text-pkt-brand-red-1000' : ''}`}>
                {formatCurrency(paalopte_kostnader)} / {formatCurrency(maks_forseringskostnad)} ({paalopteProsentAvMaks.toFixed(0)}%)
              </span>
            </div>
            <div className="h-3 bg-pkt-border-subtle rounded-none overflow-hidden">
              <div
                className={`h-full transition-all ${
                  overstigerMaks ? 'bg-pkt-brand-red-1000' :
                  naermerSegMaks ? 'bg-pkt-brand-yellow-1000' :
                  'bg-pkt-brand-dark-green-1000'
                }`}
                style={{ width: `${Math.min(paalopteProsentAvMaks, 100)}%` }}
              />
            </div>
          </div>

          {/* Progress bar against estimate */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-pkt-text-body-subtle">Av estimat</span>
              <span className={`font-medium ${overstigerEstimert ? 'text-pkt-brand-yellow-1000' : ''}`}>
                {formatCurrency(paalopte_kostnader)} / {formatCurrency(estimert_kostnad)} ({paalopteProsentAvEstimert.toFixed(0)}%)
              </span>
            </div>
            <div className="h-3 bg-pkt-border-subtle rounded-none overflow-hidden">
              <div
                className={`h-full transition-all ${
                  overstigerEstimert ? 'bg-pkt-brand-yellow-1000' :
                  naermerSegEstimert ? 'bg-pkt-brand-yellow-1000' :
                  'bg-pkt-brand-dark-green-1000'
                }`}
                style={{ width: `${Math.min(paalopteProsentAvEstimert, 100)}%` }}
              />
            </div>
          </div>

          {/* Warnings */}
          {overstigerMaks && (
            <Alert variant="danger" title="Maksgrense overskredet">
              <p className="text-sm">
                Påløpte kostnader overstiger 30%-regelen med {formatCurrency(paalopte_kostnader - maks_forseringskostnad)}.
                Kostnader utover denne grensen kan være vanskelig å få dekket iht. NS 8407 §33.8.
              </p>
            </Alert>
          )}
          {!overstigerMaks && naermerSegMaks && (
            <Alert variant="warning" title="Nærmer seg maksgrense">
              <p className="text-sm">
                Påløpte kostnader nærmer seg 30%-grensen. Vurder tiltak for å begrense videre kostnader.
                Gjenstående: {formatCurrency(maks_forseringskostnad - paalopte_kostnader)}.
              </p>
            </Alert>
          )}
          {!overstigerMaks && !naermerSegMaks && overstigerEstimert && (
            <Alert variant="warning" title="Estimat overskredet">
              <p className="text-sm">
                Påløpte kostnader overstiger opprinnelig estimat med {formatCurrency(paalopte_kostnader - estimert_kostnad)}.
                Sørg for god dokumentasjon av merkostnadene.
              </p>
            </Alert>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
