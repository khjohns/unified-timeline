/**
 * ForseringKostnadskort Component
 *
 * Displays the 30% rule calculation for a forsering case.
 * Extracted from SendForseringModal for reuse in ForseringPage.
 * Includes progress tracking for påløpte (incurred) costs with warnings.
 */

import { useMemo } from 'react';
import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { ExclamationTriangleIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
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
    kostnad_innenfor_grense,
    paalopte_kostnader,
    er_iverksatt,
  } = forseringData;

  // Calculate percentages for cost tracking
  const prosentAvGrense = useMemo(() => {
    if (maks_forseringskostnad <= 0) return 0;
    return (estimert_kostnad / maks_forseringskostnad) * 100;
  }, [estimert_kostnad, maks_forseringskostnad]);

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

        {/* Påløpte kostnader tracking (only when forsering is active) */}
        {er_iverksatt && paalopte_kostnader !== undefined && (
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-sm flex items-center gap-2">
              Påløpte kostnader
              {overstigerMaks && (
                <Badge variant="danger" size="sm">Over maksgrense</Badge>
              )}
              {!overstigerMaks && overstigerEstimert && (
                <Badge variant="warning" size="sm">Over estimat</Badge>
              )}
              {!overstigerMaks && !overstigerEstimert && (
                <Badge variant="success" size="sm">Innenfor ramme</Badge>
              )}
            </h4>

            {/* Progress bar against max */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-pkt-text-body-subtle">Av maksgrense</span>
                <span className={`font-medium ${overstigerMaks ? 'text-alert-danger-text' : ''}`}>
                  {formatCurrency(paalopte_kostnader)} / {formatCurrency(maks_forseringskostnad)} ({paalopteProsentAvMaks.toFixed(0)}%)
                </span>
              </div>
              <div className="h-3 bg-pkt-grays-gray-200 rounded-none overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    overstigerMaks ? 'bg-alert-danger-text' :
                    naermerSegMaks ? 'bg-badge-warning-text' :
                    'bg-badge-success-text'
                  }`}
                  style={{ width: `${Math.min(paalopteProsentAvMaks, 100)}%` }}
                />
              </div>
            </div>

            {/* Progress bar against estimate */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-pkt-text-body-subtle">Av estimat</span>
                <span className={`font-medium ${overstigerEstimert ? 'text-badge-warning-text' : ''}`}>
                  {formatCurrency(paalopte_kostnader)} / {formatCurrency(estimert_kostnad)} ({paalopteProsentAvEstimert.toFixed(0)}%)
                </span>
              </div>
              <div className="h-3 bg-pkt-grays-gray-200 rounded-none overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    overstigerEstimert ? 'bg-badge-warning-text' :
                    naermerSegEstimert ? 'bg-pkt-brand-yellow-1000' :
                    'bg-badge-success-text'
                  }`}
                  style={{ width: `${Math.min(paalopteProsentAvEstimert, 100)}%` }}
                />
              </div>
            </div>

            {/* Warnings */}
            {overstigerMaks && (
              <Alert variant="danger" title="Maksgrense overskredet">
                <div className="flex items-start gap-2">
                  <CrossCircledIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Påløpte kostnader overstiger 30%-regelen med {formatCurrency(paalopte_kostnader - maks_forseringskostnad)}.
                    Kostnader utover denne grensen kan være vanskelig å få dekket iht. NS 8407 §33.8.
                  </p>
                </div>
              </Alert>
            )}
            {!overstigerMaks && naermerSegMaks && (
              <Alert variant="warning" title="Nærmer seg maksgrense">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Påløpte kostnader nærmer seg 30%-grensen. Vurder tiltak for å begrense videre kostnader.
                    Gjenstående: {formatCurrency(maks_forseringskostnad - paalopte_kostnader)}.
                  </p>
                </div>
              </Alert>
            )}
            {!overstigerMaks && !naermerSegMaks && overstigerEstimert && (
              <Alert variant="warning" title="Estimat overskredet">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Påløpte kostnader overstiger opprinnelig estimat med {formatCurrency(paalopte_kostnader - estimert_kostnad)}.
                    Sørg for god dokumentasjon av merkostnadene.
                  </p>
                </div>
              </Alert>
            )}
            {!overstigerMaks && !overstigerEstimert && !naermerSegMaks && !naermerSegEstimert && (
              <div className="flex items-center gap-2 text-sm text-badge-success-text">
                <CheckCircledIcon className="w-4 h-4" />
                <span>Påløpte kostnader er innenfor rammen</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
