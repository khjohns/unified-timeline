/**
 * ApprovalDashboardCard Component
 *
 * Dashboard card displaying BH response package approval status and history.
 * Combines package metadata with approval timeline in a single card.
 */

import { DashboardCard } from '../primitives/DashboardCard';
import { DataList, DataListItem } from '../primitives/DataList';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { ApprovalHistory } from './ApprovalHistory';
import { EyeOpenIcon } from '@radix-ui/react-icons';
import type { BhResponsPakke, ApprovalStep } from '../../types/approval';
import { APPROVAL_ROLE_LABELS, getNextApprover, getPersonsAtRole } from '../../constants/approvalConfig';

interface ApprovalDashboardCardProps {
  pakke: BhResponsPakke;
  canApprove: boolean;
  onOpenDetails: () => void;
  onDownloadPdf?: () => void;
  /** Callback when "Rediger og send på nytt" is clicked (for rejected packages) */
  onRestoreAndEdit?: () => void;
  /** Callback when "Forkast" is clicked (for rejected packages) */
  onDiscard?: () => void;
}

export function ApprovalDashboardCard({
  pakke,
  canApprove,
  onOpenDetails,
  onDownloadPdf,
  onRestoreAndEdit,
  onDiscard,
}: ApprovalDashboardCardProps) {
  const approvedCount = pakke.steps.filter((s: ApprovalStep) => s.status === 'approved').length;
  const totalSteps = pakke.steps.length;
  const isFullyApproved = pakke.status === 'approved';
  const isRejected = pakke.status === 'rejected';
  const rejectedStep = isRejected ? pakke.steps.find((s) => s.status === 'rejected') : undefined;

  // Get next approver info
  const nextApproverStep = getNextApprover(pakke.steps);
  const nextApproverPerson = nextApproverStep ? getPersonsAtRole(nextApproverStep.role)[0] : undefined;

  // Format saksbehandler display
  // Handle both new format (name + role) and legacy format (just role label)
  const saksbehandlerDisplay = (() => {
    if (pakke.submittedBy && pakke.submittedByRole) {
      // New format: name and role stored separately
      return `${pakke.submittedBy}, ${APPROVAL_ROLE_LABELS[pakke.submittedByRole]}`;
    }
    // Legacy fallback: try to find person based on role in requiredApprovers
    // The submitter is typically the lowest role not in the approval chain
    const submitterRole = pakke.submittedByRole || 'PL'; // Default to PL for legacy data
    const person = getPersonsAtRole(submitterRole)[0];
    return person ? `${person.navn}, ${APPROVAL_ROLE_LABELS[submitterRole]}` : pakke.submittedBy;
  })();

  // Format neste godkjenner display
  const nesteGodkjennerDisplay = nextApproverStep
    ? nextApproverPerson
      ? `${nextApproverPerson.navn}, ${nextApproverStep.roleName}`
      : nextApproverStep.roleName
    : undefined;

  const statusBadge = isRejected ? (
    <Badge variant="danger">Avvist</Badge>
  ) : isFullyApproved ? (
    <Badge variant="success">Godkjent</Badge>
  ) : canApprove ? (
    <Badge variant="info">Din godkjenning trengs</Badge>
  ) : (
    <Badge variant="warning">Venter på godkjenning</Badge>
  );

  return (
    <DashboardCard
      title="Godkjenningsflyt"
      headerBadge={statusBadge}
      variant="outlined"
      action={
        <>
          {isRejected ? (
            <>
              {onDiscard && (
                <Button variant="secondary" size="sm" onClick={onDiscard}>
                  Forkast svar
                </Button>
              )}
              {onRestoreAndEdit && (
                <Button variant="primary" size="sm" onClick={onRestoreAndEdit}>
                  Rediger og send på nytt
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant={canApprove ? 'primary' : 'secondary'}
                size="sm"
                onClick={onOpenDetails}
              >
                <EyeOpenIcon className="w-4 h-4 mr-2" />
                Se detaljer
              </Button>
              {isFullyApproved && onDownloadPdf && (
                <Button variant="secondary" size="sm" onClick={onDownloadPdf}>
                  Last ned PDF
                </Button>
              )}
            </>
          )}
        </>
      }
    >
      {/* Rejection reason banner */}
      {isRejected && rejectedStep?.comment && (
        <div className="mb-4 p-3 bg-pkt-bg-error rounded-md border border-pkt-border-error">
          <div className="text-sm font-medium text-pkt-text-error">
            Avvist av {rejectedStep.roleName}
          </div>
          <div className="mt-1 text-sm italic text-pkt-text-body-default">
            "{rejectedStep.comment}"
          </div>
        </div>
      )}

      {/* Metadata - grid layout on desktop */}
      <DataList variant="grid">
        {saksbehandlerDisplay && (
          <DataListItem label="Saksbehandler">
            {saksbehandlerDisplay}
          </DataListItem>
        )}
        {!isFullyApproved && !isRejected && nesteGodkjennerDisplay && (
          <DataListItem label="Neste godkjenner">
            <span className={canApprove ? 'font-medium text-pkt-text-link' : ''}>
              {nesteGodkjennerDisplay}
            </span>
            <span className="text-pkt-text-body-muted ml-2">
              ({approvedCount} av {totalSteps} godkjent)
            </span>
          </DataListItem>
        )}
      </DataList>

      {/* Approval timeline */}
      <div className="mt-4 pt-4 border-t border-pkt-border-subtle">
        <ApprovalHistory
          steps={pakke.steps}
          submittedAt={pakke.submittedAt}
          submittedBy={pakke.submittedBy}
          submitterComment={pakke.submitterComment}
        />
      </div>
    </DashboardCard>
  );
}
