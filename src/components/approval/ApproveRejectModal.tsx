/**
 * ApproveRejectModal Component
 *
 * Modal for approving or rejecting a pending approval request.
 * Used by approvers to take action on requests in the chain.
 */

import { useState } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { DataList, DataListItem } from '../primitives/DataList';
import { Textarea } from '../primitives/Textarea';
import { Label } from '../primitives/Label';
import { Badge } from '../primitives/Badge';
import type { ApprovalRequest } from '../../types/approval';
import { ApprovalChainStatus } from './ApprovalChainStatus';
import { formatCurrency, formatDateMedium } from '../../utils/formatters';
import { getNextApprover, APPROVAL_ROLE_LABELS } from '../../constants/approvalConfig';

interface ApproveRejectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ApprovalRequest;
  onApprove: (comment?: string) => void;
  onReject: (reason: string) => void;
}

function getResultatLabel(resultat: string): string {
  switch (resultat) {
    case 'godkjent':
      return 'Godkjent';
    case 'delvis_godkjent':
      return 'Delvis godkjent';
    case 'avslatt':
      return 'Avslått';
    default:
      return resultat;
  }
}

function getResultatVariant(resultat: string): 'success' | 'warning' | 'danger' {
  switch (resultat) {
    case 'godkjent':
      return 'success';
    case 'delvis_godkjent':
      return 'warning';
    case 'avslatt':
      return 'danger';
    default:
      return 'warning';
  }
}

export function ApproveRejectModal({
  open,
  onOpenChange,
  request,
  onApprove,
  onReject,
}: ApproveRejectModalProps) {
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState<'view' | 'reject'>('view');

  const nextApprover = getNextApprover(request.steps);
  const draft = request.responseData;

  const handleApprove = () => {
    onApprove(comment || undefined);
    setComment('');
    setMode('view');
    onOpenChange(false);
  };

  const handleReject = () => {
    if (!comment.trim()) {
      return; // Require reason for rejection
    }
    onReject(comment);
    setComment('');
    setMode('view');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setComment('');
    setMode('view');
    onOpenChange(false);
  };

  const handleBack = () => {
    setMode('view');
    setComment('');
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === 'reject'
          ? 'Avvis forespørsel'
          : `Godkjenning: ${request.sporType === 'vederlag' ? 'Vederlag' : 'Frist'}`
      }
      size="lg"
    >
      <div className="space-y-6">
        {mode === 'view' && (
          <>
            {/* Request Info */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Forespørsel</h3>
              <div className="bg-pkt-surface-light-beige p-4 border border-pkt-border-subtle">
                <DataList variant="grid">
                  <DataListItem label="Sak">
                    {request.sakId}
                  </DataListItem>
                  <DataListItem label="Type">
                    {request.sporType === 'vederlag' ? 'Vederlag' : 'Fristforlengelse'}
                  </DataListItem>
                  <DataListItem label="Sendt inn">
                    {request.submittedAt ? formatDateMedium(request.submittedAt) : '-'}
                  </DataListItem>
                  <DataListItem label="Av">
                    {request.submittedBy || 'Ukjent'}
                  </DataListItem>
                </DataList>
              </div>
            </section>

            {/* Response Summary */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Foreslått svar</h3>
              <div className="bg-pkt-surface-light-beige p-4 border border-pkt-border-subtle">
                <DataList variant="grid">
                  <DataListItem label={draft.sporType === 'vederlag' ? 'Godkjent beløp' : 'Godkjente dager'}>
                    {draft.sporType === 'vederlag'
                      ? formatCurrency(draft.belop)
                      : `${draft.dager} dager`}
                  </DataListItem>
                  <DataListItem label="Resultat">
                    <Badge variant={getResultatVariant(draft.resultat)} size="sm">
                      {getResultatLabel(draft.resultat)}
                    </Badge>
                  </DataListItem>
                </DataList>
                {draft.begrunnelse && (
                  <div className="mt-3 pt-3 border-t border-pkt-border-subtle">
                    <div className="text-sm text-pkt-text-body-muted mb-1">Begrunnelse:</div>
                    <div className="text-sm">{draft.begrunnelse}</div>
                  </div>
                )}
              </div>
            </section>

            {/* Approval Chain Status */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Godkjenningsstatus</h3>
              <ApprovalChainStatus
                steps={request.steps}
                collapsible={false}
                compact={false}
              />
            </section>

            {/* Your Action */}
            {nextApprover && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Din handling</h3>
                <div className="bg-pkt-surface-light-yellow p-4 border border-pkt-border-warning">
                  <p className="text-sm mb-3">
                    Du godkjenner som <strong>{nextApprover.roleName}</strong>.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="approve-comment" className="mb-2 block">
                        Kommentar (valgfritt)
                      </Label>
                      <Textarea
                        id="approve-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Legg til en kommentar..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
              <Button variant="secondary" onClick={handleCancel}>
                Lukk
              </Button>
              <Button variant="danger" onClick={() => setMode('reject')}>
                Avvis
              </Button>
              <Button variant="primary" onClick={handleApprove}>
                Godkjenn
              </Button>
            </div>
          </>
        )}

        {mode === 'reject' && (
          <>
            <section>
              <div className="bg-pkt-surface-light-red p-4 border border-pkt-border-error mb-4">
                <p className="text-sm">
                  Ved avvisning vil saken returneres til prosjektleder for revisjon.
                  Du må oppgi en begrunnelse.
                </p>
              </div>
              <Label htmlFor="reject-reason" className="mb-2 block">
                Begrunnelse for avvisning *
              </Label>
              <Textarea
                id="reject-reason"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Forklar hvorfor forespørselen avvises..."
                rows={4}
                error={comment.trim() === ''}
              />
            </section>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
              <Button variant="secondary" onClick={handleBack}>
                Tilbake
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={!comment.trim()}
              >
                Bekreft avvisning
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
