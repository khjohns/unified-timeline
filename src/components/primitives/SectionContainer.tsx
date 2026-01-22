/**
 * SectionContainer Component
 *
 * A consistent container for grouping related form fields or content within modals.
 * Provides visual separation for organizing complex forms.
 *
 * USAGE:
 * - Use for grouping related fields in modals (e.g., "Beregningsmetode", "Særskilte krav")
 * - Use "subtle" variant for context/read-only sections
 * - Use "default" variant for editable form sections
 */

import { ReactNode } from 'react';
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
  /** Optional icon next to title */
  icon?: ReactNode;
  /** Whether this section is optional (shows discrete tag) */
  optional?: boolean;
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
  icon,
  optional,
  className,
}: SectionContainerProps) {
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

  return (
    <div className={containerClasses}>
      <div className="px-4 py-3 flex items-center gap-3 border-b border-pkt-border-subtle">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {icon && <span className="text-oslo-blue">{icon}</span>}
            <h3 className="font-bold text-base text-pkt-text-body-dark">
              {title}
              {optional && (
                <span
                  className="ml-2 inline-flex items-center px-1.5 py-0.5 text-xs font-normal rounded bg-pkt-bg-subtle text-pkt-text-body-subtle border border-pkt-border-subtle"
                  aria-label="valgfri seksjon"
                >
                  valgfritt
                </span>
              )}
            </h3>
          </div>
          {description && (
            <p className="text-sm text-pkt-text-body-subtle mt-1">{description}</p>
          )}
        </div>
      </div>
      <div className={clsx('p-4', spacingClass)}>{children}</div>
    </div>
  );
}
