/**
 * ApprovalHistory Component
 *
 * Displays audit trail of approval actions for a BH response package.
 * Shows who approved/rejected, when, and any comments.
 */

import clsx from 'clsx';
import { CheckIcon, Cross2Icon, ClockIcon } from '@radix-ui/react-icons';
import type { ApprovalStep, ApprovalStepStatus } from '../../types/approval';
import { formatDateMedium } from '../../utils/formatters';

interface ApprovalHistoryProps {
  steps: ApprovalStep[];
  submittedAt?: string;
  submittedBy?: string;
  submitterComment?: string;
  className?: string;
}

function getStepIcon(status: ApprovalStepStatus) {
  switch (status) {
    case 'approved':
      return <CheckIcon className="h-4 w-4" />;
    case 'rejected':
      return <Cross2Icon className="h-4 w-4" />;
    case 'in_progress':
      return <ClockIcon className="h-4 w-4" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-current" />;
  }
}

function getStatusColor(status: ApprovalStepStatus): string {
  switch (status) {
    case 'approved':
      return 'text-badge-success-text bg-badge-success-bg';
    case 'rejected':
      return 'text-badge-danger-text bg-badge-danger-bg';
    case 'in_progress':
      return 'text-badge-warning-text bg-badge-warning-bg';
    default:
      return 'text-pkt-text-body-muted bg-pkt-surface-gray';
  }
}

function getStatusLabel(status: ApprovalStepStatus): string {
  switch (status) {
    case 'approved':
      return 'Godkjent';
    case 'rejected':
      return 'Avvist';
    case 'in_progress':
      return 'Venter';
    default:
      return 'Ikke startet';
  }
}

export function ApprovalHistory({
  steps,
  submittedAt,
  submittedBy,
  submitterComment,
  className,
}: ApprovalHistoryProps) {
  // Get steps that have been acted upon (approved or rejected)
  const actedSteps = steps.filter(
    (step) => step.status === 'approved' || step.status === 'rejected'
  );

  // Get the current pending step
  const pendingStep = steps.find((step) => step.status === 'in_progress');

  // If no actions yet and no submission, show nothing
  if (actedSteps.length === 0 && !submittedAt) {
    return null;
  }

  return (
    <div className={clsx('space-y-0', className)}>
      {/* Submission event */}
      {submittedAt && (
        <div className="flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pkt-surface-light-blue text-pkt-text-link">
              <div className="h-2 w-2 rounded-full bg-current" />
            </div>
            {(actedSteps.length > 0 || pendingStep) && (
              <div className="flex-1 w-0.5 bg-pkt-border-subtle mt-1" />
            )}
          </div>
          <div className="flex-1 pb-1">
            <div className="text-sm font-medium">Sendt til godkjenning</div>
            <div className="text-xs text-pkt-text-body-muted">
              {submittedBy && <span>{submittedBy} - </span>}
              {formatDateMedium(submittedAt)}
            </div>
            {submitterComment && (
              <div className="mt-1 text-sm text-pkt-text-body-default italic">
                "{submitterComment}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acted steps */}
      {actedSteps.map((step, index) => {
        const isLast = index === actedSteps.length - 1 && !pendingStep;

        return (
          <div key={step.role} className="flex gap-3 pb-4">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  getStatusColor(step.status)
                )}
              >
                {getStepIcon(step.status)}
              </div>
              {!isLast && <div className="flex-1 w-0.5 bg-pkt-border-subtle mt-1" />}
            </div>
            <div className="flex-1 pb-1">
              <div className="text-sm font-medium">
                {getStatusLabel(step.status)} av {step.roleName}
              </div>
              <div className="text-xs text-pkt-text-body-muted">
                {step.approvedBy && <span>{step.approvedBy} - </span>}
                {step.approvedAt && formatDateMedium(step.approvedAt)}
              </div>
              {step.comment && (
                <div className="mt-1 text-sm text-pkt-text-body-default italic">
                  "{step.comment}"
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Pending step */}
      {pendingStep && (
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={clsx(
                'flex h-6 w-6 items-center justify-center rounded-full',
                getStatusColor(pendingStep.status)
              )}
            >
              {getStepIcon(pendingStep.status)}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-pkt-text-body-muted">
              Venter på {pendingStep.roleName}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
