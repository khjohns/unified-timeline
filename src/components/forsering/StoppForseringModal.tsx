/**
 * StoppForseringModal Component
 *
 * Modal for stopping an active forsering.
 * Requires TE to provide a reason and confirm.
 */

import { useState } from 'react';
import { Alert, Button, Modal } from '../primitives';
import { StopIcon } from '@radix-ui/react-icons';
import type { ForseringData } from '../../types/timeline';

interface StoppForseringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forseringData: ForseringData;
  onStopp: (data: { begrunnelse: string; paalopte_kostnader?: number }) => void;
  isLoading?: boolean;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function StoppForseringModal({
  open,
  onOpenChange,
  forseringData,
  onStopp,
  isLoading = false,
}: StoppForseringModalProps) {
  const [begrunnelse, setBegrunnelse] = useState('');
  const [paalopteKostnader, setPaalopteKostnader] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStopp({
      begrunnelse,
      paalopte_kostnader: paalopteKostnader ? parseInt(paalopteKostnader, 10) : undefined,
    });
  };

  const handleClose = () => {
    setBegrunnelse('');
    setPaalopteKostnader('');
    onOpenChange(false);
  };

  // Can only stop if forsering is active (iverksatt but not stopped)
  const canStop = forseringData.er_iverksatt && !forseringData.er_stoppet;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Stopp forsering"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Warning */}
        <Alert variant="warning" title="Du er i ferd med å stoppe forseringen">
          <p>
            Når forseringen stoppes, vil alle forseringskostnader påløpt frem til nå
            kunne kreves dekket. Sørg for å dokumentere påløpte kostnader.
          </p>
        </Alert>

        {/* Current status */}
        <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-default rounded-none">
          <h4 className="font-bold text-sm mb-2">Nåværende status</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-pkt-text-body-subtle">Iverksatt:</span>
              <span className="ml-2">{formatDate(forseringData.dato_iverksatt)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Estimert kostnad:</span>
              <span className="ml-2">{formatCurrency(forseringData.estimert_kostnad)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Avslåtte dager:</span>
              <span className="ml-2">{forseringData.avslatte_dager} dager</span>
            </div>
            {forseringData.paalopte_kostnader !== undefined && (
              <div>
                <span className="text-pkt-text-body-subtle">Påløpt hittil:</span>
                <span className="ml-2">{formatCurrency(forseringData.paalopte_kostnader)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Påløpte kostnader input */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Påløpte kostnader ved stopp (valgfritt)
          </label>
          <input
            type="number"
            value={paalopteKostnader}
            onChange={(e) => setPaalopteKostnader(e.target.value)}
            placeholder="F.eks. 250000"
            className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
          />
          <p className="text-xs text-pkt-text-body-subtle mt-1">
            Angi faktiske påløpte forseringskostnader frem til nå
          </p>
        </div>

        {/* Begrunnelse */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Begrunnelse for stopp <span className="text-alert-danger-text">*</span>
          </label>
          <textarea
            value={begrunnelse}
            onChange={(e) => setBegrunnelse(e.target.value)}
            placeholder="Forklar hvorfor forseringen stoppes..."
            rows={3}
            required
            className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t-2 border-pkt-border-subtle">
          <Button variant="ghost" type="button" onClick={handleClose}>
            Avbryt
          </Button>
          <Button
            variant="danger"
            type="submit"
            disabled={!begrunnelse.trim() || !canStop || isLoading}
          >
            <StopIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Stopper...' : 'Stopp forsering'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
