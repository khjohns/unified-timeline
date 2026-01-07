/**
 * ApprovePakkeModal Component
 *
 * Modal for approving or rejecting a combined BH response package.
 * Used by approvers to take action on pending packages in the approval chain.
 */

import { useState } from 'react';
import {
  Modal,
  Button,
  Label,
  Badge,
  Textarea,
  SectionContainer,
  Alert,
} from '../primitives';
import type { BhResponsPakke } from '../../types/approval';
import {
  APPROVAL_ROLE_LABELS,
  getNextApprover,
  type MockPerson,
} from '../../constants/approvalConfig';
import { ApprovalChainStatus } from './ApprovalChainStatus';
import { formatCurrency, formatDateMedium } from '../../utils/formatters';

interface ApprovePakkeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pakke: BhResponsPakke;
  currentMockUser: MockPerson;
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
    case 'frafalt':
      return 'Frafalt';
    case 'erkjenn_fm':
      return 'Force majeure erkjent';
    default:
      return resultat;
  }
}

function getResultatVariant(resultat: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (resultat) {
    case 'godkjent':
      return 'success';
    case 'delvis_godkjent':
      return 'warning';
    case 'avslatt':
      return 'danger';
    case 'frafalt':
      return 'default';
    case 'erkjenn_fm':
      return 'success';
    default:
      return 'default';
  }
}

export function ApprovePakkeModal({
  open,
  onOpenChange,
  pakke,
  currentMockUser,
  onApprove,
  onReject,
}: ApprovePakkeModalProps) {
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState<'view' | 'reject'>('view');

  const nextApprover = getNextApprover(pakke.steps);
  const currentUserRole = currentMockUser.rolle;
  const isCurrentApprover = nextApprover?.role === currentUserRole;

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

  // Build list of included responses
  const includedResponses: { label: string; value: string; resultat: string }[] = [];
  if (pakke.grunnlagRespons) {
    includedResponses.push({
      label: 'Ansvarsgrunnlag',
      value: getResultatLabel(pakke.grunnlagRespons.resultat),
      resultat: pakke.grunnlagRespons.resultat,
    });
  }
  if (pakke.vederlagRespons) {
    includedResponses.push({
      label: 'Vederlag',
      value: `${formatCurrency(pakke.vederlagBelop)} (${getResultatLabel(pakke.vederlagRespons.resultat).toLowerCase()})`,
      resultat: pakke.vederlagRespons.resultat,
    });
  }
  if (pakke.fristRespons) {
    includedResponses.push({
      label: 'Frist',
      value: `${pakke.fristDager} dager (${getResultatLabel(pakke.fristRespons.resultat).toLowerCase()})`,
      resultat: pakke.fristRespons.resultat,
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Godkjenn BH-respons"
      size="lg"
    >
      <div className="space-y-4">
        {mode === 'view' && (
          <>
            {/* Intro Alert */}
            <Alert
              variant={isCurrentApprover ? 'warning' : 'info'}
              title={isCurrentApprover ? 'Forespørsel venter på din godkjenning' : 'Forespørsel under behandling'}
            >
              {pakke.submittedBy} sendte denne forespørselen{' '}
              {pakke.submittedAt ? formatDateMedium(pakke.submittedAt) : ''}.
              {isCurrentApprover && (
                <> Du godkjenner som <strong>{APPROVAL_ROLE_LABELS[currentUserRole]}</strong>.</>
              )}
              {!isCurrentApprover && nextApprover && (
                <> Venter på godkjenning fra <strong>{nextApprover.roleName}</strong>.</>
              )}
            </Alert>

            {/* Included Responses */}
            <SectionContainer title="Inkluderte svar">
              <div className="space-y-2">
                {includedResponses.map((response) => (
                  <div key={response.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-pkt-text-success">✓</span>
                      {response.label}
                    </span>
                    <Badge variant={getResultatVariant(response.resultat)} size="sm">
                      {response.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </SectionContainer>

            {/* Amount Calculation */}
            <SectionContainer title="Beløpsberegning">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Vederlag</span>
                  <span className="font-mono">{formatCurrency(pakke.vederlagBelop)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frist ({pakke.fristDager} dager × {formatCurrency(pakke.dagmulktsats)}/dag)</span>
                  <span className="font-mono">{formatCurrency(pakke.fristBelop)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-pkt-border-default font-bold">
                  <span>Samlet eksponering</span>
                  <span className="font-mono">{formatCurrency(pakke.samletBelop)}</span>
                </div>
              </div>
            </SectionContainer>

            {/* Approval Chain Status */}
            <SectionContainer title="Godkjenningskjede">
              <ApprovalChainStatus
                steps={pakke.steps}
                collapsible={false}
                compact={false}
              />
            </SectionContainer>

            {/* Your Action */}
            {isCurrentApprover && (
              <SectionContainer title="Din handling">
                <div>
                  <Label htmlFor="approve-comment" className="text-sm mb-1 block">
                    Kommentar (valgfritt)
                  </Label>
                  <Textarea
                    id="approve-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Legg til en kommentar..."
                    rows={3}
                    fullWidth
                  />
                </div>
              </SectionContainer>
            )}

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-4 border-t border-pkt-border-subtle">
              <div>
                {isCurrentApprover && (
                  <Button variant="danger" onClick={() => setMode('reject')}>
                    Avvis
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCancel}>
                  Lukk
                </Button>
                {isCurrentApprover && (
                  <Button variant="primary" onClick={handleApprove}>
                    Godkjenn
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {mode === 'reject' && (
          <>
            {/* Reject Warning */}
            <Alert variant="danger" title="Avvis forespørsel">
              Ved avvisning vil saken returneres til prosjektleder for revisjon.
              Du må oppgi en begrunnelse.
            </Alert>

            {/* Rejection Reason */}
            <SectionContainer title="Begrunnelse">
              <div>
                <Label htmlFor="reject-reason" className="text-sm mb-1 block">
                  Begrunnelse for avvisning *
                </Label>
                <Textarea
                  id="reject-reason"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Forklar hvorfor forespørselen avvises..."
                  rows={4}
                  fullWidth
                  error={comment.trim() === ''}
                />
              </div>
            </SectionContainer>

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-4 border-t border-pkt-border-subtle">
              <Button variant="ghost" onClick={handleBack}>
                ← Tilbake
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
