/**
 * CurrencyInput Component
 *
 * Specialized input for currency values with Norwegian formatting.
 * Supports negative values (for deductions/fradrag).
 * Default width is 'md' (~16-20 chars) which fits most currency amounts.
 */

import { InputHTMLAttributes, useState, useEffect, Ref } from 'react';
import clsx from 'clsx';
import { InputWidth } from './Input';

export interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** Current value (number) */
  value?: number | null;
  /** Change handler receiving the numeric value */
  onChange?: (value: number | null) => void;
  /** Whether the input has an error state */
  error?: boolean;
  /** Full width input (deprecated, use width="full" instead) */
  fullWidth?: boolean;
  /** Semantic width of the input field (default: 'md') */
  width?: InputWidth;
  /** Allow negative values (for deductions) */
  allowNegative?: boolean;
  /** Helper text shown below input */
  helperText?: string;
  /** Label text */
  label?: string;
  /** Ref to the input element */
  ref?: Ref<HTMLInputElement>;
}

/**
 * Width classes for semantic sizing
 */
const WIDTH_CLASSES: Record<InputWidth, string> = {
  xs: 'w-24',      // 6rem = ~6-8 chars
  sm: 'w-36',      // 9rem = ~10-12 chars
  md: 'w-48',      // 12rem = ~16-20 chars
  lg: 'w-72',      // 18rem = ~28-32 chars
  full: 'w-full',
};

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

export function CurrencyInput({
  className,
  error,
  fullWidth,
  width = 'md', // Default to medium width for currency
  disabled,
  value,
  onChange,
  allowNegative = true,
  helperText,
  label,
  id,
  ref,
  ...props
}: CurrencyInputProps) {
    // Internal display value (formatted string)
    const [displayValue, setDisplayValue] = useState(() => formatCurrency(value ?? null));

    // Sync external value changes
    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync controlled value from props
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

    // Determine width class (fullWidth overrides width prop for backwards compat)
    const widthClass = fullWidth ? 'w-full' : WIDTH_CLASSES[width];

    return (
      <div className={clsx(widthClass, className)}>
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-pkt-text-default mb-2"
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
              // Base styles - standard input size
              'px-4 py-3 min-h-[40px] pr-16',
              'text-base font-normal text-right',
              'bg-pkt-bg-default',
              'transition-colors duration-200',

              // Border - 2px width, sharp corners
              'border-2 rounded',

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

              // Always full width within container
              'w-full'
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
          <p className="mt-2 text-sm text-pkt-text-subtle">{helperText}</p>
        )}
      </div>
    );
}
