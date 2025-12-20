/**
 * RelatertKOEListe Component
 *
 * Displays a list of related KOE cases for an endringsordre.
 * Shows vederlag and frist amounts for each KOE case.
 * Follows the same pattern as RelaterteSakerListe for consistency.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../primitives';
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
  /** Action button for header (e.g., "Legg til KOE") */
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
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle flex items-center justify-between">
          <Badge variant="default" size="sm">0 KOE-saker</Badge>
          {headerAction}
        </div>
        <div className="p-4">
          <p className="text-pkt-text-body-subtle text-sm">
            Ingen relaterte KOE-saker. Dette er en standalone endringsordre.
          </p>
        </div>
      </Card>
    );
  }

  // Calculate totals
  const totalVederlag = koeOversikt.reduce((sum, koe) => sum + (koe.godkjent_vederlag || 0), 0);
  const totalDager = koeOversikt.reduce((sum, koe) => sum + (koe.godkjent_dager || 0), 0);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="default" size="sm">
            {koeOversikt.length} {koeOversikt.length === 1 ? 'KOE-sak' : 'KOE-saker'}
          </Badge>
          {totalVederlag > 0 && (
            <span className="text-xs text-pkt-text-body-subtle">
              Totalt: <span className="font-medium">{formatCurrency(totalVederlag)}</span>
              {totalDager > 0 && <>, <span className="font-medium">{totalDager} dager</span></>}
            </span>
          )}
        </div>
        {headerAction}
      </div>

      <ul className="divide-y-2 divide-pkt-border-subtle">
        {koeOversikt.map((koe) => {
          const isConfirming = confirmingRemoval === koe.sak_id;

          return (
            <li key={koe.sak_id} className="relative">
              {/* Confirmation overlay */}
              {isConfirming && (
                <div className="absolute inset-0 bg-alert-danger-bg/95 z-10 flex items-center justify-center p-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-alert-danger-text mb-3">
                      Fjern denne KOE-saken fra endringsordren?
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelRemoval}
                        disabled={isRemoving}
                      >
                        <Cross2Icon className="w-4 h-4 mr-1" />
                        Avbryt
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => handleConfirmRemoval(koe.sak_id, e)}
                        disabled={isRemoving}
                      >
                        <TrashIcon className="w-4 h-4 mr-1" />
                        {isRemoving ? 'Fjerner...' : 'Fjern'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <Link
                to={`/saker/${koe.sak_id}`}
                className="block p-4 hover:bg-pkt-surface-subtle transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <span className="font-medium truncate block">
                      {koe.tittel}
                    </span>

                    {/* Vederlag and frist info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                      {koe.godkjent_vederlag !== undefined && (
                        <span className="text-pkt-text-body-subtle">
                          Vederlag:{' '}
                          <span className="font-medium text-pkt-brand-dark-green-1000">
                            {formatCurrency(koe.godkjent_vederlag)}
                          </span>
                        </span>
                      )}
                      {koe.godkjent_dager !== undefined && (
                        <span className="text-pkt-text-body-subtle">
                          Frist:{' '}
                          <span className="font-medium text-pkt-text-body-default">
                            {koe.godkjent_dager} dager
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                    {canRemove && onRemove && (
                      <button
                        onClick={(e) => handleRemoveClick(koe.sak_id, e)}
                        className="p-1.5 text-pkt-text-body-subtle hover:text-alert-danger-text hover:bg-alert-danger-bg rounded transition-colors"
                        title="Fjern fra endringsordre"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                    <ExternalLinkIcon className="w-4 h-4 text-pkt-text-body-subtle group-hover:text-pkt-text-action-active transition-colors" />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
