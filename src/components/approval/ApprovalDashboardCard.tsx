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
}

export function ApprovalDashboardCard({
  pakke,
  canApprove,
  onOpenDetails,
  onDownloadPdf,
}: ApprovalDashboardCardProps) {
  const approvedCount = pakke.steps.filter((s: ApprovalStep) => s.status === 'approved').length;
  const totalSteps = pakke.steps.length;
  const isFullyApproved = approvedCount === totalSteps;

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

  const statusBadge = isFullyApproved ? (
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
      }
    >
      {/* Metadata - grid layout on desktop */}
      <DataList variant="grid">
        {saksbehandlerDisplay && (
          <DataListItem label="Saksbehandler">
            {saksbehandlerDisplay}
          </DataListItem>
        )}
        {!isFullyApproved && nesteGodkjennerDisplay && (
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
        />
      </div>
    </DashboardCard>
  );
}
