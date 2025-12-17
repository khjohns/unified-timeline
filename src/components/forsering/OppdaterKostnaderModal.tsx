/**
 * OppdaterKostnaderModal Component
 *
 * Modal for TE to update incurred costs during an active forsering.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';
import { UpdateIcon } from '@radix-ui/react-icons';
import type { ForseringData } from '../../types/timeline';

interface OppdaterKostnaderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forseringData: ForseringData;
  onOppdater: (data: { paalopte_kostnader: number; kommentar?: string }) => void;
  isLoading?: boolean;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

export function OppdaterKostnaderModal({
  open,
  onOpenChange,
  forseringData,
  onOppdater,
  isLoading = false,
}: OppdaterKostnaderModalProps) {
  const [paalopteKostnader, setPaalopteKostnader] = useState<string>('');
  const [kommentar, setKommentar] = useState('');

  // Pre-fill with current value when opening
  useEffect(() => {
    if (open && forseringData.paalopte_kostnader !== undefined) {
      setPaalopteKostnader(forseringData.paalopte_kostnader.toString());
    }
  }, [open, forseringData.paalopte_kostnader]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kostnad = parseInt(paalopteKostnader, 10);
    if (isNaN(kostnad) || kostnad < 0) return;

    onOppdater({
      paalopte_kostnader: kostnad,
      kommentar: kommentar || undefined,
    });
  };

  const handleClose = () => {
    setPaalopteKostnader('');
    setKommentar('');
    onOpenChange(false);
  };

  const nyKostnad = parseInt(paalopteKostnader, 10) || 0;
  const overstigerMaks = nyKostnad > forseringData.maks_forseringskostnad;
  const overstigerEstimert = nyKostnad > forseringData.estimert_kostnad;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Oppdater påløpte kostnader"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current status */}
        <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-default rounded-none">
          <h4 className="font-bold text-sm mb-2">Kostnadsramme</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-pkt-text-body-subtle">Estimert kostnad:</span>
              <span className="ml-2">{formatCurrency(forseringData.estimert_kostnad)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Maks (30%-regel):</span>
              <span className="ml-2">{formatCurrency(forseringData.maks_forseringskostnad)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Nåværende påløpt:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(forseringData.paalopte_kostnader)}
              </span>
            </div>
          </div>
        </div>

        {/* Påløpte kostnader input */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nye påløpte kostnader <span className="text-alert-danger-text">*</span>
          </label>
          <input
            type="number"
            value={paalopteKostnader}
            onChange={(e) => setPaalopteKostnader(e.target.value)}
            placeholder="F.eks. 350000"
            required
            min="0"
            className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
          />
        </div>

        {/* Warnings */}
        {overstigerMaks && (
          <Alert variant="danger" title="Overstiger maksgrense">
            Påløpte kostnader overstiger 30%-regelen ({formatCurrency(forseringData.maks_forseringskostnad)}).
            Kostnader utover dette kan være vanskelig å få dekket.
          </Alert>
        )}

        {!overstigerMaks && overstigerEstimert && (
          <Alert variant="warning" title="Overstiger estimat">
            Påløpte kostnader overstiger opprinnelig estimat ({formatCurrency(forseringData.estimert_kostnad)}).
            Sørg for god dokumentasjon av merkostnadene.
          </Alert>
        )}

        {/* Kommentar */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Kommentar (valgfritt)
          </label>
          <textarea
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder="Beskriv kostnadsutvikling, f.eks. 'Ekstra skift uke 8-9 pga værforhold'"
            rows={2}
            className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t-2 border-pkt-border-subtle">
          <Button variant="ghost" type="button" onClick={handleClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!paalopteKostnader || nyKostnad < 0 || isLoading}
          >
            <UpdateIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Oppdaterer...' : 'Oppdater kostnader'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
