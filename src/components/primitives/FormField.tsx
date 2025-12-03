import { ReactNode } from 'react';
import clsx from 'clsx';
import { InfoLabel } from './InfoLabel';

export interface FormFieldProps {
  /** Field label */
  label?: string;
  /** Whether field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Help text to display below the input */
  helpText?: string;
  /** Optional tooltip for the label (adds info icon) */
  labelTooltip?: string;
  /** The form input/select/textarea component */
  children: ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * FormField wrapper component that combines Label + Input/Select/Textarea + Error message
 * - Handles spacing and layout
 * - Shows error messages with proper styling
 * - Shows help text when no error
 * - Supports info tooltips via labelTooltip prop
 * - Larger spacing for better readability
 */
export function FormField({
  label,
  required,
  error,
  helpText,
  labelTooltip,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={clsx('mb-pkt-05', className)}>
      {label && labelTooltip ? (
        <InfoLabel tooltip={labelTooltip} required={required}>
          {label}
        </InfoLabel>
      ) : label ? (
        <label className="block text-base font-medium text-pkt-text-body-default mb-pkt-02">
          {label}
          {required && (
            <span className="ml-1 text-pkt-border-red" aria-label="påkrevd">
              *
            </span>
          )}
        </label>
      ) : null}

      {children}

      {error && (
        <p className="mt-pkt-02 text-base text-pkt-border-red" role="alert">
          {error}
        </p>
      )}

      {!error && helpText && (
        <p className="mt-pkt-02 text-sm text-pkt-text-placeholder">
          {helpText}
        </p>
      )}
    </div>
  );
}
