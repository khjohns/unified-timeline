/**
 * RelatertKOEListe Component
 *
 * Displays a table of related KOE cases for an endringsordre.
 * Shows vederlag and frist amounts for each KOE case.
 * Follows the same table pattern as RelaterteSakerListe for consistency.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../primitives';
import { ExternalLinkIcon, TrashIcon, Cross2Icon } from '@radix-ui/react-icons';

export interface KOEOversiktItem {
  sak_id: string;
  tittel: string;
  grunnlag_status?: string;
  vederlag_status?: string;
  frist_status?: string;
  krevd_vederlag?: number;
  godkjent_vederlag?: number;
  krevd_dager?: number;
  godkjent_dager?: number;
}

interface RelatertKOEListeProps {
  koeOversikt: KOEOversiktItem[];
  /** Enable removal functionality (typically for BH role in draft status) */
  canRemove?: boolean;
  /** Callback when a KOE is removed */
  onRemove?: (sakId: string) => void;
  /** Loading state during removal */
  isRemoving?: boolean;
  /** Action button for footer (e.g., "Legg til KOE") */
  headerAction?: React.ReactNode;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

export function RelatertKOEListe({
  koeOversikt,
  canRemove = false,
  onRemove,
  isRemoving = false,
  headerAction,
}: RelatertKOEListeProps) {
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);

  const handleRemoveClick = (sakId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmingRemoval(sakId);
  };

  const handleConfirmRemoval = (sakId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove?.(sakId);
    setConfirmingRemoval(null);
  };

  const handleCancelRemoval = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmingRemoval(null);
  };

  if (koeOversikt.length === 0) {
    return (
      <div>
        <p className="text-pkt-text-body-subtle text-sm mb-3">
          Ingen relaterte KOE-saker. Dette er en standalone endringsordre.
        </p>
        {headerAction}
      </div>
    );
  }

  // Calculate totals
  const totalVederlag = koeOversikt.reduce((sum, koe) => sum + (koe.godkjent_vederlag || 0), 0);
  const totalDager = koeOversikt.reduce((sum, koe) => sum + (koe.godkjent_dager || 0), 0);

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pkt-border-subtle">
            <th className="text-left py-1.5 font-medium">Sak</th>
            <th className="text-right py-1.5 font-medium w-28">Vederlag</th>
            <th className="text-right py-1.5 font-medium w-16">Dager</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {koeOversikt.map((koe) => {
            const isConfirming = confirmingRemoval === koe.sak_id;

            return (
              <tr
                key={koe.sak_id}
                className="border-b border-pkt-border-subtle last:border-b-0 hover:bg-pkt-surface-subtle transition-colors relative"
              >
                {/* Confirmation overlay */}
                {isConfirming && (
                  <td colSpan={4} className="p-0">
                    <div className="absolute inset-0 bg-alert-danger-bg/95 z-10 flex items-center justify-center">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-alert-danger-text">
                          Fjern saken?
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelRemoval}
                          disabled={isRemoving}
                        >
                          <Cross2Icon className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => handleConfirmRemoval(koe.sak_id, e)}
                          disabled={isRemoving}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </td>
                )}

                {!isConfirming && (
                  <>
                    <td className="py-2">
                      <Link
                        to={`/saker/${koe.sak_id}`}
                        className="hover:text-pkt-text-action-active transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{koe.tittel}</span>
                          <ExternalLinkIcon className="w-3 h-3 text-pkt-text-body-subtle" />
                        </div>
                      </Link>
                    </td>
                    <td className="text-right py-2 font-mono text-pkt-brand-dark-green-1000">
                      {koe.godkjent_vederlag !== undefined ? formatCurrency(koe.godkjent_vederlag) : '-'}
                    </td>
                    <td className="text-right py-2 font-mono">
                      {koe.godkjent_dager ?? '-'}
                    </td>
                    <td className="text-right py-2">
                      {canRemove && onRemove && (
                        <button
                          onClick={(e) => handleRemoveClick(koe.sak_id, e)}
                          className="p-1 text-pkt-text-body-subtle hover:text-alert-danger-text hover:bg-alert-danger-bg rounded transition-colors"
                          title="Fjern fra endringsordre"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        {koeOversikt.length > 1 && (
          <tfoot>
            <tr className="border-t-2 border-pkt-border-default">
              <td className="py-2 font-bold">Totalt</td>
              <td className="text-right py-2 font-mono font-bold text-pkt-brand-dark-green-1000">
                {formatCurrency(totalVederlag)}
              </td>
              <td className="text-right py-2 font-mono font-bold">{totalDager}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
      {headerAction && (
        <div className="mt-3 pt-3 border-t border-pkt-border-subtle">
          {headerAction}
        </div>
      )}
    </div>
  );
}
