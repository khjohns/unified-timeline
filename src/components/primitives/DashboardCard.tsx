/**
 * DashboardCard Component
 *
 * A card component for dashboard sections with consistent header, content, and action areas.
 * Used in ForseringDashboard and other status displays.
 */

import type { CSSProperties, ReactNode } from 'react';
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
  /** Optional inline styles (e.g., for animation-delay) */
  style?: CSSProperties;
}

export function DashboardCard({
  title,
  headerBadge,
  children,
  action,
  variant = 'default',
  className,
  style,
}: DashboardCardProps) {
  return (
    <Card variant={variant} className={clsx('p-0 overflow-hidden transition-shadow duration-200 hover:shadow-md', className)} style={style}>
      {/* Header */}
      <div className="px-3 py-2 sm:px-4 sm:py-3 border-b border-pkt-border-subtle bg-pkt-surface-strong-gray flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        {headerBadge}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        {children}

        {/* Action */}
        {action && (
          <div className="mt-3 pt-2 sm:mt-4 sm:pt-3 border-t border-pkt-border-subtle flex flex-wrap gap-2">
            {action}
          </div>
        )}
      </div>
    </Card>
  );
}
