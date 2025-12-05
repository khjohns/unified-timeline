/**
 * CurrencyInput Component
 *
 * Specialized input for currency values with Norwegian formatting.
 * Supports negative values (for deductions/fradrag).
 */

import { forwardRef, InputHTMLAttributes, useState, useEffect } from 'react';
import clsx from 'clsx';

export interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** Current value (number) */
  value?: number | null;
  /** Change handler receiving the numeric value */
  onChange?: (value: number | null) => void;
  /** Whether the input has an error state */
  error?: boolean;
  /** Full width input */
  fullWidth?: boolean;
  /** Allow negative values (for deductions) */
  allowNegative?: boolean;
  /** Helper text shown below input */
  helperText?: string;
  /** Label text */
  label?: string;
}

/**
 * Format number with Norwegian thousand separators
 */
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('nb-NO');
}

/**
 * Parse Norwegian formatted string to number
 */
function parseCurrency(input: string): number | null {
  if (!input || input.trim() === '') return null;

  // Remove spaces and replace comma with dot for parsing
  const cleaned = input
    .replace(/\s/g, '')
    .replace(/\./g, '')  // Remove thousand separators (dots in nb-NO)
    .replace(',', '.');   // Replace decimal comma with dot

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      error,
      fullWidth,
      disabled,
      value,
      onChange,
      allowNegative = true,
      helperText,
      label,
      id,
      ...props
    },
    ref
  ) => {
    // Internal display value (formatted string)
    const [displayValue, setDisplayValue] = useState(() => formatCurrency(value ?? null));

    // Sync external value changes
    useEffect(() => {
      setDisplayValue(formatCurrency(value ?? null));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setDisplayValue(inputValue);

      const numericValue = parseCurrency(inputValue);

      // Validate: reject negative if not allowed
      if (!allowNegative && numericValue !== null && numericValue < 0) {
        return;
      }

      onChange?.(numericValue);
    };

    const handleBlur = () => {
      // Reformat on blur
      const numericValue = parseCurrency(displayValue);
      setDisplayValue(formatCurrency(numericValue));
    };

    return (
      <div className={clsx(fullWidth && 'w-full', className)}>
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-pkt-text-default mb-pkt-02"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={clsx(
              // Base styles - 44px minimum height for WCAG 2.5.5
              'px-pkt-04 py-pkt-04 min-h-[44px] pr-16',
              'text-base font-normal text-right',
              'bg-pkt-bg-default',
              'transition-colors duration-200',

              // Border - 2px width, sharp corners
              'border-2 rounded-none',

              // Default border color
              !error && !disabled && 'border-pkt-border-default',

              // Error state
              error && 'border-pkt-border-red',

              // Disabled state
              disabled && [
                'border-pkt-border-disabled',
                'bg-pkt-surface-gray',
                'text-pkt-text-action-disabled',
                'cursor-not-allowed',
              ],

              // Focus state
              !disabled && [
                'focus:outline-none',
                'focus:ring-4',
                error
                  ? 'focus:ring-pkt-brand-red-400/50 focus:border-pkt-border-red'
                  : 'focus:ring-pkt-brand-purple-1000/30 focus:border-pkt-border-focus',
              ],

              // Hover state
              !disabled && 'hover:border-pkt-border-hover',

              // Placeholder
              'placeholder:text-pkt-text-placeholder',

              // Width
              fullWidth && 'w-full'
            )}
            aria-invalid={error ? 'true' : 'false'}
            {...props}
          />
          {/* Currency suffix */}
          <span
            className={clsx(
              'absolute right-4 top-1/2 -translate-y-1/2',
              'text-base font-medium',
              disabled ? 'text-pkt-text-action-disabled' : 'text-pkt-text-subtle'
            )}
          >
            kr
          </span>
        </div>
        {helperText && (
          <p className="mt-pkt-02 text-sm text-pkt-text-subtle">{helperText}</p>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
