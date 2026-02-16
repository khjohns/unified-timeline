import { clsx } from 'clsx';
import type { SporStatus } from '../../../types/timeline';
import { getStatusDotClass, getStatusLabel } from './trackCardUtils';

interface StatusDotProps {
  status: SporStatus;
  className?: string;
}

/**
 * Colored dot + text label indicating track status.
 * Replaces the 4-dot TrackStepper.
 */
export function StatusDot({ status, className }: StatusDotProps) {
  const isOpen = status === 'utkast' || status === 'ikke_relevant';
  const label = getStatusLabel(status);

  return (
    <div className={clsx('flex items-center gap-1.5', className)}>
      <div
        className={clsx(
          'w-2 h-2 rounded-full shrink-0',
          isOpen ? 'border border-pkt-grays-gray-400' : getStatusDotClass(status),
        )}
      />
      <span className="text-bento-caption font-medium text-pkt-text-body-subtle leading-none">
        {label}
      </span>
    </div>
  );
}
