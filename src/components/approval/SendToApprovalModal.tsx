/**
 * SendToApprovalModal Component
 *
 * Modal for submitting a response draft to the approval workflow.
 * Shows summary of the response, amount thresholds, and required approval chain.
 */

import { useState } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { DataList, DataListItem } from '../primitives/DataList';
import { Textarea } from '../primitives/Textarea';
import { Label } from '../primitives/Label';
import { Badge } from '../primitives/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/Select';
import type { DraftResponseData, ApprovalRole } from '../../types/approval';
import {
  APPROVAL_THRESHOLDS,
  getRequiredApprovers,
  APPROVAL_ROLE_LABELS,
  MOCK_APPROVERS,
} from '../../constants/approvalConfig';
import { formatCurrency } from '../../utils/formatters';

interface SendToApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: DraftResponseData;
  belop: number;
  onSubmit: (comment?: string, targetApprover?: string) => void;
}

function getResultatLabel(resultat: DraftResponseData['resultat']): string {
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

function getResultatVariant(resultat: DraftResponseData['resultat']): 'success' | 'warning' | 'danger' {
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

export function SendToApprovalModal({
  open,
  onOpenChange,
  draft,
  belop,
  onSubmit,
}: SendToApprovalModalProps) {
  const [comment, setComment] = useState('');
  const [targetApprover, setTargetApprover] = useState<string>('auto');

  const requiredApprovers = getRequiredApprovers(belop);
  const firstApprover: ApprovalRole | undefined = requiredApprovers[0];
  const availableApprovers = firstApprover ? MOCK_APPROVERS[firstApprover] : [];
  const firstApproverLabel = firstApprover ? APPROVAL_ROLE_LABELS[firstApprover] : 'Godkjenner';

  // Find which threshold applies
  const currentThresholdIndex = APPROVAL_THRESHOLDS.findIndex(
    (t) => belop <= t.maxAmount
  );

  const handleSubmit = () => {
    const approver = targetApprover === 'auto' ? undefined : targetApprover;
    onSubmit(comment || undefined, approver);
    setComment('');
    setTargetApprover('auto');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setComment('');
    setTargetApprover('auto');
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send til godkjenning"
      size="lg"
    >
      <div className="space-y-6">
        {/* Response Summary */}
        <section>
          <h3 className="text-lg font-semibold mb-3">Oppsummering av svar</h3>
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

        {/* Amount Thresholds */}
        <section>
          <h3 className="text-lg font-semibold mb-3">Beløpsgrenser</h3>
          <div className="border border-pkt-border-subtle overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-pkt-surface-gray">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Beløp</th>
                  <th className="px-3 py-2 text-left font-medium">Godkjenningskjede</th>
                </tr>
              </thead>
              <tbody>
                {APPROVAL_THRESHOLDS.map((threshold, index) => (
                  <tr
                    key={threshold.label}
                    className={
                      index === currentThresholdIndex
                        ? 'bg-pkt-surface-light-yellow font-medium'
                        : ''
                    }
                  >
                    <td className="px-3 py-2 border-t border-pkt-border-subtle">
                      {threshold.label}
                      {index === currentThresholdIndex && (
                        <span className="ml-2 text-xs text-pkt-text-body-muted">
                          (ditt beløp)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-t border-pkt-border-subtle">
                      {threshold.requiredRoles
                        .map((role) => APPROVAL_ROLE_LABELS[role])
                        .join(' → ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Required Approval Chain */}
        <section>
          <h3 className="text-lg font-semibold mb-3">Godkjenningskjede</h3>
          <div className="bg-pkt-surface-light-beige p-4 border border-pkt-border-subtle">
            <p className="text-sm mb-3">
              Beløpet <strong>{formatCurrency(belop)}</strong> krever godkjenning fra:
            </p>
            <div className="flex flex-wrap gap-2">
              {requiredApprovers.map((role, index) => (
                <div key={role} className="flex items-center gap-2">
                  <Badge variant="default" size="sm">
                    {APPROVAL_ROLE_LABELS[role]}
                  </Badge>
                  {index < requiredApprovers.length - 1 && (
                    <span className="text-pkt-text-body-muted">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Target Approver Selection */}
        <section>
          <Label htmlFor="target-approver" className="mb-2 block">
            Send til
          </Label>
          <Select value={targetApprover} onValueChange={setTargetApprover}>
            <SelectTrigger width="full" id="target-approver">
              <SelectValue placeholder="Velg godkjenner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                Automatisk ({firstApproverLabel})
              </SelectItem>
              {availableApprovers.map((name) => (
                <SelectItem key={name} value={name}>
                  {name} ({firstApproverLabel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Comment */}
        <section>
          <Label htmlFor="approval-comment" className="mb-2 block">
            Kommentar (valgfritt)
          </Label>
          <Textarea
            id="approval-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Legg til en kommentar til godkjenneren..."
            rows={3}
          />
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
          <Button variant="secondary" onClick={handleCancel}>
            Avbryt
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Send til godkjenning
          </Button>
        </div>
      </div>
    </Modal>
  );
}
