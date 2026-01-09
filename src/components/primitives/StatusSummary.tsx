/**
 * StatusSummary Component
 *
 * A compact summary card for displaying status information.
 * Typically used in modal summaries to show the result of a step/section.
 *
 * Example usage:
 * <StatusSummary title="Preklusjon">
 *   <Badge variant="success">OK</Badge>
 *   <span>Varslet i tide</span>
 * </StatusSummary>
 */

import { ReactNode } from 'react';
import clsx from 'clsx';

export interface StatusSummaryProps {
  /** Title/heading for the summary card */
  title: string;
  /** Content - typically Badge + descriptive text */
  children: ReactNode;
  /** Additional className for the container */
  className?: string;
}

export function StatusSummary({ title, children, className }: StatusSummaryProps) {
  return (
    <div
      className={clsx(
        'p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle',
        className
      )}
    >
      <h5 className="font-medium text-sm mb-2">{title}</h5>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}
