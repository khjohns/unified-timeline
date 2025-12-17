/**
 * DashboardCard Component
 *
 * A card component for dashboard sections with consistent header, content, and action areas.
 * Used in ForseringDashboard and other status displays.
 */

import type { ReactNode } from 'react';
import { Card } from './Card';
import clsx from 'clsx';

interface DashboardCardProps {
  /** Card title displayed in header */
  title: string;
  /** Optional badge/status indicator in header */
  headerBadge?: ReactNode;
  /** Main content (typically DataList) */
  children: ReactNode;
  /** Optional action button at bottom of card */
  action?: ReactNode;
  /** Additional class names for the card (e.g., grid span) */
  className?: string;
}

export function DashboardCard({
  title,
  headerBadge,
  children,
  action,
  className,
}: DashboardCardProps) {
  return (
    <Card className={clsx('p-0 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle flex items-center justify-between">
        <h3 className="font-bold text-sm">{title}</h3>
        {headerBadge}
      </div>

      {/* Content */}
      <div className="p-4">
        {children}

        {/* Action */}
        {action && (
          <div className="mt-4 pt-4 border-t border-pkt-border-subtle">
            {action}
          </div>
        )}
      </div>
    </Card>
  );
}
