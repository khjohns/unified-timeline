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
  /** Card variant - default, elevated (shadow), or outlined (border) */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Additional class names for the card (e.g., grid span) */
  className?: string;
}

export function DashboardCard({
  title,
  headerBadge,
  children,
  action,
  variant = 'default',
  className,
}: DashboardCardProps) {
  return (
    <Card variant={variant} className={clsx('p-0 overflow-hidden', className)}>
      {/* Header */}
      <div className="mx-4 mt-4 pb-3 border-b border-pkt-border-subtle flex items-center justify-between">
        <h3 className="font-bold text-sm">{title}</h3>
        {headerBadge}
      </div>

      {/* Content */}
      <div className="p-4">
        {children}

        {/* Action */}
        {action && (
          <div className="mt-4 pt-3 border-t border-pkt-border-subtle flex flex-wrap gap-2">
            {action}
          </div>
        )}
      </div>
    </Card>
  );
}
