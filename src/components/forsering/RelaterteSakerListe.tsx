/**
 * RelaterteSakerListe Component
 *
 * Displays a list of related cases for a forsering case.
 * Each case is clickable and shows key status info.
 * Supports removal of cases when canRemove is enabled.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { ExternalLinkIcon, TrashIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { SakRelasjon, SakState } from '../../types/timeline';

interface RelatertSakInfo extends SakRelasjon {
  state?: SakState;
}

interface RelaterteSakerListeProps {
  relaterteSaker: RelatertSakInfo[];
  sakStates?: Record<string, SakState>;
  /** Enable removal functionality (typically for TE role) */
  canRemove?: boolean;
  /** Callback when a case is removed */
  onRemove?: (sakId: string) => void;
  /** Loading state during removal */
  isRemoving?: boolean;
}

function getGrunnlagBadge(state?: SakState) {
  if (!state?.grunnlag?.bh_resultat) return null;

  const variants: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
    godkjent: 'success',
    delvis_godkjent: 'warning',
    avslatt: 'danger',
    erkjenn_fm: 'success',
  };

  const labels: Record<string, string> = {
    godkjent: 'Grunnlag godkjent',
    delvis_godkjent: 'Grunnlag delvis',
    avslatt: 'Grunnlag avslått',
    erkjenn_fm: 'Force Majeure',
  };

  const variant = variants[state.grunnlag.bh_resultat] || 'default';
  const label = labels[state.grunnlag.bh_resultat] || state.grunnlag.bh_resultat;

  return <Badge variant={variant} size="sm">{label}</Badge>;
}

function getFristBadge(state?: SakState) {
  if (!state?.frist?.bh_resultat) return null;

  const variants: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
    godkjent: 'success',
    delvis_godkjent: 'warning',
    avslatt: 'danger',
  };

  const labels: Record<string, string> = {
    godkjent: 'Frist godkjent',
    delvis_godkjent: 'Frist delvis',
    avslatt: 'Frist avslått',
  };

  const variant = variants[state.frist.bh_resultat] || 'default';
  const label = labels[state.frist.bh_resultat] || state.frist.bh_resultat;

  return <Badge variant={variant} size="sm">{label}</Badge>;
}

export function RelaterteSakerListe({
  relaterteSaker,
  sakStates = {},
  canRemove = false,
  onRemove,
  isRemoving = false,
}: RelaterteSakerListeProps) {
  // Track which case is pending removal confirmation
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

  if (relaterteSaker.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-pkt-text-body-subtle text-sm">
          Ingen relaterte saker funnet.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle">
        <h3 className="font-bold text-sm">
          Relaterte saker ({relaterteSaker.length})
        </h3>
        <p className="text-xs text-pkt-text-body-subtle mt-1">
          Avslåtte fristforlengelser som forseringen er basert på
        </p>
      </div>

      <ul className="divide-y-2 divide-pkt-border-subtle">
        {relaterteSaker.map((sak) => {
          const state = sakStates[sak.relatert_sak_id] || sak.state;
          const isConfirming = confirmingRemoval === sak.relatert_sak_id;

          return (
            <li key={sak.relatert_sak_id} className="relative">
              {/* Confirmation overlay */}
              {isConfirming && (
                <div className="absolute inset-0 bg-alert-danger-bg/95 z-10 flex items-center justify-center p-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-alert-danger-text mb-3">
                      Fjern denne saken fra forseringen?
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
                        onClick={(e) => handleConfirmRemoval(sak.relatert_sak_id, e)}
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
                to={`/saker/${sak.relatert_sak_id}`}
                className="block p-4 hover:bg-pkt-surface-subtle transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title and number */}
                    <div className="flex items-center gap-2">
                      {sak.bimsync_issue_number && (
                        <span className="text-xs font-mono text-pkt-text-body-subtle">
                          #{sak.bimsync_issue_number}
                        </span>
                      )}
                      <span className="font-medium truncate">
                        {sak.relatert_sak_tittel || state?.sakstittel || 'Ukjent sak'}
                      </span>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getGrunnlagBadge(state)}
                      {getFristBadge(state)}
                      {state?.frist?.krevd_dager && (
                        <Badge variant="default" size="sm">
                          {state.frist.krevd_dager} dager krevd
                        </Badge>
                      )}
                    </div>

                    {/* Grunnlag category if available */}
                    {state?.grunnlag?.hovedkategori && (
                      <p className="text-xs text-pkt-text-body-subtle mt-2">
                        {state.grunnlag.hovedkategori}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                    {canRemove && onRemove && (
                      <button
                        onClick={(e) => handleRemoveClick(sak.relatert_sak_id, e)}
                        className="p-1.5 text-pkt-text-body-subtle hover:text-alert-danger-text hover:bg-alert-danger-bg rounded transition-colors"
                        title="Fjern fra forsering"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                    <ExternalLinkIcon className="w-4 h-4 text-pkt-text-body-subtle group-hover:text-pkt-text-brand transition-colors" />
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
