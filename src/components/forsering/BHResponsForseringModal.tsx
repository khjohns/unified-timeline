/**
 * BHResponsForseringModal Component
 *
 * Modal for BH to respond to a forsering claim.
 * Allows accepting, partially accepting, or rejecting the forsering.
 */

import { useState } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';
import { Badge } from '../primitives/Badge';
import { CheckIcon, Cross2Icon, QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import type { ForseringData } from '../../types/timeline';

type BHResponsType = 'aksepterer' | 'avslaar';

interface BHResponsForseringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forseringData: ForseringData;
  onRespons: (data: {
    aksepterer: boolean;
    godkjent_kostnad?: number;
    begrunnelse: string;
  }) => void;
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

export function BHResponsForseringModal({
  open,
  onOpenChange,
  forseringData,
  onRespons,
  isLoading = false,
}: BHResponsForseringModalProps) {
  const [responsType, setResponsType] = useState<BHResponsType | null>(null);
  const [godkjentKostnad, setGodkjentKostnad] = useState<string>('');
  const [begrunnelse, setBegrunnelse] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!responsType) return;

    onRespons({
      aksepterer: responsType === 'aksepterer',
      godkjent_kostnad: godkjentKostnad ? parseInt(godkjentKostnad, 10) : undefined,
      begrunnelse,
    });
  };

  const handleClose = () => {
    setResponsType(null);
    setGodkjentKostnad('');
    setBegrunnelse('');
    onOpenChange(false);
  };

  // Check if BH has already responded
  const hasResponded = forseringData.bh_aksepterer_forsering !== undefined;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Byggherrens standpunkt til forsering"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info about the forsering */}
        <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-default rounded-none">
          <h4 className="font-bold text-sm mb-2">Forseringskrav fra entreprenør</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-pkt-text-body-subtle">Varslet:</span>
              <span className="ml-2">{formatDate(forseringData.dato_varslet)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Estimert kostnad:</span>
              <span className="ml-2 font-medium">{formatCurrency(forseringData.estimert_kostnad)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Avslåtte dager:</span>
              <span className="ml-2">{forseringData.avslatte_dager} dager</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Maks kostnad (30%):</span>
              <span className="ml-2">{formatCurrency(forseringData.maks_forseringskostnad)}</span>
            </div>
            {forseringData.er_iverksatt && (
              <div>
                <span className="text-pkt-text-body-subtle">Iverksatt:</span>
                <span className="ml-2">{formatDate(forseringData.dato_iverksatt)}</span>
              </div>
            )}
            {forseringData.paalopte_kostnader !== undefined && (
              <div>
                <span className="text-pkt-text-body-subtle">Påløpte kostnader:</span>
                <span className="ml-2">{formatCurrency(forseringData.paalopte_kostnader)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Already responded warning */}
        {hasResponded && (
          <Alert
            variant="info"
            title="Du har allerede gitt et standpunkt"
          >
            <p>
              Du {forseringData.bh_aksepterer_forsering ? 'aksepterte' : 'avslo'} forseringen.
              {forseringData.bh_godkjent_kostnad !== undefined && (
                <> Godkjent kostnad: {formatCurrency(forseringData.bh_godkjent_kostnad)}.</>
              )}
              Du kan oppdatere ditt standpunkt nedenfor.
            </p>
          </Alert>
        )}

        {/* Response type selection */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Ditt standpunkt <span className="text-alert-danger-text">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setResponsType('aksepterer')}
              className={`p-4 border-2 rounded-none text-left transition-colors ${
                responsType === 'aksepterer'
                  ? 'border-badge-success-text bg-badge-success-bg'
                  : 'border-pkt-border-default hover:border-pkt-border-focus'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckIcon className="w-5 h-5 text-badge-success-text" />
                <span className="font-medium">Aksepterer</span>
              </div>
              <p className="text-xs text-pkt-text-body-subtle">
                Entreprenøren hadde rett til å forsere. Forseringskostnadene dekkes.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setResponsType('avslaar')}
              className={`p-4 border-2 rounded-none text-left transition-colors ${
                responsType === 'avslaar'
                  ? 'border-alert-danger-text bg-alert-danger-bg'
                  : 'border-pkt-border-default hover:border-pkt-border-focus'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Cross2Icon className="w-5 h-5 text-alert-danger-text" />
                <span className="font-medium">Avslår</span>
              </div>
              <p className="text-xs text-pkt-text-body-subtle">
                Entreprenøren hadde ikke rett til å forsere. Forseringskostnadene dekkes ikke.
              </p>
            </button>
          </div>
        </div>

        {/* Godkjent kostnad (only when accepting) */}
        {responsType === 'aksepterer' && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Godkjent kostnad (valgfritt)
            </label>
            <input
              type="number"
              value={godkjentKostnad}
              onChange={(e) => setGodkjentKostnad(e.target.value)}
              placeholder={`Maks ${formatCurrency(forseringData.maks_forseringskostnad)}`}
              className="w-full px-3 py-2 border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
            />
            <p className="text-xs text-pkt-text-body-subtle mt-1">
              Angi beløp du godkjenner. Hvis ikke angitt, godkjennes estimert kostnad opptil maks.
            </p>
          </div>
        )}

        {/* Begrunnelse */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Begrunnelse <span className="text-alert-danger-text">*</span>
          </label>
          <textarea
            value={begrunnelse}
            onChange={(e) => setBegrunnelse(e.target.value)}
            placeholder={
              responsType === 'aksepterer'
                ? 'Begrunn hvorfor forseringen aksepteres...'
                : responsType === 'avslaar'
                ? 'Begrunn hvorfor forseringen avslås...'
                : 'Velg først ditt standpunkt...'
            }
            rows={3}
            required
            disabled={!responsType}
            className="w-full px-3 py-2 border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus resize-none disabled:bg-pkt-surface-subtle disabled:text-pkt-text-body-subtle"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t-2 border-pkt-border-subtle">
          <Button variant="ghost" type="button" onClick={handleClose}>
            Avbryt
          </Button>
          <Button
            variant={responsType === 'aksepterer' ? 'primary' : responsType === 'avslaar' ? 'danger' : 'secondary'}
            type="submit"
            disabled={!responsType || !begrunnelse.trim() || isLoading}
          >
            {isLoading ? 'Sender...' : 'Send standpunkt'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
