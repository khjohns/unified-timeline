import { ReactNode } from 'react';
import clsx from 'clsx';

export interface FormFieldProps {
  /** Field label */
  label?: string;
  /** Whether field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Help text to display below the input */
  helpText?: string;
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
 * - Larger spacing for better readability
 */
export function FormField({
  label,
  required,
  error,
  helpText,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={clsx('mb-pkt-05', className)}>
      {label && (
        <label className="block text-base font-medium text-pkt-text-body-default mb-pkt-02">
          {label}
          {required && (
            <span className="ml-1 text-pkt-border-red" aria-label="påkrevd">
              *
            </span>
          )}
        </label>
      )}

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
