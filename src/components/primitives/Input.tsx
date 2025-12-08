import { forwardRef, InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export type InputWidth = 'xs' | 'sm' | 'md' | 'lg' | 'full';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Whether the input has an error state */
  error?: boolean;
  /** Full width input (deprecated, use width="full" instead) */
  fullWidth?: boolean;
  /** Semantic width of the input field */
  width?: InputWidth;
}

/**
 * Width classes for semantic sizing:
 * - xs: ~6 chars (e.g., short numbers, codes)
 * - sm: ~12 chars (e.g., dates, short amounts)
 * - md: ~20 chars (e.g., amounts with currency, phone numbers)
 * - lg: ~32 chars (e.g., emails, medium text)
 * - full: 100% width
 */
const WIDTH_CLASSES: Record<InputWidth, string> = {
  xs: 'w-24',      // 6rem = ~6-8 chars
  sm: 'w-36',      // 9rem = ~10-12 chars
  md: 'w-48',      // 12rem = ~16-20 chars
  lg: 'w-72',      // 18rem = ~28-32 chars
  full: 'w-full',
};

/**
 * Input component with Punkt design system styling
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859)
 * - Larger text and padding for better readability
 * - Focus state with pkt-border-focus (#e0adff)
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, fullWidth, width, disabled, ...props }, ref) => {
    // Determine width class (width prop takes precedence over fullWidth)
    const widthClass = width ? WIDTH_CLASSES[width] : (fullWidth ? 'w-full' : undefined);

    return (
      <input
        ref={ref}
        disabled={disabled}
        className={clsx(
          // Base styles - standard input size
          'px-4 py-3 min-h-[40px]',
          'text-base font-normal',
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
          widthClass,

          className
        )}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
