/**
 * BentoDashboardCard
 *
 * Track card redesigned for the bento grid layout.
 * Key differences from DashboardCard:
 *
 * 1. "master" variant: Grunnlag gets a colored top accent line and
 *    hjemmel reference (§25.2) to signal it's the prerequisite track.
 *
 * 2. "dependent" variant: Vederlag/Frist get a subtle subsidiary
 *    indicator when grunnlag is rejected or not yet sent.
 *
 * 3. Compact action area: Designed for icon-button actions, no border-top.
 *
 * 4. Hjemmel label in header: Shows the contract reference (§25.2, §34, §33).
 */

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';

type CardRole = 'master' | 'dependent';

interface BentoDashboardCardProps {
  title: string;
  /** Contract reference displayed in header, e.g. "§25.2" */
  hjemmel?: string;
  headerBadge?: ReactNode;
  children: ReactNode;
  /** Compact action area (icon buttons) */
  action?: ReactNode;
  /** 'master' = Grunnlag (accent line), 'dependent' = Vederlag/Frist */
  role?: CardRole;
  /** Show subsidiary indicator (grunnlag rejected → vederlag/frist treated subsidiarily) */
  isSubsidiary?: boolean;
  /** Dim the card when prerequisite track isn't ready */
  isDimmed?: boolean;
  className?: string;
  style?: CSSProperties;
  collapsible?: boolean;
  historyCount?: number;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  defaultExpanded?: boolean;
}

export function BentoDashboardCard({
  title,
  hjemmel,
  headerBadge,
  children,
  action,
  role = 'dependent',
  isSubsidiary = false,
  isDimmed = false,
  className,
  style,
  collapsible = false,
  historyCount,
  isExpanded: controlledExpanded,
  onExpandedChange,
  defaultExpanded = false,
}: BentoDashboardCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const newValue = !isExpanded;
    if (!isControlled) setInternalExpanded(newValue);
    onExpandedChange?.(newValue);
  };

  const hasHistory = historyCount !== undefined && historyCount > 0;
  const isClickable = collapsible && hasHistory;

  const historyText = hasHistory
    ? historyCount === 1 ? '1 hendelse' : `${historyCount} hendelser`
    : null;

  // Master accent: dark blue top border for Grunnlag
  const accentClass = role === 'master'
    ? 'border-t-2 border-t-pkt-brand-dark-blue-1000'
    : '';

  // Subsidiary indicator styling
  const subsidiaryClass = isSubsidiary
    ? 'ring-1 ring-inset ring-badge-warning-border/30'
    : '';

  // Dimmed when prerequisite not met
  const dimClass = isDimmed ? 'opacity-60' : '';

  const headerContent = (
    <>
      <div className="flex items-center gap-2 min-w-0">
        {isClickable && (
          <ChevronDownIcon
            className={clsx(
              'w-3.5 h-3.5 text-pkt-text-body-muted transition-transform duration-200 shrink-0',
              isExpanded && 'rotate-180'
            )}
          />
        )}
        <h3 className="font-semibold text-sm truncate">{title}</h3>
        {hjemmel && (
          <span className="text-[10px] font-mono text-pkt-text-body-muted shrink-0">
            {hjemmel}
          </span>
        )}
        {historyText && (
          <span className="text-[10px] text-pkt-text-body-muted shrink-0">
            · {historyText}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isSubsidiary && (
          <span className="text-[9px] font-medium uppercase tracking-wider text-badge-warning-text bg-badge-warning-bg px-1.5 py-0.5 rounded-sm">
            Subsidiært
          </span>
        )}
        {headerBadge}
      </div>
    </>
  );

  return (
    <div
      className={clsx(
        'rounded-lg bg-pkt-bg-card border border-pkt-border-subtle overflow-hidden',
        accentClass,
        subsidiaryClass,
        dimClass,
        'transition-opacity duration-300',
        className,
      )}
      style={style}
    >
      {/* Header */}
      {isClickable ? (
        <button
          type="button"
          onClick={handleToggle}
          className={clsx(
            'w-full px-3 py-2 border-b border-pkt-border-subtle flex items-center justify-between gap-2',
            'cursor-pointer hover:bg-pkt-grays-gray-100/50 transition-colors',
            role === 'master'
              ? 'bg-pkt-surface-strong-gray'
              : 'bg-pkt-bg-card',
          )}
          aria-expanded={isExpanded}
        >
          {headerContent}
        </button>
      ) : (
        <div
          className={clsx(
            'px-3 py-2 border-b border-pkt-border-subtle flex items-center justify-between gap-2',
            role === 'master'
              ? 'bg-pkt-surface-strong-gray'
              : 'bg-pkt-bg-card',
          )}
        >
          {headerContent}
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {children}

        {/* Action area - compact, no border separator */}
        {action && (
          <div className="mt-2 pt-1.5">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
