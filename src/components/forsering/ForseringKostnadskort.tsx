/**
 * ForseringKostnadskort Component
 *
 * Displays the 30% rule calculation for a forsering case.
 * Extracted from SendForseringModal for reuse in ForseringPage.
 */

import { useMemo } from 'react';
import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import type { ForseringData } from '../../types/timeline';

interface ForseringKostnadskortProps {
  forseringData: ForseringData;
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('nb-NO')} kr`;
}

export function ForseringKostnadskort({ forseringData }: ForseringKostnadskortProps) {
  const {
    estimert_kostnad,
    dagmulktsats,
    avslatte_dager,
    maks_forseringskostnad,
    kostnad_innenfor_grense,
  } = forseringData;

  const prosentAvGrense = useMemo(() => {
    if (maks_forseringskostnad <= 0) return 0;
    return (estimert_kostnad / maks_forseringskostnad) * 100;
  }, [estimert_kostnad, maks_forseringskostnad]);

  const dagmulktTotalt = avslatte_dager * dagmulktsats;
  const tillegg30Prosent = dagmulktTotalt * 0.3;

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle flex items-center justify-between">
        <h3 className="font-bold text-sm">30%-regelen (§33.8)</h3>
        <Badge variant={kostnad_innenfor_grense ? 'success' : 'danger'}>
          {kostnad_innenfor_grense ? 'Innenfor grense' : 'Over grense'}
        </Badge>
      </div>

      {/* Calculation breakdown */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-pkt-bg-subtle rounded-none">
            <span className="text-xs text-pkt-text-body-subtle uppercase font-bold block">
              Avslåtte dager
            </span>
            <span className="text-2xl font-bold">{avslatte_dager}</span>
          </div>
          <div className="p-3 bg-pkt-bg-subtle rounded-none">
            <span className="text-xs text-pkt-text-body-subtle uppercase font-bold block">
              Dagmulktsats
            </span>
            <span className="text-lg font-bold">{formatCurrency(dagmulktsats)}</span>
          </div>
          <div className="p-3 bg-pkt-bg-subtle rounded-none">
            <span className="text-xs text-pkt-text-body-subtle uppercase font-bold block">
              Dagmulkt totalt
            </span>
            <span className="text-lg font-bold">{formatCurrency(dagmulktTotalt)}</span>
          </div>
        </div>

        {/* Cost limit calculation */}
        <div className="p-4 bg-pkt-surface-yellow border-2 border-pkt-border-yellow rounded-none">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Dagmulkt ({avslatte_dager} dager × {formatCurrency(dagmulktsats)}):</span>
              <span className="font-mono">{formatCurrency(dagmulktTotalt)}</span>
            </div>
            <div className="flex justify-between">
              <span>+ 30% tillegg:</span>
              <span className="font-mono">{formatCurrency(tillegg30Prosent)}</span>
            </div>
            <div className="flex justify-between border-t border-pkt-border-yellow pt-2 font-bold">
              <span>Maks forseringskostnad:</span>
              <span className="font-mono text-lg">{formatCurrency(maks_forseringskostnad)}</span>
            </div>
          </div>
        </div>

        {/* Estimated vs max comparison */}
        <div className={`p-4 rounded-none border-2 ${
          kostnad_innenfor_grense
            ? 'bg-alert-success-bg border-alert-success-border text-alert-success-text'
            : 'bg-alert-danger-bg border-alert-danger-border text-alert-danger-text'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs uppercase font-bold block">Estimert kostnad</span>
              <span className="text-2xl font-bold">{formatCurrency(estimert_kostnad)}</span>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-bold block">Av maksgrense</span>
              <span className="text-2xl font-bold">{prosentAvGrense.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
