/**
 * DashboardCard Component
 *
 * A card component for dashboard sections with consistent header, content, and action areas.
 * Used in ForseringDashboard and other status displays.
 *
 * Supports collapsible mode where clicking header toggles history visibility.
 */

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Card } from './Card';
import { ChevronDownIcon } from '@radix-ui/react-icons';
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
  /** Additional class names for the content area (e.g., background color) */
  contentClassName?: string;
  /** Optional inline styles (e.g., for animation-delay) */
  style?: CSSProperties;
  /** Enable collapsible header - clicking header toggles expanded state */
  collapsible?: boolean;
  /** Number of history entries (shown in header when collapsible) */
  historyCount?: number;
  /** Controlled expanded state */
  isExpanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Default expanded state (uncontrolled mode) */
  defaultExpanded?: boolean;
}

export function DashboardCard({
  title,
  headerBadge,
  children,
  action,
  variant = 'default',
  className,
  contentClassName,
  style,
  collapsible = false,
  historyCount,
  isExpanded: controlledExpanded,
  onExpandedChange,
  defaultExpanded = false,
}: DashboardCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const newValue = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(newValue);
    }
    onExpandedChange?.(newValue);
  };

  // Only show collapsible behavior when there's history to show
  const hasHistory = historyCount !== undefined && historyCount > 0;
  const isClickable = collapsible && hasHistory;

  // Format history count text
  const historyText = hasHistory
    ? historyCount === 1
      ? '1 hendelse'
      : `${historyCount} hendelser`
    : null;

  const headerContent = (
    <>
      <div className="flex items-center gap-2">
        {isClickable && (
          <ChevronDownIcon
            className={clsx(
              'w-4 h-4 text-pkt-text-body-muted transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        )}
        <h3 className="font-semibold text-sm">{title}</h3>
        {historyText && (
          <span className="text-xs text-pkt-text-body-muted">· {historyText}</span>
        )}
      </div>
      {headerBadge}
    </>
  );

  return (
    <Card variant={variant} className={clsx('p-0 overflow-hidden border border-pkt-border-subtle', className)} style={style}>
      {/* Header - clickable only when there's history */}
      {isClickable ? (
        <button
          type="button"
          onClick={handleToggle}
          className="w-full px-3 py-2 sm:px-4 sm:py-3 border-b border-pkt-border-subtle bg-pkt-surface-strong-gray flex items-center justify-between cursor-pointer hover:bg-pkt-grays-gray-100 transition-colors"
          aria-expanded={isExpanded}
        >
          {headerContent}
        </button>
      ) : (
        <div className="px-3 py-2 sm:px-4 sm:py-3 border-b border-pkt-border-subtle bg-pkt-surface-strong-gray flex items-center justify-between">
          {headerContent}
        </div>
      )}

      {/* Content */}
      <div className={clsx('p-3 sm:p-4', contentClassName)}>
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
