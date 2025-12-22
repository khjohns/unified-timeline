import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show loading spinner and disable the button */
  loading?: boolean;
}

/**
 * Loading spinner component
 */
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Button component with Punkt design system styling
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859) with 2px width
 * - Larger sizes for better clickability
 * - Focus state with pkt-border-focus (#e0adff)
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, className, children, ...props }, ref) => {
    const isDisabled = props.disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={clsx(
          // Base styles - SKARPE KANTER
          'inline-flex items-center justify-center rounded-none gap-2',
          'font-medium transition-colors duration-200',
          'border-2',

          // Focus state - different for danger variant
          variant !== 'danger'
            ? 'focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30 focus:border-pkt-border-focus'
            : 'focus:outline-none focus:ring-4 focus:ring-pkt-brand-red-400/50 focus:border-pkt-border-red',

          // Disabled state
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'disabled:border-pkt-border-disabled',

          // Variant styles
          {
            // Primary: dark blue background with white text
            'bg-pkt-surface-strong-dark-blue text-pkt-text-body-light':
              variant === 'primary',
            'hover:bg-pkt-brand-warm-blue-1000 hover:border-pkt-border-hover':
              variant === 'primary' && !isDisabled,

            // Secondary: card background with dark blue border (matching primary)
            'bg-pkt-bg-card text-pkt-text-body-dark':
              variant === 'secondary',
            'hover:bg-pkt-bg-subtle hover:border-pkt-border-hover':
              variant === 'secondary' && !isDisabled,

            // Primary and Secondary share the same border
            'border-pkt-border-default':
              variant === 'primary' || variant === 'secondary',

            // Ghost: transparent background
            'bg-transparent text-pkt-text-body-dark':
              variant === 'ghost',
            'border-transparent':
              variant === 'ghost',
            'hover:bg-pkt-surface-light-beige hover:border-pkt-border-light-beige':
              variant === 'ghost' && !isDisabled,

            // Danger: red background with white text
            'bg-pkt-surface-strong-red text-pkt-text-body-light':
              variant === 'danger',
            'border-pkt-border-red':
              variant === 'danger',
            'hover:bg-pkt-brand-red-600 hover:border-pkt-brand-red-600':
              variant === 'danger' && !isDisabled,
          },

          // Size styles - standard button sizes
          {
            'px-4 py-2 text-sm min-h-[36px]': size === 'sm',
            'px-6 py-3 text-base min-h-[40px]': size === 'md',
            'px-8 py-4 text-lg min-h-[44px]': size === 'lg',
          },

          className
        )}
        {...props}
      >
        {loading && (
          <LoadingSpinner
            className={clsx({
              'w-4 h-4': size === 'sm',
              'w-5 h-5': size === 'md',
              'w-6 h-6': size === 'lg',
            })}
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
