/**
 * ApprovalChainStatus Component
 *
 * Visual representation of the approval chain progress.
 * Shows each required approver as a step with status indicators.
 */

import { useState } from 'react';
import clsx from 'clsx';
import { CheckIcon, Cross2Icon, ClockIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import type { ApprovalStep, ApprovalStepStatus } from '../../types/approval';
import { APPROVAL_ROLE_SHORT_LABELS } from '../../constants/approvalConfig';

interface ApprovalChainStatusProps {
  steps: ApprovalStep[];
  /** Show in compact mode (inline) vs expanded mode */
  compact?: boolean;
  /** Allow expanding to see details */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  className?: string;
}

function getStepIcon(status: ApprovalStepStatus) {
  switch (status) {
    case 'approved':
      return <CheckIcon className="h-3.5 w-3.5" />;
    case 'rejected':
      return <Cross2Icon className="h-3.5 w-3.5" />;
    case 'in_progress':
      return <ClockIcon className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function getStepColor(status: ApprovalStepStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-pkt-bg-success text-pkt-text-on-success border-pkt-border-success';
    case 'rejected':
      return 'bg-pkt-bg-error text-pkt-text-on-error border-pkt-border-error';
    case 'in_progress':
      return 'bg-pkt-bg-warning text-pkt-text-on-warning border-pkt-border-warning';
    default:
      return 'bg-pkt-surface-gray text-pkt-text-body-muted border-pkt-border-subtle';
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
      return 'Ikke nådd';
  }
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StepBadge({ step, showLabel = true }: { step: ApprovalStep; showLabel?: boolean }) {
  const icon = getStepIcon(step.status);
  const color = getStepColor(step.status);
  const shortLabel = APPROVAL_ROLE_SHORT_LABELS[step.role];

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border',
        color
      )}
      title={`${step.roleName}: ${getStatusLabel(step.status)}`}
    >
      {icon}
      <span className="text-xs font-medium">{shortLabel}</span>
      {showLabel && (
        <span className="text-xs hidden sm:inline">
          {getStatusLabel(step.status)}
        </span>
      )}
    </div>
  );
}

function Connector({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={clsx(
        'h-0.5 w-4 sm:w-6',
        isActive ? 'bg-pkt-border-default' : 'bg-pkt-border-subtle'
      )}
    />
  );
}

export function ApprovalChainStatus({
  steps,
  compact = false,
  collapsible = true,
  defaultCollapsed = true,
  className,
}: ApprovalChainStatusProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const nextApproverIndex = steps.findIndex((s) => s.status === 'in_progress');
  const nextApprover = nextApproverIndex >= 0 ? steps[nextApproverIndex] : null;

  // Compact view: just show badges inline
  const compactContent = (
    <div className="flex items-center flex-wrap gap-1">
      {steps.map((step, index) => (
        <div key={step.role} className="flex items-center">
          <StepBadge step={step} showLabel={false} />
          {index < steps.length - 1 && (
            <Connector isActive={step.status === 'approved'} />
          )}
        </div>
      ))}
    </div>
  );

  // Expanded view: show more details
  const expandedContent = (
    <div className="space-y-3">
      {/* Chain visualization */}
      <div className="flex items-center flex-wrap gap-1">
        {steps.map((step, index) => (
          <div key={step.role} className="flex items-center">
            <StepBadge step={step} showLabel={true} />
            {index < steps.length - 1 && (
              <Connector isActive={step.status === 'approved'} />
            )}
          </div>
        ))}
      </div>

      {/* Step details */}
      <div className="space-y-2 text-sm">
        {steps.map((step) => (
          <div
            key={step.role}
            className={clsx(
              'flex items-start gap-3 py-2 px-3 rounded',
              step.status === 'in_progress' && 'bg-pkt-surface-light-yellow',
              step.status === 'approved' && 'bg-pkt-surface-light-green',
              step.status === 'rejected' && 'bg-pkt-surface-light-red'
            )}
          >
            <div className="flex-1">
              <div className="font-medium">{step.roleName}</div>
              <div className="text-pkt-text-body-muted">
                {getStatusLabel(step.status)}
                {step.approvedBy && ` av ${step.approvedBy}`}
                {step.approvedAt && ` - ${formatDateTime(step.approvedAt)}`}
              </div>
              {step.comment && (
                <div className="mt-1 text-pkt-text-body-default italic">
                  "{step.comment}"
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (compact) {
    return <div className={className}>{compactContent}</div>;
  }

  if (collapsible) {
    return (
      <div className={clsx('border border-pkt-border-subtle rounded-sm', className)}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-pkt-surface-light-blue dark:hover:text-[#1a3a5a] transition-colors"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Godkjenningsstatus</span>
            {nextApprover && (
              <span className="text-xs text-pkt-text-body-muted">
                (Venter på {nextApprover.roleName})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {compactContent}
            <ChevronDownIcon
              className={clsx(
                'h-4 w-4 text-pkt-text-body-muted transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </div>
        </button>
        {isOpen && (
          <div className="px-3 py-2 border-t border-pkt-border-subtle">
            {expandedContent}
          </div>
        )}
      </div>
    );
  }

  return <div className={className}>{expandedContent}</div>;
}
