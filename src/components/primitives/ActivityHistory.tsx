/**
 * ActivityHistory Component
 *
 * A collapsible timeline component for displaying activity/event history.
 * Shows entries in a vertical timeline with icons, labels, and optional details.
 *
 * Used by SporHistory and can be reused for any activity feed.
 */

import { ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import * as RadixCollapsible from '@radix-ui/react-collapsible';

// ============ TYPES ============

export type ActivityHistoryVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface ActivityHistoryEntry {
  /** Unique identifier */
  id: string;
  /** Icon to display in the circle */
  icon: ReactNode;
  /** Visual variant for the icon circle */
  variant: ActivityHistoryVariant;
  /** Primary label text */
  label: string;
  /** Secondary meta text (e.g., "BH · Ola Nordmann · 15. jan 2024") */
  meta?: string;
  /** Optional description/quote shown below meta */
  description?: string;
  /** Whether this entry is clickable */
  onClick?: () => void;
  /** Optional indicator icon shown on the right when clickable */
  clickIndicator?: ReactNode;
  /** Optional action button (e.g., letter generation) */
  action?: ReactNode;
}

export interface ActivityHistoryProps {
  /** List of activity entries to display */
  entries: ActivityHistoryEntry[];
  /** Toggle label (default: "Historikk") */
  label?: string;
  /** Whether to show entry count in label */
  showCount?: boolean;
  /** Whether the list is initially expanded */
  defaultOpen?: boolean;
  /** Additional class names */
  className?: string;
}

// ============ VARIANT STYLES ============

const variantStyles: Record<ActivityHistoryVariant, string> = {
  info: 'text-badge-info-text bg-badge-info-bg',
  success: 'text-badge-success-text bg-badge-success-bg',
  warning: 'text-badge-warning-text bg-badge-warning-bg',
  danger: 'text-badge-danger-text bg-badge-danger-bg',
  neutral: 'text-pkt-text-body-muted bg-pkt-surface-gray',
};

// ============ COMPONENTS ============

interface ActivityHistoryItemProps {
  entry: ActivityHistoryEntry;
  isLast: boolean;
}

function ActivityHistoryItem({ entry, isLast }: ActivityHistoryItemProps) {
  const isClickable = !!entry.onClick;

  return (
    <div
      className={clsx(
        'flex gap-3 pb-3 -mx-2 px-2 rounded',
        isClickable && 'cursor-pointer hover:bg-pkt-surface-gray transition-colors'
      )}
      onClick={entry.onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && entry.onClick?.() : undefined}
    >
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div
          className={clsx(
            'flex h-6 w-6 items-center justify-center flex-shrink-0 rounded-full',
            variantStyles[entry.variant]
          )}
        >
          {entry.icon}
        </div>
        {!isLast && <div className="flex-1 w-0.5 bg-pkt-border-default mt-1" />}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">{entry.label}</div>
          <div className="flex items-center gap-2">
            {entry.action}
            {isClickable && entry.clickIndicator}
          </div>
        </div>
        {entry.meta && (
          <div className="text-xs text-pkt-text-body-muted">
            {entry.meta}
          </div>
        )}
        {entry.description && (
          <div className="mt-1 text-sm text-pkt-text-body-default italic truncate">
            "{entry.description}"
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ActivityHistory - Collapsible timeline for activity/event history
 *
 * @example
 * ```tsx
 * <ActivityHistory
 *   entries={[
 *     {
 *       id: '1',
 *       icon: <ArrowRightIcon className="h-4 w-4" />,
 *       variant: 'info',
 *       label: 'Krav sendt',
 *       meta: 'TE · Firma AS · 15. jan 2024',
 *     },
 *     {
 *       id: '2',
 *       icon: <CheckIcon className="h-4 w-4" />,
 *       variant: 'success',
 *       label: 'Godkjent',
 *       meta: 'BH · Kommune · 20. jan 2024',
 *       description: 'Kravet er godkjent i sin helhet.',
 *     },
 *   ]}
 *   label="Historikk"
 *   showCount
 * />
 * ```
 */
export function ActivityHistory({
  entries,
  label = 'Historikk',
  showCount = true,
  defaultOpen = false,
  className,
}: ActivityHistoryProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <RadixCollapsible.Root
      defaultOpen={defaultOpen}
      className={clsx('mt-4 pt-3 border-t border-pkt-border-subtle', className)}
    >
      {/* Toggle header */}
      <RadixCollapsible.Trigger
        className="flex items-center gap-2 text-sm text-pkt-text-body-muted hover:text-pkt-text-body-default hover:bg-pkt-surface-gray rounded px-2 py-1 -mx-2 transition-colors group"
      >
        <ChevronDownIcon
          className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
        <span>
          {label}
          {showCount && ` (${entries.length})`}
        </span>
      </RadixCollapsible.Trigger>

      {/* Content with smooth animation */}
      <RadixCollapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="mt-3">
          {entries.map((entry, index) => (
            <ActivityHistoryItem
              key={entry.id}
              entry={entry}
              isLast={index === entries.length - 1}
            />
          ))}
        </div>
      </RadixCollapsible.Content>
    </RadixCollapsible.Root>
  );
}
