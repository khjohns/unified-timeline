/**
 * RelaterteSakerListe Component
 *
 * Displays a table of related cases for a forsering case.
 * Each row is clickable and shows key status info.
 * Supports removal of cases when canRemove is enabled.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Badge } from '../primitives';
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
  /** Action button for header (e.g., "Legg til sak") */
  headerAction?: React.ReactNode;
}

function getGrunnlagStatus(state?: SakState): { variant: 'success' | 'danger' | 'warning' | 'default'; label: string } | null {
  if (!state?.grunnlag?.bh_resultat) return null;

  const config: Record<string, { variant: 'success' | 'danger' | 'warning' | 'default'; label: string }> = {
    godkjent: { variant: 'success', label: 'Godkjent' },
    delvis_godkjent: { variant: 'warning', label: 'Delvis' },
    avslatt: { variant: 'danger', label: 'Avslått' },
  };

  return config[state.grunnlag.bh_resultat] || { variant: 'default', label: state.grunnlag.bh_resultat };
}

function getFristStatus(state?: SakState): { variant: 'success' | 'danger' | 'warning' | 'default'; label: string } | null {
  if (!state?.frist?.bh_resultat) return null;

  const config: Record<string, { variant: 'success' | 'danger' | 'warning' | 'default'; label: string }> = {
    godkjent: { variant: 'success', label: 'Godkjent' },
    delvis_godkjent: { variant: 'warning', label: 'Delvis' },
    avslatt: { variant: 'danger', label: 'Avslått' },
  };

  return config[state.frist.bh_resultat] || { variant: 'default', label: state.frist.bh_resultat };
}

export function RelaterteSakerListe({
  relaterteSaker,
  sakStates = {},
  canRemove = false,
  onRemove,
  isRemoving = false,
  headerAction,
}: RelaterteSakerListeProps) {
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

  // Calculate totals
  const totalDager = relaterteSaker.reduce((sum, sak) => {
    const state = sakStates[sak.relatert_sak_id] || sak.state;
    return sum + (state?.frist?.krevd_dager || 0);
  }, 0);

  const avslatteDager = relaterteSaker.reduce((sum, sak) => {
    const state = sakStates[sak.relatert_sak_id] || sak.state;
    const fristStatus = getFristStatus(state);
    if (fristStatus?.variant === 'danger') {
      return sum + (state?.frist?.krevd_dager || 0);
    }
    return sum;
  }, 0);

  if (relaterteSaker.length === 0) {
    return (
      <div>
        <p className="text-pkt-text-body-subtle text-sm mb-3">
          Ingen relaterte saker lagt til ennå.
        </p>
        {headerAction}
      </div>
    );
  }

  return (
    <div>
      <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pkt-border-subtle">
              <th className="text-left py-1.5 font-medium">Sak</th>
              <th className="text-center py-1.5 font-medium w-28">Ansvarsgrunnlag</th>
              <th className="text-center py-1.5 font-medium w-20">Frist</th>
              <th className="text-right py-1.5 font-medium w-16">Dager</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {relaterteSaker.map((sak) => {
              const state = sakStates[sak.relatert_sak_id] || sak.state;
              const isConfirming = confirmingRemoval === sak.relatert_sak_id;
              const grunnlagStatus = getGrunnlagStatus(state);
              const fristStatus = getFristStatus(state);

              return (
                <tr
                  key={sak.relatert_sak_id}
                  className="border-b border-pkt-border-subtle last:border-b-0 hover:bg-pkt-surface-subtle transition-colors relative"
                >
                  {/* Confirmation overlay */}
                  {isConfirming && (
                    <td colSpan={5} className="p-0">
                      <div className="absolute inset-0 bg-alert-danger-bg/95 z-10 flex items-center justify-center">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-alert-danger-text">
                            Fjern saken?
                          </span>
                          <Button
                            variant="ghost"
                                                       onClick={handleCancelRemoval}
                            disabled={isRemoving}
                          >
                            <Cross2Icon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="danger"
                                                       onClick={(e) => handleConfirmRemoval(sak.relatert_sak_id, e)}
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
                          to={`/saker/${sak.relatert_sak_id}`}
                          className="hover:text-pkt-text-action-active transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {sak.bimsync_issue_number && (
                              <span className="text-xs font-mono text-pkt-text-body-subtle">
                                #{sak.bimsync_issue_number}
                              </span>
                            )}
                            <span className="font-medium">
                              {sak.relatert_sak_tittel || state?.sakstittel || 'Ukjent sak'}
                            </span>
                            <ExternalLinkIcon className="w-3 h-3 text-pkt-text-body-subtle" />
                          </div>
                        </Link>
                      </td>
                      <td className="text-center py-2">
                        {grunnlagStatus ? (
                          <Badge variant={grunnlagStatus.variant}>{grunnlagStatus.label}</Badge>
                        ) : (
                          <span className="text-pkt-text-body-subtle">-</span>
                        )}
                      </td>
                      <td className="text-center py-2">
                        {fristStatus ? (
                          <Badge variant={fristStatus.variant}>{fristStatus.label}</Badge>
                        ) : (
                          <span className="text-pkt-text-body-subtle">-</span>
                        )}
                      </td>
                      <td className="text-right py-2 font-mono">
                        {state?.frist?.krevd_dager ?? '-'}
                      </td>
                      <td className="text-right py-2">
                        {canRemove && onRemove && (
                          <button
                            onClick={(e) => handleRemoveClick(sak.relatert_sak_id, e)}
                            className="p-1 text-pkt-text-body-subtle hover:text-alert-danger-text hover:bg-alert-danger-bg rounded transition-colors"
                            title="Fjern fra forsering"
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
          {relaterteSaker.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-pkt-border-default">
                <td className="py-2 font-bold" colSpan={3}>Totalt</td>
                <td className="text-right py-2 font-mono font-bold">{totalDager}</td>
                <td></td>
              </tr>
              {avslatteDager > 0 && (
                <tr>
                  <td className="py-1 text-pkt-text-body-subtle" colSpan={3}>
                    <span className="italic">herav avslått</span>
                  </td>
                  <td className="text-right py-1 font-mono text-pkt-brand-red-1000">{avslatteDager}</td>
                  <td></td>
                </tr>
              )}
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
