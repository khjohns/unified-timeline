/**
 * InfoLabel Component
 *
 * A label with an optional info icon that displays helpful tooltips.
 * WCAG AA Compliant:
 * - Keyboard accessible (focus with Tab)
 * - Screen reader compatible (aria-describedby)
 * - Sufficient color contrast
 * - Touch-friendly (24x24px minimum target)
 */

import { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';

export interface InfoLabelProps {
  /** The main label text */
  children: ReactNode;
  /** Optional tooltip content to display */
  tooltip?: string;
  /** Whether the field is optional (shows discrete tag) */
  optional?: boolean;
  /** @deprecated No longer displays asterisk - use validation instead. Kept for backwards compatibility. */
  required?: boolean;
  /** ID for aria-describedby linkage */
  id?: string;
  /** htmlFor attribute to associate label with input */
  htmlFor?: string;
  /** Additional className */
  className?: string;
}

/**
 * InfoLabel component for form fields with optional tooltip help.
 *
 * Usage:
 * ```tsx
 * <InfoLabel
 *   tooltip="This is helpful context from backend"
 *   optional
 * >
 *   Field Name
 * </InfoLabel>
 * ```
 */
export function InfoLabel({
  children,
  tooltip,
  optional,
  required: _required, // Deprecated - kept for backwards compatibility
  id,
  htmlFor,
  className,
}: InfoLabelProps) {
  const labelId = id || `label-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <label
      id={labelId}
      htmlFor={htmlFor}
      className={clsx(
        'block text-sm font-medium text-pkt-text-body-default mb-2',
        className
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span>
          {children}
          {optional && (
            <span
              className="ml-2 inline-flex items-center px-1.5 py-0.5 text-xs font-normal rounded bg-pkt-bg-subtle text-pkt-text-body-subtle border border-pkt-border-subtle"
              aria-label="valgfritt felt"
            >
              valgfritt
            </span>
          )}
        </span>

        {tooltip && (
          <Tooltip content={tooltip} side="bottom">
            <button
              type="button"
              className={clsx(
                'inline-flex items-center justify-center',
                'w-6 h-6 rounded-full',
                'text-pkt-text-placeholder hover:text-pkt-text-body-default',
                'focus:outline-none focus:ring-2 focus:ring-pkt-border-focus focus:ring-offset-2',
                'transition-colors duration-150',
                'cursor-help'
              )}
              aria-label="Mer informasjon"
              aria-describedby={`${labelId}-tooltip`}
              tabIndex={0}
            >
              <InfoCircledIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </span>
    </label>
  );
}
