/**
 * SectionContainer Component
 *
 * A consistent container for grouping related form fields or content within modals.
 * Provides visual separation and optional collapsibility for organizing complex forms.
 *
 * USAGE:
 * - Use for grouping related fields in modals (e.g., "Beregningsmetode", "Særskilte krav")
 * - Use collapsible variant for optional/advanced content
 * - Use "subtle" variant for context/read-only sections
 * - Use "default" variant for editable form sections
 */

import { useState, ReactNode } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';

type SectionSpacing = 'default' | 'compact' | 'none';

export interface SectionContainerProps {
  /** Section title */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Section content */
  children: ReactNode;
  /** Visual variant */
  variant?: 'default' | 'subtle';
  /** Content spacing between children: 'default' (space-y-6), 'compact' (space-y-2), 'none' */
  spacing?: SectionSpacing;
  /** Make section collapsible */
  collapsible?: boolean;
  /** Initial open state (only for collapsible) */
  defaultOpen?: boolean;
  /** Optional icon next to title */
  icon?: ReactNode;
  /** Additional className for the container */
  className?: string;
}

const SPACING_CLASSES: Record<SectionSpacing, string> = {
  default: 'space-y-6',
  compact: 'space-y-2',
  none: '',
};

export function SectionContainer({
  title,
  description,
  children,
  variant = 'default',
  spacing = 'default',
  collapsible = false,
  defaultOpen = true,
  icon,
  className,
}: SectionContainerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const spacingClass = SPACING_CLASSES[spacing];

  const containerClasses = clsx(
    'rounded-none',
    {
      // Default: Clean border for form sections
      'border border-pkt-border-subtle': variant === 'default',
      // Subtle: Background fill for context/read-only sections
      'border border-pkt-border-subtle bg-pkt-bg-subtle': variant === 'subtle',
    },
    className
  );

  const headerClasses = clsx(
    'px-4 py-3 flex items-center gap-3',
    {
      // Collapsible header styling
      'cursor-pointer hover:bg-pkt-surface-subtle transition-colors': collapsible,
      // Border bottom when content is visible
      'border-b border-pkt-border-subtle': !collapsible || isOpen,
    }
  );

  const titleElement = (
    <div className="flex-1">
      <div className="flex items-center gap-2">
        {icon && <span className="text-oslo-blue">{icon}</span>}
        <h3 className="font-bold text-base text-pkt-text-body-dark">{title}</h3>
      </div>
      {description && (
        <p className="text-sm text-pkt-text-body-subtle mt-1">{description}</p>
      )}
    </div>
  );

  if (collapsible) {
    return (
      <div className={containerClasses}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={headerClasses}
          aria-expanded={isOpen}
        >
          {titleElement}
          <ChevronDownIcon
            className={clsx(
              'w-5 h-5 text-pkt-text-body-subtle transition-transform flex-shrink-0',
              { 'rotate-180': isOpen }
            )}
          />
        </button>
        {isOpen && <div className={clsx('p-4', spacingClass)}>{children}</div>}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className={headerClasses}>{titleElement}</div>
      <div className={clsx('p-4', spacingClass)}>{children}</div>
    </div>
  );
}
