/**
 * PendingApprovalBanner Component
 *
 * Alert banner shown when there's a pending approval for the current case.
 * Indicates the status and next approver in the chain.
 */

import { CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import { Alert } from '../primitives/Alert';
import { Button } from '../primitives/Button';
import type { ApprovalRequest } from '../../types/approval';
import { getNextApprover } from '../../constants/approvalConfig';
import { formatCurrency } from '../../utils/formatters';

interface PendingApprovalBannerProps {
  request: ApprovalRequest;
  /** Whether the current user can take action */
  canApprove?: boolean;
  /** Callback when "Se detaljer" is clicked */
  onViewDetails?: () => void;
  className?: string;
}

export function PendingApprovalBanner({
  request,
  canApprove = false,
  onViewDetails,
  className,
}: PendingApprovalBannerProps) {
  const nextApprover = getNextApprover(request.steps);
  const sporLabel = request.sporType === 'vederlag' ? 'Vederlagssvar' : 'Fristsvar';

  // Determine banner variant based on status
  if (request.status === 'approved') {
    return (
      <Alert variant="success" className={className}>
        <div className="flex items-center gap-2">
          <CheckCircledIcon className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <strong>{sporLabel}</strong> er godkjent og klar for utsending.
          </div>
        </div>
      </Alert>
    );
  }

  if (request.status === 'rejected') {
    const rejectedStep = request.steps.find((s) => s.status === 'rejected');
    return (
      <Alert variant="danger" className={className}>
        <div className="flex items-center gap-2">
          <CrossCircledIcon className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <strong>{sporLabel}</strong> ble avvist
            {rejectedStep && ` av ${rejectedStep.roleName}`}.
            {rejectedStep?.comment && (
              <span className="block mt-1 text-sm italic">
                "{rejectedStep.comment}"
              </span>
            )}
          </div>
        </div>
      </Alert>
    );
  }

  // Pending status
  const title = (
    <>
      <strong>{sporLabel}</strong> venter på godkjenning
      {request.belop > 0 && (
        <span className="text-sm text-pkt-text-body-muted ml-2">
          ({formatCurrency(request.belop)})
        </span>
      )}
    </>
  );

  return (
    <Alert
      variant={canApprove ? 'info' : 'warning'}
      className={className}
      title={title}
      action={
        onViewDetails && (
          <Button variant="secondary" size="sm" onClick={onViewDetails}>
            Se detaljer
          </Button>
        )
      }
    >
      {nextApprover && (
        <div className="text-sm">
          {canApprove ? (
            <span className="font-medium">Din godkjenning trengs som {nextApprover.roleName}</span>
          ) : (
            <span>Neste godkjenner: {nextApprover.roleName}</span>
          )}
        </div>
      )}
      {/* Progress indicator */}
      <div className="text-xs text-pkt-text-body-muted mt-1">
        {request.steps.filter((s) => s.status === 'approved').length} av{' '}
        {request.steps.length} godkjenninger fullført
      </div>
    </Alert>
  );
}
