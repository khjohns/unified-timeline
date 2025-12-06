import { forwardRef, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Whether the textarea has an error state */
  error?: boolean;
  /** Full width textarea */
  fullWidth?: boolean;
}

/**
 * Textarea component with Punkt design system styling
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859)
 * - Larger text and padding for better readability
 * - Focus state with pkt-border-focus (#e0adff)
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, fullWidth, disabled, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        rows={rows}
        className={clsx(
          // Base styles
          'px-4 py-3',
          'text-base font-normal',
          'bg-pkt-bg-default',
          'transition-colors duration-200',
          'resize-vertical',

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

Textarea.displayName = 'Textarea';
