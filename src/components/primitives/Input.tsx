import { forwardRef, InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Whether the input has an error state */
  error?: boolean;
  /** Full width input */
  fullWidth?: boolean;
}

/**
 * Input component with Punkt design system styling
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859)
 * - Larger text and padding for better readability
 * - Focus state with pkt-border-focus (#e0adff)
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, fullWidth, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={clsx(
          // Base styles
          'px-pkt-04 py-pkt-03',
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
          fullWidth && 'w-full',

          className
        )}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
