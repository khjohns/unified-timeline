/**
 * PendingApprovalBanner Component
 *
 * Alert banner shown when there's a pending BH response package for approval.
 * Indicates the status and next approver in the chain.
 */

import { CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import { Alert } from '../primitives/Alert';
import { Button } from '../primitives/Button';
import type { BhResponsPakke } from '../../types/approval';
import { getNextApprover } from '../../constants/approvalConfig';
import { formatCurrency } from '../../utils/formatters';

interface PendingApprovalBannerProps {
  pakke: BhResponsPakke;
  /** Whether the current user can take action */
  canApprove?: boolean;
  /** Callback when "Se detaljer" is clicked */
  onViewDetails?: () => void;
  className?: string;
}

export function PendingApprovalBanner({
  pakke,
  canApprove = false,
  onViewDetails,
  className,
}: PendingApprovalBannerProps) {
  const nextApprover = getNextApprover(pakke.steps);

  // Determine banner variant based on status
  if (pakke.status === 'approved') {
    return (
      <Alert variant="success" className={className}>
        <div className="flex items-center gap-2">
          <CheckCircledIcon className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <strong>Responspakke</strong> er godkjent og klar for utsending.
          </div>
        </div>
      </Alert>
    );
  }

  if (pakke.status === 'rejected') {
    const rejectedStep = pakke.steps.find((s) => s.status === 'rejected');
    return (
      <Alert variant="danger" className={className}>
        <div className="flex items-center gap-2">
          <CrossCircledIcon className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <strong>Responspakke</strong> ble avvist
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
      <strong>Responspakke</strong> venter på godkjenning
      {pakke.samletBelop > 0 && (
        <span className="text-sm text-pkt-text-body-muted ml-2">
          ({formatCurrency(pakke.samletBelop)})
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
        {pakke.steps.filter((s) => s.status === 'approved').length} av{' '}
        {pakke.steps.length} godkjenninger fullført
      </div>
    </Alert>
  );
}
