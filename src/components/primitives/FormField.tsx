import { ReactNode, useId } from 'react';
import clsx from 'clsx';
import { InfoLabel } from './InfoLabel';

export interface FormFieldProps {
  /** Field label */
  label?: string;
  /** Whether field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Help text to display below the label and above the input */
  helpText?: string;
  /** Optional tooltip for the label (adds info icon) */
  labelTooltip?: string;
  /** The form input/select/textarea component */
  children: ReactNode;
  /** Additional className for the container */
  className?: string;
  /**
   * ID for the form field - used for htmlFor on label and aria-describedby on error.
   * If not provided, a unique ID will be generated.
   */
  id?: string;
}

/**
 * FormField wrapper component that combines Label + Input/Select/Textarea + Error message
 * - Handles spacing and layout
 * - Shows error messages with proper styling
 * - Shows help text below label and above input
 * - Supports info tooltips via labelTooltip prop
 * - Larger spacing for better readability
 * - WCAG compliant with proper label/input association via htmlFor
 * - Error messages linked via aria-describedby
 */
export function FormField({
  label,
  required,
  error,
  helpText,
  labelTooltip,
  children,
  className,
  id: providedId,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = providedId || generatedId;
  const errorId = `${fieldId}-error`;
  const helpTextId = `${fieldId}-help`;

  // Build aria-describedby value
  const ariaDescribedBy = [
    helpText ? helpTextId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={clsx('mb-5', className)}>
      {label && labelTooltip ? (
        <InfoLabel tooltip={labelTooltip} required={required} htmlFor={fieldId}>
          {label}
        </InfoLabel>
      ) : label ? (
        <label
          htmlFor={fieldId}
          className="block text-base font-medium text-pkt-text-body-default mb-2"
        >
          {label}
          {required && (
            <span className="ml-1 text-pkt-border-red" aria-label="påkrevd">
              *
            </span>
          )}
        </label>
      ) : null}

      {helpText && (
        <p id={helpTextId} className="mb-3 text-sm text-pkt-text-placeholder">
          {helpText}
        </p>
      )}

      {/* Clone children to inject id and aria-describedby if it's a valid element */}
      {children}

      {error && (
        <p
          id={errorId}
          className="mt-2 text-base text-pkt-border-red"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Helper hook to get FormField IDs for manual aria-describedby usage.
 * Use this when you need to manually connect inputs to FormField's error/help text.
 *
 * @example
 * const { fieldId, errorId, helpTextId, ariaDescribedBy } = useFormFieldIds('my-field');
 * <FormField id="my-field" error={error} helpText="Help">
 *   <Input id={fieldId} aria-describedby={ariaDescribedBy} />
 * </FormField>
 */
export function useFormFieldIds(id?: string) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = `${fieldId}-error`;
  const helpTextId = `${fieldId}-help`;

  return {
    fieldId,
    errorId,
    helpTextId,
    getAriaDescribedBy: (hasError: boolean, hasHelpText: boolean) => {
      const ids = [
        hasHelpText ? helpTextId : null,
        hasError ? errorId : null,
      ].filter(Boolean);
      return ids.length > 0 ? ids.join(' ') : undefined;
    },
  };
}
